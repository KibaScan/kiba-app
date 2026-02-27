import {
  scoreNutritionalProfile,
  NutritionalProfileInput,
} from '../../../src/services/scoring/nutritionalProfile';

// §8 Worked Example: Adult Cat, Domestic Shorthair, Moisture 78%
// GA (as-fed): Protein 10%, Fat 5%, Fiber 1%, Moisture 78%

const input: NutritionalProfileInput = {
  gaProteinPct: 10,
  gaFatPct: 5,
  gaFiberPct: 1,
  gaMoisturePct: 78,
  gaCalciumPct: null,
  gaPhosphorusPct: null,
  gaOmega3Pct: null,
  species: 'cat',
  lifeStage: 'adult',
  breedSize: null,
  petConditions: [],
  aafcoStatement: null,
  lifeStageClaim: null,
  nutritionalDataSource: null,
  category: 'daily_food',
};

test('§8 regression trace — adult cat wet food → bucket 90', () => {
  // ─── Step 1: DMB conversion ───────────────────────────
  const moisture = 78;
  const dryMatter = 100 - moisture; // 22

  const proteinDmb = (10 / dryMatter) * 100;
  const fatDmb = (5 / dryMatter) * 100;
  const fiberDmb = (1 / dryMatter) * 100;

  // Ash: wet food default = 2% AF → DMB
  const ashAf = 2.0;
  const ashDmb = (ashAf / dryMatter) * 100;

  // NFE
  const carbDmb = Math.max(0, 100 - (proteinDmb + fatDmb + fiberDmb + ashDmb));

  console.log('═══ §8 REGRESSION TRACE ═══');
  console.log('');
  console.log('1. DMB CONVERSION (moisture 78%, dry matter 22%)');
  console.log(`   Protein: 10 / 22 × 100 = ${proteinDmb.toFixed(4)}%`);
  console.log(`   Fat:      5 / 22 × 100 = ${fatDmb.toFixed(4)}%`);
  console.log(`   Fiber:    1 / 22 × 100 = ${fiberDmb.toFixed(4)}%`);
  console.log(`   Ash:      2 / 22 × 100 = ${ashDmb.toFixed(4)}% (wet food 2% AF default)`);
  console.log(`   Carbs:  100 - (${proteinDmb.toFixed(2)} + ${fatDmb.toFixed(2)} + ${fiberDmb.toFixed(2)} + ${ashDmb.toFixed(2)}) = ${carbDmb.toFixed(4)}%`);

  // ─── Step 2: AAFCO thresholds ─────────────────────────
  const proteinMin = 26.0; // adult cat
  const fatMin = 9.0;      // adult cat

  console.log('');
  console.log('2. AAFCO THRESHOLDS (adult cat)');
  console.log(`   Protein min: ${proteinMin}% DMB`);
  console.log(`   Fat min:     ${fatMin}% DMB`);

  // ─── Step 3: Sub-nutrient scores ──────────────────────
  // Protein curve
  const pIdealLow = proteinMin * 1.15;  // 29.9
  const pIdealHigh = proteinMin * 2.0;   // 52.0
  const pExcess = proteinMin * 2.5;      // 65.0
  const proteinScore = 70 + ((proteinDmb - pIdealLow) / (pIdealHigh - pIdealLow)) * 30;

  // Cat fat curve (decoupled)
  // fatDmb = 22.73, between idealHigh (20) and excess (25) → plateau 100
  const fatScore = 100;

  // Fiber: 4.55% → ≤5.0 bracket → 90
  const fiberScore = 90;

  // Carbs: 18.18% → cat ≤25 bracket → 80
  const carbScore = 80;

  console.log('');
  console.log('3. SUB-NUTRIENT SCORES');
  console.log(`   Protein: ${proteinDmb.toFixed(2)}% DMB`);
  console.log(`     idealLow=${pIdealLow}, idealHigh=${pIdealHigh}, excess=${pExcess}`);
  console.log(`     In ideal range → linear(${proteinDmb.toFixed(4)}, ${pIdealLow}, ${pIdealHigh}, 70, 100)`);
  console.log(`     = 70 + (${(proteinDmb - pIdealLow).toFixed(4)} / ${(pIdealHigh - pIdealLow).toFixed(1)}) × 30`);
  console.log(`     = 70 + ${(((proteinDmb - pIdealLow) / (pIdealHigh - pIdealLow)) * 30).toFixed(4)}`);
  console.log(`     = ${proteinScore.toFixed(4)}`);
  console.log(`   Fat: ${fatDmb.toFixed(2)}% DMB`);
  console.log(`     Cat curve: min=9, idealLow=12, idealHigh=20, excess=25`);
  console.log(`     ${fatDmb.toFixed(2)} is in [20, 25) → plateau → ${fatScore}`);
  console.log(`   Fiber: ${fiberDmb.toFixed(2)}% DMB → ≤5.0 bracket → ${fiberScore}`);
  console.log(`   Carbs: ${carbDmb.toFixed(2)}% DMB → cat ≤25 bracket → ${carbScore}`);

  // ─── Step 4: Weighted sum ─────────────────────────────
  const pW = proteinScore * 0.45;
  const fW = fatScore * 0.20;
  const fiW = fiberScore * 0.10;
  const cW = carbScore * 0.25;
  const rawBucket = pW + fW + fiW + cW;

  console.log('');
  console.log('4. WEIGHTED SUM (cat weights: 45/20/10/25)');
  console.log(`   Protein: ${proteinScore.toFixed(4)} × 0.45 = ${pW.toFixed(4)}`);
  console.log(`   Fat:     ${fatScore} × 0.20 = ${fW.toFixed(4)}`);
  console.log(`   Fiber:   ${fiberScore} × 0.10 = ${fiW.toFixed(4)}`);
  console.log(`   Carbs:   ${carbScore} × 0.25 = ${cW.toFixed(4)}`);
  console.log(`   Raw sum: ${rawBucket.toFixed(4)}`);
  console.log(`   Rounded: ${Math.round(rawBucket)}`);

  // ─── Step 5: Actual function output ───────────────────
  const result = scoreNutritionalProfile(input);

  console.log('');
  console.log('5. ACTUAL FUNCTION OUTPUT');
  console.log(`   bucketScore:  ${result.bucketScore}`);
  console.log(`   subScores:    protein=${result.subScores.protein.toFixed(4)}, fat=${result.subScores.fat}, fiber=${result.subScores.fiber}, carbs=${result.subScores.carbs}`);
  console.log(`   dataQuality:  ${result.dataQuality}`);
  console.log(`   modifiers:    ${result.modifiersApplied.length}`);
  console.log(`   missingFields: [${result.missingFields.join(', ')}]`);
  console.log('');

  // ─── Assertions ───────────────────────────────────────
  expect(result.bucketScore).toBe(90);
  expect(result.subScores.protein).toBeCloseTo(proteinScore, 4);
  expect(result.subScores.fat).toBe(100);
  expect(result.subScores.fiber).toBe(90);
  expect(result.subScores.carbs).toBe(80);
  expect(result.dataQuality).toBe('full');
  expect(result.modifiersApplied).toHaveLength(0);
});
