# parse-ingredients Edge Function

Supabase Edge Function that calls Claude Haiku server-side to parse ingredient
text and classify products. Keeps the Anthropic API key out of the app binary (D-127).

## Deployment

```bash
supabase functions deploy parse-ingredients
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## Request

```
POST /functions/v1/parse-ingredients
Authorization: Bearer <supabase-jwt-or-anon-key>
Content-Type: application/json

{
  "raw_text": "Chicken, Brown Rice, Chicken Meal, ...",
  "product_name": "Adult Chicken & Rice",   // optional
  "brand": "Acme Pet Food"                  // optional
}
```

## Response (200)

```json
{
  "ingredients": ["Chicken", "Brown Rice", "Chicken Meal"],
  "confidence": "high",
  "raw_input_length": 450,
  "parsed_count": 3,
  "suggested_category": "daily_food",
  "suggested_species": "dog",
  "category_confidence": "high",
  "classification_signals": "Named protein sources, dog-specific label text"
}
```

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Invalid or empty input |
| 401 | Missing or invalid auth token |
| 422 | Haiku returned unparseable result (includes raw output for debugging) |
| 429 | Rate limit exceeded (10 req/min per user) |
| 502 | Haiku API failure |

## Security

- Requires Supabase auth (anon or user JWT)
- Rate limited: 10 requests per minute per user
- ANTHROPIC_API_KEY in Edge Function secrets only
- Input capped at 10,000 characters

## Model

Uses `claude-haiku-4-5-20251001` ($0.80/MTok input, $4.00/MTok output).
