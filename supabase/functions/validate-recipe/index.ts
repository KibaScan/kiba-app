import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import toxicFoods from './toxic_foods.json' with { type: 'json' };

interface RecipePayload {
  recipe_id: string;
}

interface ToxicEntry {
  id: string;
  name: string;
  alt_names: string[];
  species_severity: { dog: 'toxic' | 'caution' | 'safe'; cat: 'toxic' | 'caution' | 'safe' };
}

const UPVM_REGEX =
  /\b(cure|prevent|diagnose|((helps with|good for|treats)\s+(?:\S+\s+)*?(disease|condition|allergy|arthritis|kidney|liver|cancer|diabetes|seizure)))\b/i;

function findToxicMatch(name: string, species: 'dog' | 'cat' | 'both'): ToxicEntry | null {
  const normalized = name.toLowerCase().trim();
  const checkSpecies: ('dog' | 'cat')[] = species === 'both' ? ['dog', 'cat'] : [species];
  for (const entry of (toxicFoods as { toxics: ToxicEntry[] }).toxics) {
    const candidates = [entry.name.toLowerCase(), ...entry.alt_names.map((n) => n.toLowerCase())];
    if (!candidates.some((c) => normalized.includes(c))) continue;
    if (checkSpecies.some((s) => entry.species_severity[s] === 'toxic')) return entry;
  }
  return null;
}

function lethalSpeciesPhrase(match: ToxicEntry, species: 'dog' | 'cat' | 'both'): string {
  const dogToxic = match.species_severity.dog === 'toxic';
  const catToxic = match.species_severity.cat === 'toxic';
  if (species === 'both') {
    return dogToxic && catToxic ? 'dogs and cats' : dogToxic ? 'dogs' : 'cats';
  }
  return species === 'dog' ? 'dogs' : 'cats';
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ─── Auth: verify caller ──────────────────────────────────
  // Without this, any authenticated user could pass any recipe_id and
  // flip another user's `approved` recipe back to `pending_review`.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'missing authorization' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: RecipePayload;
  try {
    body = (await req.json()) as RecipePayload;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!body?.recipe_id) {
    return new Response(JSON.stringify({ error: 'recipe_id required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { data: recipe, error: fetchError } = await admin
    .from('community_recipes')
    .select('*')
    .eq('id', body.recipe_id)
    .single();
  if (fetchError || !recipe) {
    return new Response(JSON.stringify({ error: 'recipe not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  // ─── Ownership + status guards ─────────────────────────────
  // Callers can only validate their own recipes, and only while the recipe
  // is still in the `pending` transient state (before auto-rejection or
  // moderation). Defense-in-depth against future auth regressions and
  // prevents demoting an approved recipe back to pending_review.
  if (recipe.user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'not your recipe' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (recipe.status !== 'pending') {
    return new Response(
      JSON.stringify({ error: 'already validated', status: recipe.status }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  // Toxic-ingredient scan
  for (const ing of recipe.ingredients as { name: string }[]) {
    const match = findToxicMatch(ing.name, recipe.species);
    if (match) {
      const lethalSpecies = lethalSpeciesPhrase(match, recipe.species);
      const reason = `This recipe contains ${match.name}, which is toxic to ${lethalSpecies}. Please remove it and resubmit.`;
      await admin
        .from('community_recipes')
        .update({
          status: 'auto_rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', recipe.id);
      return new Response(JSON.stringify({ status: 'auto_rejected', reason }), {
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  // UPVM regex
  const haystack = [recipe.title, recipe.subtitle ?? '', ...(recipe.prep_steps as string[])].join(
    ' \n ',
  );
  if (UPVM_REGEX.test(haystack)) {
    const reason =
      "Community recipes can't include health or medical claims. Remove language about treating, curing, or preventing conditions and resubmit.";
    await admin
      .from('community_recipes')
      .update({
        status: 'auto_rejected',
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', recipe.id);
    return new Response(JSON.stringify({ status: 'auto_rejected', reason }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  await admin
    .from('community_recipes')
    .update({ status: 'pending_review' })
    .eq('id', recipe.id);
  return new Response(JSON.stringify({ status: 'pending_review' }), {
    headers: { 'content-type': 'application/json' },
  });
});
