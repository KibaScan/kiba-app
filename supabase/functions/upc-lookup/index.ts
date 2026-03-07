// supabase/functions/upc-lookup/index.ts
// M3 Session 4: External UPC lookup via UPCitemdb (D-127)
//
// Abstraction layer for external UPC API. Currently uses UPCitemdb free tier
// (no API key needed). Edge Function allows swapping to a paid API without
// pushing an app update.

const UPCITEMDB_URL = "https://api.upcitemdb.com/prod/trial/lookup";
const FETCH_TIMEOUT_MS = 5000;

interface UpcResult {
  found: boolean;
  product_name: string | null;
  brand: string | null;
  image_url: string | null;
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

  // Parse request
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upc = body.upc;
  if (!upc || typeof upc !== "string" || upc.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "upc is required and must be a non-empty string" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const cleanUpc = upc.trim();

  // Call UPCitemdb
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let result: UpcResult;

  try {
    const response = await fetch(`${UPCITEMDB_URL}?upc=${encodeURIComponent(cleanUpc)}`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.status === 429) {
      // Rate limited — return not_found so client falls through to OCR
      result = { found: false, product_name: null, brand: null, image_url: null };
    } else if (!response.ok) {
      console.error(`UPCitemdb error: ${response.status}`);
      result = { found: false, product_name: null, brand: null, image_url: null };
    } else {
      const data = await response.json();

      if (
        data.items &&
        Array.isArray(data.items) &&
        data.items.length > 0
      ) {
        const item = data.items[0];
        result = {
          found: true,
          product_name: item.title || null,
          brand: item.brand || null,
          image_url:
            Array.isArray(item.images) && item.images.length > 0
              ? item.images[0]
              : null,
        };
      } else {
        result = { found: false, product_name: null, brand: null, image_url: null };
      }
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error("UPCitemdb fetch error:", err);
    result = { found: false, product_name: null, brand: null, image_url: null };
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
