import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import toxicFoods from './toxic_foods.json' with { type: 'json' };

const UPVM_REGEX =
  /\b(cure|prevent|diagnose|((helps with|good for|treats)\s+(?:\S+\s+)*?(disease|condition|allergy|arthritis|kidney|liver|cancer|diabetes|seizure)))\b/i;

Deno.test('UPVM allows "Peanut Butter Dog Treat"', () => {
  assertEquals(UPVM_REGEX.test('Peanut Butter Dog Treat'), false);
});

Deno.test('UPVM blocks "treats arthritis" (zero intervening words)', () => {
  assertEquals(UPVM_REGEX.test('Wonder stew that treats arthritis'), true);
});

Deno.test('UPVM blocks "treats chronic arthritis" (intervening word)', () => {
  assertEquals(UPVM_REGEX.test('Recipe that treats chronic arthritis pain'), true);
});

Deno.test('UPVM blocks "helps with kidney disease"', () => {
  assertEquals(UPVM_REGEX.test('helps with kidney disease'), true);
});

Deno.test('UPVM blocks "cure"', () => {
  assertEquals(UPVM_REGEX.test('this will cure your dog'), true);
});

Deno.test('UPVM allows "good for shedding" (out of scope, defer to human review)', () => {
  assertEquals(UPVM_REGEX.test('good for shedding'), false);
});

Deno.test('toxic_foods.json has chocolate entry', () => {
  const entries = (toxicFoods as { toxics: { name: string }[] }).toxics;
  const chocolate = entries.find((e) => e.name.toLowerCase().includes('chocolate'));
  assertEquals(!!chocolate, true);
});

Deno.test('toxic_foods.json has at least 30 entries', () => {
  const entries = (toxicFoods as { toxics: unknown[] }).toxics;
  assertEquals(entries.length >= 30, true);
});
