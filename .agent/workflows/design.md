---
description: Reference the Matte Premium design system before making any UI changes
---

## Steps

1. Read the design system document:
   ```
   View file: .agent/design.md
   ```

2. Before modifying any screen's styles or layout, verify against the **Polishing Checklist** at the bottom of `design.md`.

3. Key rules to always apply:
   - Cards: `Colors.cardSurface` + `Colors.hairlineBorder` (never `Colors.card`/`Colors.cardBorder`)
   - Tappable rows: `chevron-forward` (16px, `Colors.textTertiary`), `activeOpacity={0.7}`
   - Dashboard lists: max 3 items, "See All ›" link when truncated
   - Gradients: ONLY on data visualization bars, never card backgrounds
   - No glows, no glassmorphism, no shadows on cards
   - Delete actions: detail sheet → red button → confirmation alert
