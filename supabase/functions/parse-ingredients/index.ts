// supabase/functions/parse-ingredients/index.ts
// M3 Session 3: Supabase Edge Function for Claude Haiku ingredient parsing (D-127, D-128)
//
// Accepts raw ingredient text, calls Claude Haiku server-side, returns
// parsed ingredients + product classification. The Anthropic API key
// lives in Edge Function secrets — never exposed to the client app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_INPUT_LENGTH = 10_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

// In-memory rate limit store (resets on cold start — acceptable for Edge Functions)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function buildPrompt(
  rawText: string,
  productName?: string,
  brand?: string,
): string {
  const context = [
    productName ? `Product: ${productName}` : null,
    brand ? `Brand: ${brand}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a pet food label parser. Parse the following ingredient text and classify the product.

${context ? context + "\n\n" : ""}Ingredient text:
${rawText}

Return ONLY a JSON object with these fields:
{
  "ingredients": ["Ingredient 1", "Ingredient 2", ...],
  "confidence": "high" | "medium" | "low",
  "suggested_category": "daily_food" | "treat" | "supplement" | "grooming",
  "suggested_species": "dog" | "cat" | "all",
  "category_confidence": "high" | "medium" | "low",
  "classification_signals": "Brief explanation of classification reasoning"
}

Rules:
- Parse each ingredient as it appears on the label, preserving original casing
- Keep parenthetical content with its parent ingredient: "Chicken Meal (source of Glucosamine)" is ONE ingredient
- Separate on commas only (not "and" within an ingredient name)
- "confidence" reflects how clean/parseable the input text is
- Category signals: AAFCO statement or named protein sources = daily_food, "treat"/"snack" in name = treat, vitamin/mineral-only lists = supplement, surfactants/shampoo = grooming
- Species signals: look for "dog"/"canine"/"puppy" or "cat"/"feline"/"kitten" in product name/brand; default to "all" if unclear
- Do NOT infer ingredients not present in the text`;
}

function parseHaikuResponse(text: string): Record<string, unknown> | null {
  let cleaned = text.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    const filtered = lines.filter((l) => !l.trim().startsWith("```"));
    cleaned = filtered.join("\n").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function validateInput(
  body: Record<string, unknown>,
): { raw_text: string; product_name?: string; brand?: string } | string {
  const rawText = body.raw_text;

  if (!rawText || typeof rawText !== "string") {
    return "raw_text is required and must be a non-empty string";
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return "raw_text must not be empty";
  }

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return `raw_text exceeds maximum length of ${MAX_INPUT_LENGTH} characters`;
  }

  return {
    raw_text: trimmed,
    product_name: typeof body.product_name === "string"
      ? body.product_name.trim() || undefined
      : undefined,
    brand: typeof body.brand === "string"
      ? body.brand.trim() || undefined
      : undefined,
  };
}

const VALID_CATEGORIES = ["daily_food", "treat", "supplement", "grooming"];
const VALID_SPECIES = ["dog", "cat", "all"];
const VALID_CONFIDENCE = ["high", "medium", "low"];

function validateResponse(parsed: Record<string, unknown>): string | null {
  if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
    return "Haiku returned no ingredients array";
  }

  for (const ing of parsed.ingredients) {
    if (typeof ing !== "string" || ing.trim().length === 0) {
      return "Haiku returned non-string or empty ingredient";
    }
  }

  if (
    typeof parsed.suggested_category === "string" &&
    !VALID_CATEGORIES.includes(parsed.suggested_category)
  ) {
    return `Invalid suggested_category: ${parsed.suggested_category}`;
  }

  if (
    typeof parsed.suggested_species === "string" &&
    !VALID_SPECIES.includes(parsed.suggested_species)
  ) {
    return `Invalid suggested_species: ${parsed.suggested_species}`;
  }

  return null;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify Supabase auth — require valid JWT or anon key
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Maximum 10 requests per minute.",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Validate API key is configured
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not configured in Edge Function secrets");
    return new Response(
      JSON.stringify({ error: "Service configuration error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Parse and validate request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validation = validateInput(body);
  if (typeof validation === "string") {
    return new Response(JSON.stringify({ error: validation }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { raw_text, product_name, brand } = validation;

  // Call Claude Haiku
  const prompt = buildPrompt(raw_text, product_name, brand);

  let haikuResponse: Response;
  try {
    haikuResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    console.error("Haiku API fetch error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach AI service" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!haikuResponse.ok) {
    const errBody = await haikuResponse.text();
    console.error(
      `Haiku API error ${haikuResponse.status}:`,
      errBody.slice(0, 500),
    );
    return new Response(
      JSON.stringify({
        error: "AI service returned an error",
        status: haikuResponse.status,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let haikuData: Record<string, unknown>;
  try {
    haikuData = await haikuResponse.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to parse AI service response" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Extract text from Haiku response
  const content = haikuData.content as Array<{ type: string; text: string }>;
  if (!content || !content[0] || content[0].type !== "text") {
    return new Response(
      JSON.stringify({
        error: "Unexpected AI response format",
        raw: JSON.stringify(haikuData).slice(0, 500),
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const rawHaikuText = content[0].text;

  // Parse Haiku JSON output
  const parsed = parseHaikuResponse(rawHaikuText);
  if (!parsed) {
    return new Response(
      JSON.stringify({
        error: "AI returned unparseable result",
        raw: rawHaikuText.slice(0, 1000),
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Validate parsed output
  const responseError = validateResponse(parsed);
  if (responseError) {
    return new Response(
      JSON.stringify({
        error: responseError,
        raw: rawHaikuText.slice(0, 1000),
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const ingredients = parsed.ingredients as string[];

  // Build response
  const result = {
    ingredients,
    confidence: VALID_CONFIDENCE.includes(parsed.confidence as string)
      ? parsed.confidence
      : "medium",
    raw_input_length: raw_text.length,
    parsed_count: ingredients.length,
    suggested_category: VALID_CATEGORIES.includes(
        parsed.suggested_category as string,
      )
      ? parsed.suggested_category
      : "daily_food",
    suggested_species: VALID_SPECIES.includes(
        parsed.suggested_species as string,
      )
      ? parsed.suggested_species
      : "all",
    category_confidence: VALID_CONFIDENCE.includes(
        parsed.category_confidence as string,
      )
      ? parsed.category_confidence
      : "low",
    classification_signals: typeof parsed.classification_signals === "string"
      ? parsed.classification_signals
      : "",
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
