# Tests

## Run
- All tests: `npx jest`
- Scoring only: `npx jest --testPathPattern=scoring`
- Single file: `npx jest --testPathPattern=<filename>`
- Regression anchors: `npx jest --testPathPattern=regressionAnchors`
- Update snapshots: `npx jest --testPathPattern=regressionAnchors -u`

## Testing Pyramid — Which Test for Which Change

| Change type | Test type | Why |
|---|---|---|
| New utility/helper | Unit test | Pure logic, fast, isolated |
| New scoring rule | Unit + regression anchors | Verify logic AND check anchor scores don't drift |
| New API endpoint | Integration | Needs DB, auth, middleware |
| UI component | Snapshot | Catch unintended visual regressions |
| Bug fix | Regression test | Prove fix, prevent recurrence |
| Refactor (no behavior change) | Run existing suite | Don't write new — existing tests are the gate |

## Regression Anchors
Pure Balance (Dog) = **61**, Temptations (Cat Treat) = **0**. Run after ANY scoring change.
Snapshots in `services/scoring/__snapshots__/` — review diffs carefully before updating.

## Fixtures
`engine.test.ts` has `makeProduct()`, `makePet()`, `makeIngredient()` helpers.
Copy the pattern for new test files — fixtures are test-local, not shared.

## Adding a New Regression Anchor
1. Add product + ingredients to `regressionAnchors.test.ts`
2. Add hard assertion (`expect(result.finalScore).toBe(N)`)
3. Run `npx jest --testPathPattern=regressionAnchors -u` to generate snapshot
4. Verify score matches production expectations
