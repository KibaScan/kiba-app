"""Test parser v2.2 — all fixes including period-stop, guard words, added-to-preserve."""
import re
import unicodedata
import sys
import types

# Stub out imports
config_mod = types.ModuleType('config')
config_mod.get_client = lambda: None
config_mod.BATCH_SIZE = 100
sys.modules['config'] = config_mod

matcher_mod = types.ModuleType('ingredient_matcher')
class FakeResult:
    def __init__(self): self.ingredient_id = None; self.canonical_name = None; self.normalized = ''
class FakeMatcher:
    def __init__(self, *a, **k): self.stats = {}
    def match(self, x): return FakeResult()
    def add_entry(self, x): pass
matcher_mod.IngredientMatcher = FakeMatcher
matcher_mod.load_synonyms = lambda: {}
matcher_mod.normalize_ingredient = lambda x: x.lower().replace(' ', '_')
sys.modules['ingredient_matcher'] = matcher_mod

from parse_ingredients import (
    clean_ingredients_raw, fix_bare_preserved_with, split_recipes,
    extract_preservative, extract_flavor_species, validate_token,
    strip_leading_conjunction, extract_primary_name, detect_space_delimited,
    tokenize, expand_packs
)

passed = 0
failed = 0

def check(name, actual, expected):
    global passed, failed
    if actual == expected:
        passed += 1
        print(f'  \u2713 {name}')
    else:
        failed += 1
        print(f'  \u2717 {name}')
        print(f'    GOT:      {repr(actual)}')
        print(f'    EXPECTED: {repr(expected)}')

# === ORIGINAL v2.1 REGRESSION TESTS ===

print('=== Fix 1: Bare preserved-with ===')
check('basic', fix_bare_preserved_with('Chicken Fat, preserved with Mixed Tocopherols, Salt'),
    'Chicken Fat (preserved with Mixed Tocopherols), Salt')
check('naturally', fix_bare_preserved_with('Beef Fat, naturally preserved with BHA and Citric Acid, Corn'),
    'Beef Fat (naturally preserved with BHA and Citric Acid), Corn')
check('already parens', fix_bare_preserved_with('Chicken Fat (Preserved With Mixed Tocopherols), Salt'),
    'Chicken Fat (Preserved With Mixed Tocopherols), Salt')
check('end of list', fix_bare_preserved_with('Chicken Fat, preserved with Mixed Tocopherols'),
    'Chicken Fat (preserved with Mixed Tocopherols)')

print('\n=== Fix 2: Missing open paren ===')
r, s = clean_ingredients_raw('Chicken Fat preserved with mixed tocopherols), Salt')
check('preserved with paren', '(preserved with mixed tocopherols)' in r, True)
r, s = clean_ingredients_raw('Salmon Oil a source of DHA), Taurine')
check('a source of paren', '(a source of DHA)' in r, True)

print('\n=== Fix 3/4/5: Recipe split guards ===')
check('real split', len(split_recipes('Chicken & Beef: Chicken, Salt. Turkey & Lamb: Turkey, Salt')) > 1, True)
check('no split single', len(split_recipes('Chicken, Meal, Rice, Salt')) == 1, True)
check('Ingredients label guarded',
    all(r[0] != 'Ingredients' for r in split_recipes(
        'Beef Cheese: Ingredients: Chicken, Water. Ham: Ingredients: Pork, Water')), True)
check('Vitamins guarded', len(split_recipes('Chicken, Vitamins: E, Niacin. Minerals: Zinc, Iron')) == 1, True)

print('\n=== Fix 6: Flavor species ===')
check('chicken', extract_flavor_species('Natural Flavor (Source Of Roasted Chicken Flavor)'), 'chicken')
check('beef', extract_flavor_species('Natural Flavors (Beef)'), 'beef')
check('crab', extract_flavor_species('Natural Flavor (Crab)'), 'crab')
check('not flavor', extract_flavor_species('Chicken Fat (Preserved With Mixed Tocopherols)'), None)
check('no parens', extract_flavor_species('Natural Flavor'), None)

print('\n=== Fix 6 end-to-end ===')
token = 'Natural Flavor (Source Of Roasted Chicken Flavor)'
species = extract_flavor_species(token)
primary = extract_primary_name(token)
if species and re.match(r'natural\s+flavou?rs?$', primary, re.IGNORECASE):
    primary = f'Natural {species.title()} Flavor'
check('full pipeline', primary, 'Natural Chicken Flavor')

print('\n=== Fix 7: (A Preservative) ===')
check('(A Preservative)', extract_preservative('Sorbic Acid (A Preservative)'), '__self__')
check('(Preservative)', extract_preservative('BHA (Preservative)'), '__self__')
check('(Used As A Preservative)', extract_preservative('BHA (Used As A Preservative)'), '__self__')
check('Preserved With', extract_preservative('Chicken Fat (Preserved With Mixed Tocopherols)'), 'Mixed Tocopherols')
check('X Used As A Preservative', extract_preservative('Animal Fat (BHA Used As A Preservative)'), 'BHA')

print('\n=== Fix 8: validate_token ===')
check('reject bare preserved', validate_token('preserved with Mixed Tocopherols'), False)
check('allow Mixed Tocopherols', validate_token('Mixed Tocopherols'), True)
check('allow Chicken Fat', validate_token('Chicken Fat'), True)

print('\n=== Fix 9: Accented chars ===')
r, _ = clean_ingredients_raw('Roasted Chicken Entr\xe9e With Sweet Potatoes')
check('entree', 'Entree' in r, True)
r, _ = clean_ingredients_raw('p\xe2t\xe9 Recipe With Salmon')
check('pate', 'pate' in r.lower(), True)

# === NEW v2.2 TESTS ===

print('\n' + '='*60)
print('v2.2 FIXES (10, 11, 12)')
print('='*60)

print('\n=== Fix 10: Preserved-with stops at period ===')
check('stops at period (recipe boundary)',
    fix_bare_preserved_with('Chicken Fat, preserved with Mixed Tocopherols. Beef: Beef, Salt'),
    'Chicken Fat (preserved with Mixed Tocopherols). Beef: Beef, Salt')
check('stops at period (product code)',
    fix_bare_preserved_with('Salmon Oil, Preserved With Mixed Tocopherols. A287624.'),
    'Salmon Oil (Preserved With Mixed Tocopherols). A287624.')
check('still works with comma',
    fix_bare_preserved_with('Chicken Fat, preserved with Mixed Tocopherols, Salt'),
    'Chicken Fat (preserved with Mixed Tocopherols), Salt')
check('naturally preserved stops at period',
    fix_bare_preserved_with('Beef Fat, naturally preserved with BHA. Turkey: Turkey'),
    'Beef Fat (naturally preserved with BHA). Turkey: Turkey')
check('multi-word preservative still works',
    fix_bare_preserved_with('Fat, Preserved With Mixed Tocopherols And Citric Acid, Salt'),
    'Fat (Preserved With Mixed Tocopherols And Citric Acid), Salt')

print('\n=== Fix 11: Expanded guard words ===')
check('Nutritional Supplements guarded',
    len(split_recipes('Celery, Nutritional Supplements: Zinc, Iron. Minerals: Calcium')) == 1, True)
check('See guarded',
    len(split_recipes('See individual items: Spanish Paella. Asian Stir Fry: Chicken')) == 1, True)
check('New guarded',
    len(split_recipes('New: Rainbow Trout, Catfish. Original: Salmon, Rice')) == 1, True)
check('Contains guarded',
    len(split_recipes('Chicken, Contains 2% Or Less Of: Vitamin E, Niacin, Zinc')) == 1, True)
check('real recipes still split',
    len(split_recipes('Chicken & Beef: Chicken, Salt. Turkey & Lamb: Turkey, Salt')) > 1, True)
check('filet mignon still splits',
    len(split_recipes('Filet Mignon: Beef, Salt. Rotisserie Chicken: Chicken, Salt')) > 1, True)
check('no-space after period splits',
    len(split_recipes('Beef & Kale: Beef, Liver, Kale.Chicken & Beans: Chicken, Beans')) > 1, True)

print('\n=== Fix 12: "added to preserve freshness" ===')
check('to preserve freshness',
    fix_bare_preserved_with('Kale, Mixed Tocopherols added to preserve freshness, Niacin'),
    'Kale, Mixed Tocopherols, Niacin')
check('as a preservative',
    fix_bare_preserved_with('Spinach, Mixed Tocopherols added as a preservative, Zinc'),
    'Spinach, Mixed Tocopherols, Zinc')
check('for freshness',
    fix_bare_preserved_with('Carrots, Mixed Tocopherols added for freshness, Vitamin E'),
    'Carrots, Mixed Tocopherols, Vitamin E')
check('normal preserved-with unaffected',
    fix_bare_preserved_with('Chicken Fat, preserved with Mixed Tocopherols, Salt'),
    'Chicken Fat (preserved with Mixed Tocopherols), Salt')

# === CONFLICT & REGRESSION CHECKS ===

print('\n' + '='*60)
print('CONFLICT & REGRESSION CHECKS')
print('='*60)

print('\n=== Tokenizer ===')
tokens = tokenize('Animal Fat (Source Of Omega 6 [Preserved With BHA & Citric Acid]), Salt, Taurine')
check('nested brackets: 3 tokens', len(tokens), 3)
tokens = tokenize('fish Oil (Source Of Dha), Minerals (Potassium Chloride, Magnesium Proteinate), Salt')
check('mineral pack stays together: 3 tokens', len(tokens), 3)

print('\n=== expand_packs ===')
expanded = expand_packs(tokenize('Chicken, VITAMINS [Vitamin E, Niacin, Folic Acid], Salt'))
check('vitamin pack → 5 tokens', len(expanded), 5)
check('first=Chicken', expanded[0], 'Chicken')
check('last=Salt', expanded[-1], 'Salt')
expanded = expand_packs(tokenize('Beef, Minerals (Zinc Sulfate, Iron Sulfate), Taurine'))
check('mineral pack → 4 tokens', len(expanded), 4)

print('\n=== extract_primary_name ===')
check('strips preservative', extract_primary_name('Chicken Fat (Preserved With Mixed Tocopherols)'), 'Chicken Fat')
check('strips source', extract_primary_name('Fish Oil (Source Of DHA)'), 'Fish Oil')
check('no parens', extract_primary_name('Brown Rice'), 'Brown Rice')

print('\n=== strip_leading_conjunction ===')
check('and Biotin', strip_leading_conjunction('and Biotin'), 'Biotin')
check('Mono And (not leading)', strip_leading_conjunction('Mono And Dicalcium Phosphate'), 'Mono And Dicalcium Phosphate')

print('\n=== clean_ingredients_raw contamination ===')
_, s = clean_ingredients_raw('About This Item — Details — These treats')
check('About This Item', s, 'contaminated')
_, s = clean_ingredients_raw('Rated 5 out of 5 stars')
check('review text', s, 'contaminated')
_, s = clean_ingredients_raw('.flyout__help { display: block }')
check('CSS', s, 'contaminated')
_, s = clean_ingredients_raw('')
check('empty', s, 'empty')
_, s = clean_ingredients_raw('Chicken, Rice, Salt')
check('normal', s, 'clean')

print('\n=== detect_space_delimited ===')
check('double-space', ', ' in detect_space_delimited('Lamb Meal  Oatmeal  Brown Rice  Chicken Fat  Salt  Taurine  Zinc'), True)
check('normal unchanged', detect_space_delimited('Chicken, Rice, Salt'), 'Chicken, Rice, Salt')

print('\n=== validate_token edge cases ===')
check('>80 chars', validate_token('a' * 81), False)
check('single char', validate_token('x'), False)
check('CSS artifact', validate_token('.flyout__help_center'), False)
check('DL-Methionine OK', validate_token('DL-Methionine'), True)
check('Red 40 OK', validate_token('Red 40'), True)
check('Salt OK', validate_token('Salt'), True)

print('\n=== Integration: fix_bare → split_recipes → tokenize ===')
# Two-recipe variety pack with bare preserved-with
text = 'Chicken Recipe: Chicken Fat, preserved with Mixed Tocopherols, Salt. Beef Recipe: Beef, Water, Salt'
text = fix_bare_preserved_with(text)
check('preserved-with wrapped', '(preserved with Mixed Tocopherols)' in text, True)
check('Beef Recipe intact', 'Beef Recipe: Beef' in text, True)
recipes = split_recipes(text)
check('two recipes found', len(recipes), 2)
if len(recipes) == 2:
    check('recipe 1 has preserved-with', '(preserved with Mixed Tocopherols)' in recipes[0][1], True)
    check('recipe 2 clean', recipes[1][1].strip(), 'Beef, Water, Salt')

# "added to preserve" then tokenize
text2 = 'Kale, Mixed Tocopherols added to preserve freshness, Niacin, Taurine'
text2 = fix_bare_preserved_with(text2)
tokens = tokenize(text2)
check('Mixed Tocopherols as own token', 'Mixed Tocopherols' in tokens, True)
check('no junk token', not any('added to preserve' in t.lower() for t in tokens), True)
check('Kale present', 'Kale' in tokens, True)
check('Niacin present', 'Niacin' in tokens, True)

# === DONE ===
print(f'\n{"="*60}')
print(f'RESULTS: {passed} passed, {failed} failed')
if failed:
    sys.exit(1)
