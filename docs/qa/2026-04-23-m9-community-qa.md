# M9 Community — On-Device QA Checklist

> Walk this on a real device after migrations 041–049 land on staging.
> Branch: `m9-community` → squash-merged onto `m5-complete`.
> Generated: April 23, 2026.

---

## On-device QA

- [ ] Community tab loads — XP ribbon shows for new user (empty state copy)
- [ ] Scan one product, return to Community — XP ribbon updates to "Lv. 1 · 10 XP · 1-day streak"
- [ ] Toxic Database tile → search "chocolate" → entry appears → tap opens sheet with symptoms
- [ ] Vendor Directory tile → empty state copy until vendors.json is populated
- [ ] Kiba Kitchen featured hero (or empty CTA) → "Submit the first recipe" CTA → fill form → attach image → submit chocolate recipe → expect rejection
- [ ] Submit clean recipe → "Submitted for review" message; status pending_review until you flip to approved in Studio
- [ ] Tap recipe → detail with disclaimer top + bottom; ingredients table + prep steps render
- [ ] ResultScreen overflow on a Pure Balance product (or any seeded brand): "Contact Pure Balance" appears (after Steven curates vendors.json + runs npm run seed:vendors). Tap → VendorDirectory.
- [ ] ResultScreen overflow "Flag this score" → SafetyFlagSheet opens, submit a flag, verify it appears in SafetyFlags → My Flags tab
- [ ] Blog carousel — populate one post via Studio → carousel appears → tap → detail with markdown body rendered
- [ ] r/kibascan footer link → opens browser
- [ ] Recall banner — when any product in `products` has `is_recalled=true AND updated_at >= NOW() - INTERVAL '30 days'`, banner shows
- [ ] Discovery Grid — all 4 tiles tappable; Kiba Index Highlights tile shows mini preview when active pet has scan-verified votes

---

## Migration apply checklist

- [ ] Run `npx supabase db push` against staging — confirms migrations 041-049 land cleanly
- [ ] Verify in Studio: 6 new tables present (community_recipes, user_xp_events, user_xp_totals, blog_posts, vendors, score_flags); 2 new buckets (recipe-images, blog-images)
- [ ] Verify trigger functions exist: process_scan_xp, process_vote_xp, process_recipe_approval_xp, process_missing_product_approval_xp, upsert_user_xp_totals, get_user_xp_summary, get_score_flag_activity_counts
- [ ] Insert test scan as test user, verify user_xp_totals updates
- [ ] Run `npm run sync:toxics` then `npx supabase functions deploy validate-recipe`
- [ ] Test validate-recipe with curl on a chocolate recipe — expect status='auto_rejected'
- [ ] Once vendors.json is curated: `npm run seed:vendors`
