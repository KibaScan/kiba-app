// Kiba — M9 Community Service
// Surfaces feed data for CommunityScreen widgets:
//   - fetchRecentRecalls: products marked is_recalled in the last 30 days.
//   - fetchKibaIndexHighlights: top 3 products per metric (picky_eaters,
//     sensitive_tummies) for the active pet's species, derived from the
//     existing per-product get_kiba_index_stats RPC.
//
// Reads return [] gracefully on offline / error per pantryService convention.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import type { KibaIndexStats } from './kibaIndexService';

// ─── Recent Recalls ─────────────────────────────────────

const RECENT_RECALL_DAYS = 30;
const RECENT_RECALL_LIMIT = 5;

export interface RecentRecall {
  product_id: string;
  brand: string;
  name: string;
}

export async function fetchRecentRecalls(): Promise<RecentRecall[]> {
  if (!(await isOnline())) return [];

  try {
    const cutoff = new Date(Date.now() - RECENT_RECALL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('products')
      .select('id, brand, name')
      .eq('is_recalled', true)
      .gte('updated_at', cutoff)
      .order('updated_at', { ascending: false })
      .limit(RECENT_RECALL_LIMIT);

    if (error || !data) return [];

    return (data as Array<{ id: string; brand: string; name: string }>).map(row => ({
      product_id: row.id,
      brand: row.brand,
      name: row.name,
    }));
  } catch (e) {
    console.error('[fetchRecentRecalls] FAILED:', e);
    return [];
  }
}

// ─── Kiba Index Highlights ──────────────────────────────

export type KibaIndexMetric = 'picky_eaters' | 'sensitive_tummies';

export interface KibaIndexHighlight {
  product_id: string;
  brand: string;
  name: string;
  metric: KibaIndexMetric;
  /** 0.0–1.0 ratio (loved/total or perfect/total) */
  score: number;
}

// Min-vote thresholds keep low-sample-size products (e.g. 1/1 = 100%) from
// drowning out genuinely well-rated picks. Tunable per metric.
const MIN_TASTE_VOTES = 3;
const MIN_TUMMY_VOTES = 3;
const TOP_N_PER_METRIC = 3;

interface CandidateRow {
  product_id: string;
  brand: string;
  name: string;
}

const CANDIDATE_LIMIT = 200;

export async function fetchKibaIndexHighlights(species: 'dog' | 'cat'): Promise<KibaIndexHighlight[]> {
  if (!(await isOnline())) return [];

  try {
    // Step 1: Fetch candidate products voted on for this species via the
    // SECURITY DEFINER aggregation RPC (migration 052). Querying
    // `kiba_index_votes` directly would trigger per-user RLS and narrow
    // the feed to products the current user voted on.
    const { data: rawCandidates, error: candidatesErr } = await supabase.rpc(
      'get_kiba_index_candidates',
      { p_species: species, p_limit: CANDIDATE_LIMIT },
    );

    if (candidatesErr || !rawCandidates) return [];

    const candidates = rawCandidates as CandidateRow[];
    if (candidates.length === 0) return [];

    // Step 2: Per-product RPC for stats. Run in parallel; tolerate per-row
    // errors so one bad fetch doesn't drop the whole highlight reel.
    type Scored = { row: CandidateRow; stats: KibaIndexStats };
    const scored: Scored[] = [];
    const statsResults = await Promise.all(
      candidates.map(async row => {
        const { data, error } = await supabase.rpc('get_kiba_index_stats', {
          p_product_id: row.product_id,
          p_species: species,
        });
        if (error || !data) return null;
        return { row, stats: data as KibaIndexStats };
      }),
    );
    for (const r of statsResults) {
      if (r) scored.push(r);
    }

    // Step 3: Rank per metric.
    const pickyRanked = scored
      .filter(s => s.stats.taste.total >= MIN_TASTE_VOTES)
      .map(s => ({
        scored: s,
        ratio: s.stats.taste.loved / s.stats.taste.total,
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, TOP_N_PER_METRIC);

    const tummyRanked = scored
      .filter(s => s.stats.tummy.total >= MIN_TUMMY_VOTES)
      .map(s => ({
        scored: s,
        ratio: s.stats.tummy.perfect / s.stats.tummy.total,
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, TOP_N_PER_METRIC);

    const out: KibaIndexHighlight[] = [];
    for (const p of pickyRanked) {
      out.push({
        product_id: p.scored.row.product_id,
        brand: p.scored.row.brand,
        name: p.scored.row.name,
        metric: 'picky_eaters',
        score: p.ratio,
      });
    }
    for (const t of tummyRanked) {
      out.push({
        product_id: t.scored.row.product_id,
        brand: t.scored.row.brand,
        name: t.scored.row.name,
        metric: 'sensitive_tummies',
        score: t.ratio,
      });
    }
    return out;
  } catch (e) {
    console.error('[fetchKibaIndexHighlights] FAILED:', e);
    return [];
  }
}
