# Tier 4 Processing Aids, Emulsifiers, Humectants & Miscellaneous Additives — 19 Entries

**SKIP NOTE — Entry #18 (brewer_dried_yeast):**
"Brewers Dried Yeast" (AAFCO Section 96.4) and "brewers yeast" are the **same ingredient**. "Brewers yeast" is the informal/colloquial name for "Brewers Dried Yeast" as defined by AAFCO: *"the dried, non-fermentative, non-extracted yeast of the botanical classification Saccharomyces resulting as a by-product from the brewing of beer and ale."* Purina confirms: "brewer's yeast, also known as brewers dried yeast." The database should map `brewer_dried_yeast` → `brewers_yeast` (Tier 2 entry). No duplicate entry created.

---

## 1. Glycerin

```
canonical_name: glycerin
display_name: Glycerin (Glycerol)
category: humectant
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Glycerol is a colorless, viscous, sweet-tasting sugar alcohol (propane-1,2,3-triol) derived from plant or animal fats via hydrolysis or saponification.

base_description: A humectant used in semi-moist pet foods and soft treats to retain moisture, lower water activity, and maintain chewy texture.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels. Glycerin replaced propylene glycol — which was banned in cat food (21 CFR 589.1001) due to Heinz body hemolytic anemia — and does not share that toxicity.

tldr: Glycerin is the ingredient that keeps soft treats and semi-moist foods chewy instead of drying out. It's derived from plant or animal fats, is FDA-approved for both human and animal food, and is safe at the levels used in commercial pet products. Nothing to worry about here.

detail_body: Glycerol (vegetable glycerin) is FDA GRAS for animal feed use under 21 CFR 582.1320. It functions primarily as a humectant — retaining moisture and lowering water activity to inhibit microbial growth — in semi-moist foods and soft/chewy treats, where it typically appears at 10–15% of the formulation. Glycerol is a normal metabolic intermediate in all mammals, serving as the backbone of triglycerides and phospholipids, and is efficiently metabolized through standard hepatic pathways.

Glycerin gained widespread use in pet food after propylene glycol was banned in cat food in the mid-1990s due to Heinz body hemolytic anemia in cats. Glycerol is chemically distinct from propylene glycol and does not cause this effect. At typical inclusion levels, no adverse effects have been documented in dogs or cats (Beynen, 2019). Excessive oral intake could theoretically cause osmotic GI effects, but this is not achievable through normal feeding of commercial products. The EFSA FEEDAP Panel considers glycerol safe for all animal species at feed-relevant levels.

position_context: Glycerin can appear at relatively high levels in semi-moist products (10–15%), but it is rated neutral regardless of position. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 182.1320 / 582.1320 — GRAS Substances; Beynen AC (2019), Glycerol in petfood, ResearchGate

primary_concern_basis: Processing aid (standard)
```

---

## 2. Sorbitol

```
canonical_name: sorbitol
display_name: Sorbitol (D-Glucitol)
category: humectant
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Sorbitol is a six-carbon sugar alcohol (polyol) produced by hydrogenation of glucose, occurring naturally in apples, pears, and stone fruits.

base_description: A sugar alcohol humectant used in semi-moist pet foods and treats to retain moisture and lower water activity, with lower caloric density and glycemic impact than sucrose.

dog_context: No additional dog-specific concerns at typical inclusion levels. Unlike xylitol, sorbitol does not cause insulin release or hypoglycemia in dogs.

cat_context: No additional cat-specific concerns at typical inclusion levels. Cats lack functional sweet taste receptors (Tas1r2 pseudogene), so sorbitol's sweetening function provides no palatability benefit in cat food.

tldr: Sorbitol is a sugar alcohol that helps keep semi-moist pet foods and treats from drying out. Unlike xylitol (which is dangerous to dogs), sorbitol does not cause insulin release or blood sugar crashes. It's safe in the small amounts used in pet food.

detail_body: Sorbitol is FDA GRAS under 21 CFR 184.1835 and has been evaluated by EFSA, FAO/WHO, and JECFA with no toxicity or carcinogenic effects found. It functions as a humectant, mild sweetener, and water activity depressant in semi-moist pet foods, typically at levels up to 12% in studied formulations. Sorbitol is slowly and incompletely absorbed in the small intestine; unabsorbed sorbitol draws water into the colon via osmotic effect, which is why high doses can cause loose stools or diarrhea. In humans, the FDA notes that daily intake exceeding 50g may produce laxative effects.

In dogs, a study with semi-moist diets containing 12% sorbitol showed slightly looser stools but not overt diarrhea at normal feeding rates (Beynen, 2019). Critically, sorbitol does NOT cause the insulin-mediated hypoglycemia or hepatotoxicity associated with xylitol — this distinction is important for pet owners who may conflate sugar alcohols. At typical pet food inclusion levels (well below the osmotic diarrhea threshold for either species), sorbitol is a benign processing aid. It is metabolized primarily via hepatic conversion to fructose and glucose through standard pathways unaffected by feline enzyme deficiencies.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 184.1835 — GRAS Substances; Beynen AC (2019), Sorbitol and sorbate in petfood, ResearchGate

primary_concern_basis: Processing aid (standard)
```

---

## 3. Molasses

```
canonical_name: molasses
display_name: Molasses
category: flavor_enhancer
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: caution
cat_base_severity: caution

definition: Molasses is a thick, dark, viscous syrup produced as a byproduct of sugarcane or sugar beet processing, containing approximately 50–70% sugars (sucrose, glucose, fructose).

base_description: A sugarcane byproduct used as a palatability enhancer and binder in some kibble and treats, functioning primarily as an added sugar with no nutritional necessity in pet food.

dog_context: Added sugars contribute to dental disease, obesity risk, and blood sugar elevation. Dogs with diabetes or weight management concerns are most affected. No unique metabolic pathway concern beyond the sugar content itself.

cat_context: Cats lack functional sweet taste receptors (Tas1r2 pseudogene), so molasses provides zero palatability benefit in cat food. Cats also lack hepatic glucokinase and have delayed insulin responses, making them less efficient at clearing postprandial glucose loads than dogs. Added sugars are metabolically unnecessary for obligate carnivores.

tldr: Molasses is essentially sugar — it's a sweet syrup used to make food taste better and hold together. It offers no nutritional benefit to your pet and can contribute to weight gain and dental problems over time, just like sugar in human food. It's not dangerous, but it's an ingredient worth noting.

detail_body: Molasses is defined by AAFCO (Category 63) as the product obtained in the manufacture of sucrose from sugarcane. It contains approximately 50–70% simple sugars and is used in pet food primarily as a palatability enhancer and binding agent, typically at 1–5% inclusion. While it provides trace minerals (iron, calcium, potassium — particularly in blackstrap varieties), these are nutritionally insignificant at typical inclusion levels and do not justify the sugar content.

The concern with molasses mirrors that of other added sugars in pet food: it provides rapidly absorbed simple carbohydrates with no nutritional necessity, contributing to dental plaque formation, caloric excess, and glycemic load. This is consistent with the caution rating applied to sugar and corn syrup in Tier 1.5. Molasses is not toxic and does not pose an acute health risk. However, its presence — particularly at higher positions on the ingredient label — indicates a formulation relying on sugar for palatability rather than quality protein or fat ingredients. For cats specifically, the addition is metabolically counterproductive: cats cannot taste sweetness and have limited capacity to handle glucose loads efficiently.

position_context: This ingredient's impact depends on how much is used. Higher on the label = more concern.

citations_display: AAFCO Official Publication — Category 63, Molasses and Molasses Products

primary_concern_basis: Added sugar
```

---

## 4. Dextrose

```
canonical_name: dextrose
display_name: Dextrose (D-Glucose Monohydrate)
category: processing_aid
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: caution
cat_base_severity: caution

definition: Dextrose is D-glucose monohydrate, a simple monosaccharide produced commercially by enzymatic hydrolysis of corn starch, chemically identical to blood glucose.

base_description: A simple sugar used as a processing aid, fermentation substrate, Maillard browning agent, and light sweetener in pet food, functioning as an added sugar when present at meaningful levels.

dog_context: As pure glucose (glycemic index 100), dextrose causes rapid blood sugar elevation. Inappropriate for diabetic dogs. At low inclusion levels as a processing aid, glycemic contribution is minimal within the context of a balanced diet.

cat_context: Cats lack hepatic glucokinase and have delayed, reduced insulin responses to glucose loads — postprandial glucose peaks at ~120 minutes (vs ~60 minutes in dogs) with return to baseline taking ~240 minutes. Cats cannot taste sweetness, so dextrose provides no palatability benefit. Added glucose is metabolically unnecessary for obligate carnivores.

tldr: Dextrose is just another name for glucose — simple sugar. In small amounts it's used as a processing aid during manufacturing, but at higher levels it's an added sugar that provides empty calories. Like other sugars, it offers no nutritional benefit to your pet and can contribute to weight gain and dental issues.

detail_body: Dextrose (D-glucose monohydrate) is FDA GRAS under 21 CFR 184.1857. In pet food manufacturing, it serves multiple functions: as a substrate for Maillard browning reactions (contributing color and flavor development during cooking), as a water activity depressant for shelf stability, and as a rapid energy source in veterinary products and milk replacers. It is the reference standard for glycemic index (GI = 100 by definition), meaning it causes the fastest possible blood glucose elevation among dietary carbohydrates.

At low inclusion levels — where dextrose functions purely as a processing aid for browning reactions or as a carrier in premixes — the glycemic contribution is negligible within a balanced diet. However, when used at higher levels as a sweetener or palatability enhancer, dextrose becomes an added sugar with the same concerns as sucrose or corn syrup: caloric excess, dental disease risk, and inappropriate glycemic load. The caution rating is applied for consistency with other added sugars in the database. In veterinary practice, dextrose is used therapeutically (5% IV solution for hypoglycemia), confirming its safety at appropriate doses — the concern is not toxicity but nutritional appropriateness as a dietary ingredient.

position_context: This ingredient's impact depends on how much is used. Higher on the label = more concern. When listed near the end of the ingredient list as a minor processing aid, its contribution is negligible.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 184.1857 — GRAS Substances

primary_concern_basis: Added sugar
```

---

## 5. Soy Lecithin

```
canonical_name: soy_lecithin
display_name: Soy Lecithin
category: emulsifier
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Soy lecithin is a complex mixture of phospholipids (phosphatidylcholine, phosphatidylethanolamine, phosphatidylinositol), triglycerides, and fatty acids extracted from soybean oil during degumming.

base_description: An emulsifier derived from soybeans that helps fats and water mix uniformly in kibble coatings and wet food, preventing ingredient separation and improving texture.

dog_context: Soy lecithin is derived from soybeans, and soy is a documented allergen in approximately 6% of dogs with confirmed cutaneous adverse food reactions (Mueller et al., 2016). However, soy lecithin is highly refined and contains negligible allergenic protein. It is extremely unlikely to trigger reactions even in soy-sensitive dogs, consistent with human allergy guidance for refined soy lecithin.

cat_context: No additional cat-specific concerns at typical inclusion levels. Soy allergy is not documented as a significant feline food allergen (Mueller et al., 2016). EFSA considers lecithin safe for all target species including cats with no maximum content limit needed.

tldr: Soy lecithin is an emulsifier — it helps fat and water blend together smoothly in your pet's food. Even though it comes from soybeans, the manufacturing process removes virtually all of the soy protein that causes allergies. It's safe and used at very small levels.

detail_body: Soy lecithin is FDA GRAS under 21 CFR 184.1400 and EFSA's FEEDAP Panel has concluded it is safe for all animal species with no need for maximum content limits in animal feed. It is used in pet food at approximately 0.1–1.0% as an emulsifier, primarily in kibble fat coatings and wet food formulations. Lecithin prevents fat-water phase separation, improves palatability, enhances fat-soluble vitamin absorption (A, D, E, K), and serves as a source of choline.

The soy origin warrants a note on allergenicity. In the definitive systematic review of food allergies in dogs (Mueller, Olivry & Prélaud, 2016, BMC Vet Res), soy accounted for 6% of confirmed cutaneous adverse food reactions in dogs — lower than beef (34%), dairy (17%), chicken (15%), or wheat (13%). Soy was not identified among reported allergens in cats. Critically, soy lecithin consists primarily of phospholipids and contains negligible soy protein after processing. The allergenic component of soy is its protein fraction (particularly glycinin and β-conglycinin), which is effectively removed during lecithin extraction. Both FDA and EFSA do not require special allergen labeling for highly refined soy lecithin in human food, reflecting the negligible residual protein content.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 184.1400 — GRAS Substances; Mueller RS, Olivry T, Prélaud P (2016), Critically appraised topic on adverse food reactions: common food allergen sources in dogs and cats, BMC Vet Res 12:9

primary_concern_basis: Soy-derived (allergen note)
```

---

## 6. Cellulose Gum

```
canonical_name: cellulose_gum
display_name: Cellulose Gum (Carboxymethylcellulose)
category: emulsifier
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Sodium carboxymethylcellulose (CMC) is a water-soluble, anionic cellulose derivative produced by treating wood pulp or cotton linters with chloroacetic acid and sodium hydroxide.

base_description: A thickener and stabilizer used in wet and canned pet food to create consistent gravy or sauce texture and prevent ingredient separation during storage.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels. CMC is non-digestible and passes through the GI tract without metabolic burden.

tldr: Cellulose gum is a thickener that gives wet pet food its consistent gravy or sauce texture. It's made from plant fiber (cellulose) and passes through your pet's digestive system without being absorbed. It's been specifically evaluated and confirmed safe for dogs and cats by food safety authorities.

detail_body: Sodium carboxymethylcellulose (Na-CMC) is classified as GRAS with specific limitations (GRAS/FS) by FDA and was specifically evaluated by EFSA's FEEDAP Panel in 2020, which concluded it is safe for all animal species (EFSA Journal 2020;18(7):6211). It is used in canned and wet pet food at typical levels of 0.1–0.5% to create viscous gravies and sauces, reduce fat separation, and maintain uniform product texture during shelf life. CMC is not absorbed or digested — it functions as inert soluble fiber and is excreted intact.

Some rodent studies at concentrations far above typical food levels have suggested that CMC may alter gut microbiome composition and thin the intestinal mucus layer. These findings have not been replicated in companion animals, and the doses used in such studies are not representative of pet food inclusion levels. At normal use concentrations in commercial pet food, no documented adverse GI effects exist for dogs or cats. The ingredient has no caloric contribution and does not interact with any feline-specific metabolic pathways.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; EFSA FEEDAP Panel (2020), Safety and efficacy of sodium carboxymethyl cellulose for all animal species, EFSA Journal 18(7):6211

primary_concern_basis: Processing aid (standard)
```

---

## 7. Agar-Agar

```
canonical_name: agar_agar
display_name: Agar-Agar
category: emulsifier
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Agar is a hydrophilic polysaccharide consisting of alternating galactose units, extracted from red seaweed (Rhodophyceae), primarily species of Gelidium and Gracilaria.

base_description: A seaweed-derived gelling agent used in canned pet food to create firm gel structure, maintain product shape, and stabilize texture at very low inclusion levels.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels. Agar is non-nutritive and does not interact with obligate carnivore metabolic pathways.

tldr: Agar-agar is a natural gelling agent from seaweed — the same ingredient used to make jelly-like textures in human food. It gives canned pet food its shape and consistency. It passes through digestion without being absorbed and is completely safe.

detail_body: Agar is FDA GRAS for human food use under 21 CFR 182.7115 and has been assessed by JECFA (1974) and the EU Scientific Committee for Food (1989) as safe. EFSA's FEEDAP Panel confirmed its efficacy as a gelling agent, thickener, and stabilizer in canned pet feed, though a formal safety conclusion for pets was limited by a data submission gap — not by any identified hazard. It is used in canned pet food at typically 0.1–2.0%, forming firm, thermoreversible gels at very low concentrations due to its strong gelling ability.

Agar is not significantly digested or absorbed in the mammalian GI tract. It acts as inert dietary fiber with no caloric contribution, no metabolic burden, and no interaction with species-specific enzyme systems. Published reviews of algal hydrocolloids (including agar and alginate) describe these ingredients as "primarily nontoxic" with no disputed safety profile for food use. It is frequently used as a "clean label" natural alternative to gelatin or synthetic gelling agents.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 182.7115 — GRAS Substances; EFSA FEEDAP Panel, Scientific opinion on agar-agar as feed additive for pets

primary_concern_basis: Processing aid (standard)
```

---

## 8. Sodium Alginate

```
canonical_name: sodium_alginate
display_name: Sodium Alginate
category: emulsifier
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Sodium alginate is the sodium salt of alginic acid, a linear polysaccharide of mannuronic and guluronic acid units extracted from brown algae (Phaeophyceae).

base_description: A seaweed-derived thickener and gelling agent used in wet pet food and gravy formulations to create viscous sauces, stabilize texture, and prevent ingredient separation.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels. EFSA established a safe maximum of 40,000 mg/kg complete feed for cats and dogs — far above typical use levels.

tldr: Sodium alginate is a natural thickener from seaweed that gives wet pet food its gravy-like consistency. It's the same ingredient used in human food manufacturing. It passes through digestion without being absorbed and is safe at the levels used in pet food.

detail_body: Sodium alginate is FDA GRAS under 21 CFR 184.1724, and EFSA's FEEDAP Panel (2017) concluded it is safe for cats and dogs at up to 40,000 mg/kg complete feed (4% on a dry matter basis) — well above typical use levels of 0.1–1.0%. It functions as a thickener, gelling agent (forms gels with calcium ions), stabilizer, and binder in wet and canned pet food formulations. Alginates are not significantly absorbed in the GI tract and act as inert dietary fiber.

A theoretical concern exists regarding mineral binding: alginates can chelate divalent cations (calcium, iron, zinc) in the GI tract, potentially reducing mineral bioavailability. At typical pet food inclusion levels below 1%, this effect is minimal and not clinically significant. Manufacturers formulating at higher inclusion levels should account for potential mineral sequestration. No documented adverse effects exist for dogs or cats at normal food-grade use concentrations, and published reviews classify alginates as "primarily nontoxic."

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 184.1724 — GRAS Substances; EFSA FEEDAP Panel (2017), Safety and efficacy of alginates for all animal species, EFSA Journal

primary_concern_basis: Processing aid (standard)
```

---

## 9. Citric Acid

```
canonical_name: citric_acid
display_name: Citric Acid
category: acidifier
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Citric acid (2-hydroxy-1,2,3-propanetricarboxylic acid) is a weak organic acid occurring naturally in citrus fruits, produced commercially via fermentation by Aspergillus niger on carbohydrate substrates.

base_description: An antioxidant preservative, pH adjuster, and metal chelator used in pet food to slow fat oxidation and extend shelf life, typically as part of the fat preservative system.

dog_context: No additional dog-specific concerns at typical inclusion levels. A single Purdue study (Glickman et al., 2000) suggested a possible association between citric acid in moistened food and GDV (bloat) in large-breed dogs, but this finding has not been replicated, had numerous confounders, and is not considered reliable by most veterinary nutritionists.

cat_context: No additional cat-specific concerns at typical inclusion levels. Citric acid is a normal Krebs cycle intermediate in all mammals.

tldr: Citric acid is the same natural acid found in lemons and oranges. In pet food, it's used in tiny amounts to keep fats from going rancid and to adjust acidity. It's a normal part of every animal's metabolism and is completely safe. You may have heard claims about bloat risk — these are based on a single unreplicated study and are not supported by veterinary consensus.

detail_body: Citric acid is FDA GRAS for both human food (21 CFR 184.1033) and animal feed (21 CFR 582.1033) with no quantitative limits — use is governed by Good Manufacturing Practice. It appears in approximately 7–26% of commercial dry dog food formulas, typically at less than 0.5% of the formulation, functioning as an antioxidant synergist that chelates pro-oxidant metals (iron, copper) and slows fat rancidity. It also serves as a pH adjuster and mild flavor enhancer.

The only documented concern is a single epidemiological study (Glickman et al., 2000, Purdue University) that suggested moistening citric acid-containing food might increase bloat risk in large-breed dogs. This finding was observational, not experimental, had significant confounders, has never been replicated, and is considered unreliable by mainstream veterinary nutritionists including Dr. Greg Aldrich of Kansas State University, who characterizes citric acid as "benign to pet health." Citric acid is a normal metabolic intermediate (Krebs/TCA cycle) in all mammals and does not interact with any species-specific enzyme deficiencies. No adverse effects have been documented at pet food inclusion levels in either dogs or cats.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 184.1033 / 582.1033 — GRAS Substances

primary_concern_basis: Processing aid (standard)
```

---

## 10. Calcium Propionate

```
canonical_name: calcium_propionate
display_name: Calcium Propionate
category: preservative
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Calcium propionate is the calcium salt of propionic acid, a short-chain fatty acid that occurs naturally in some cheeses and is produced synthetically by reacting propionic acid with calcium hydroxide.

base_description: A mold inhibitor used in kibble and semi-moist pet foods to prevent fungal growth and extend shelf life without inhibiting yeast, effective primarily in acidic conditions.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels. Propionic acid is metabolized via standard short-chain fatty acid pathways unaffected by feline enzyme deficiencies.

tldr: Calcium propionate is a mold preventer — it stops fungal growth in dry and semi-moist pet foods so they stay safe to eat longer. It's the same preservative used in bread and baked goods. Your pet's body breaks it down into a normal fatty acid and calcium, both of which are harmless.

detail_body: Calcium propionate is FDA GRAS under 21 CFR 184.1221 (human food) and is GRAS for animal feed under 21 CFR Part 582. FDA GRAS Notice GRN 786 further confirms its safety. It is used in pet food at approximately 0.1–0.4% as a fungistatic agent, preventing mold and rope bacteria growth through the release of undissociated propionic acid in acidic conditions (optimal pH < 5.5). The undissociated acid penetrates fungal cell membranes and disrupts electrochemical gradients and enzyme metabolism.

Upon ingestion, calcium propionate is hydrolyzed to propionic acid and calcium. Propionic acid is a normal short-chain fatty acid that is either converted to glucose via the methylmalonyl-CoA pathway or oxidized directly for energy. A BASF (1988) toxicity study in beagle dogs showed no significant adverse effects at feed-relevant doses. High-dose rat studies at 2% inclusion showed altered gut microbiota composition, but these levels far exceed typical pet food use. At standard preservative concentrations, calcium propionate is metabolically benign and provides a small amount of supplemental dietary calcium.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 184.1221 — GRAS Substances; FDA GRAS Notice GRN 786

primary_concern_basis: Processing aid (standard)
```

---

## 11. Potassium Sorbate

```
canonical_name: potassium_sorbate
display_name: Potassium Sorbate
category: preservative
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Potassium sorbate is the potassium salt of sorbic acid (2,4-hexadienoic acid), a weak organic acid originally derived from mountain ash berries, now produced synthetically.

base_description: An antimicrobial preservative used in semi-moist pet foods and treats to inhibit mold, yeast, and fungal growth, extending shelf life in moisture-containing products.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels. Older literature suggesting cat-specific sensitivity to sorbic acid has not been substantiated by subsequent regulatory review. EFSA (2012, 2015) specifically evaluated potassium sorbate for cats and deemed it safe at up to 5,000 mg/kg semi-moist feed. Sorbic acid is metabolized via beta-oxidation like other fatty acids — a pathway unaffected by feline UGT1A6 deficiency.

tldr: Potassium sorbate is a common mold and yeast preventer found in many human foods too. It's been specifically tested and approved for use in cat and dog food by food safety authorities. Your pet's body breaks it down the same way it processes normal dietary fat. Safe and unremarkable.

detail_body: Potassium sorbate is recognized as GRAS by FDA, FAO/WHO, and EFSA. The EFSA FEEDAP Panel specifically evaluated it for dogs and cats in 2012 (EFSA Journal 2012;10(6):2735) and again in 2015 for all animal species (EFSA Journal 2015;13(6):4144), concluding it is safe at maximum concentrations of 3,400 mg/kg feed (equivalent to 2,500 mg sorbic acid/kg). It is used in semi-moist pet food at approximately 0.1–0.5%, where it inhibits microbial growth by releasing undissociated sorbic acid in acidic conditions.

Sorbic acid is metabolized identically to other medium-chain unsaturated fatty acids via hepatic beta-oxidation, yielding ATP, CO₂, and water. This metabolic pathway does not involve glucuronidation, making the feline UGT1A6 pseudogene irrelevant to sorbate metabolism. A 2019 review by Beynen concluded that "maximum contents in commercial, complete dog and cat foods are safe," supported by the absence of adverse event signals from the market. The only theoretical concern involves 2,4-hexadienal (HDE), a minor degradation product, for which Beynen notes dogs and cats "might be more sensitive than rodents" — but this has no documented clinical significance at preservative-level exposures.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; EFSA FEEDAP Panel (2012), EFSA Journal 10(6):2735; EFSA FEEDAP Panel (2015), EFSA Journal 13(6):4144; Beynen AC (2019), Sorbitol and sorbate in petfood, ResearchGate

primary_concern_basis: Processing aid (standard)
```

---

## 12. Silicon Dioxide

```
canonical_name: silicon_dioxide
display_name: Silicon Dioxide (Silica)
category: anti_caking
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Silicon dioxide is an amorphous inorganic compound (SiO₂) occurring naturally in water, plants, and the earth's crust, produced as synthetic amorphous silica or from natural sources such as diatomaceous earth.

base_description: An anti-caking agent used in powdered supplements, vitamin/mineral premixes, and kibble coatings to prevent clumping and maintain ingredient flowability during manufacturing.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels.

tldr: Silicon dioxide is an anti-caking powder that keeps dry ingredients from clumping together during manufacturing. It's chemically inert — your pet's body doesn't absorb or react with it. It passes straight through and is completely harmless at the tiny amounts used.

detail_body: Silicon dioxide is an FDA-approved food additive for animal feed under 21 CFR 573.940, permitted as an anticaking agent, antifoaming agent, carrier, and grinding aid at levels not exceeding 2% by weight of complete feed. The amorphous form used in food and feed is chemically inert and biologically inert — distinct from crystalline silica, which poses occupational inhalation hazards irrelevant to dietary exposure. The FDA Select Committee on GRAS Substances (SCOGS Report No. 61) found no significant tissue accumulation, pathology, or toxicity from ingestion of amorphous silica.

In practice, silicon dioxide is used at levels well below the 2% regulatory maximum, typically in vitamin/mineral premixes, supplement blends, and dry ingredient processing. It is not absorbed in significant amounts, is excreted naturally through the digestive system, and has no species-specific metabolism considerations for dogs or cats. It is one of the most benign processing aids in commercial pet food manufacturing.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 573.940 — Food Additives Permitted in Feed; SCOGS Report No. 61

primary_concern_basis: Anti-caking agent (inert)
```

---

## 13. Calcium Silicate

```
canonical_name: calcium_silicate
display_name: Calcium Silicate
category: anti_caking
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Calcium silicate is an inorganic compound of calcium oxide and silicon dioxide in varying proportions, produced by reacting calcium hydroxide with sodium silicate.

base_description: An anti-caking agent used in powdered mineral premixes and supplements to prevent clumping, improve flowability, and ensure uniform mixing of dry ingredients.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels.

tldr: Calcium silicate is an anti-caking powder used in mineral supplements and premixes to keep ingredients from sticking together. It's insoluble and inert — your pet's body doesn't absorb or react with it. Completely harmless at the tiny levels used.

detail_body: Calcium silicate is an FDA-approved food additive for animal feed under 21 CFR 573.260, permitted as an anticaking agent at levels not exceeding 2% of animal feed. It is also GRAS for human food use (E552 in EU). EFSA's ANS Panel (2018) re-evaluated calcium silicate and found no indication of genotoxicity, developmental toxicity, or confirmed kidney effects despite widespread, long-term use. Absorption of silicates from the GI tract is very low.

In pet food manufacturing, calcium silicate is used almost exclusively in premixes, supplement powders, and mineral blends at functional anti-caking levels — well below the 2% regulatory maximum. It is biologically inert when ingested, insoluble in water and GI fluids, and does not contribute bioavailable calcium or silicon at the trace amounts used. No species-specific concerns exist for dogs or cats, and no adverse effects have been documented at feed-relevant levels in any companion animal species.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 573.260 — Food Additives Permitted in Feed; EFSA ANS Panel (2018), EFSA Journal 16(8):5375

primary_concern_basis: Anti-caking agent (inert)
```

---

## 14. Maltodextrin

```
canonical_name: maltodextrin
display_name: Maltodextrin
category: starch_modifier
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Maltodextrin is a partially hydrolyzed starch (polysaccharide of D-glucose units with dextrose equivalent < 20) produced by enzymatic or acid hydrolysis of corn, rice, potato, or wheat starch.

base_description: A processed starch derivative used as a carrier for flavorings and supplements, a binder in coatings, and a processing aid in pet food manufacturing, with high glycemic index but negligible impact at typical inclusion levels.

dog_context: No additional dog-specific concerns at typical inclusion levels. Maltodextrin has a high glycemic index (GI 85–105), but as a minor carrier ingredient it contributes negligible glycemic load.

cat_context: No additional cat-specific concerns at typical inclusion levels. Although cats have limited carbohydrate metabolism due to reduced glucokinase activity, maltodextrin at typical carrier/coating levels does not contribute meaningful dietary carbohydrate.

tldr: Maltodextrin is a processed starch used mainly as a carrier to deliver flavors, vitamins, or coatings in pet food. It does have a high glycemic index, but the amounts used are so small that they're nutritionally insignificant. At the tiny levels typical in pet food, it's not something to worry about.

detail_body: Maltodextrin was approved by AAFCO for use in pet food in 2017 and is classified as FDA GRAS. It is regulated under 21 CFR 172.892(i) when derived from non-modified starch treated with alpha-amylase to a dextrose equivalent below 20. It functions primarily as a carrier base for flavorings, probiotics, and supplement coatings — not as a nutritional ingredient. Its high glycemic index (GI 85–105) reflects rapid conversion to glucose, but this is only clinically relevant when consumed in meaningful quantities.

At typical pet food inclusion levels — where maltodextrin appears near the bottom of ingredient lists as a processing aid or carrier — the absolute carbohydrate contribution is negligible. It does not meaningfully affect blood glucose, glycemic load, or total dietary carbohydrate percentage within a complete diet. The concern about maltodextrin applies primarily to products using it as a significant filler or bulking agent at higher inclusion levels, which is atypical in quality pet food formulations. For diabetic pets on strictly controlled diets, veterinary nutritionists may still prefer to minimize all high-GI ingredients, but at standard carrier levels this ingredient does not warrant clinical concern.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 172.892 — Food Starch-Modified

primary_concern_basis: Processing aid (standard)
```

---

## 15. Modified Food Starch

```
canonical_name: modified_food_starch
display_name: Modified Food Starch
category: starch_modifier
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Modified food starch is a food starch (from corn, potato, wheat, rice, or tapioca) that has been physically, chemically, or enzymatically altered to improve its functional properties such as viscosity, stability, or gel strength.

base_description: A chemically or physically altered starch used as a thickener, binder, and stabilizer in wet and canned pet food, with the source grain typically unspecified on the label.

dog_context: No additional dog-specific concerns at typical inclusion levels. Note: the source grain is not required to be disclosed on pet food labels ("modified food starch" only), which may be relevant for dogs on elimination diets for suspected grain allergies.

cat_context: No additional cat-specific concerns at typical inclusion levels. Same source-grain transparency limitation applies for cats on elimination diets.

tldr: Modified food starch is a thickener used to give wet pet food the right texture and consistency. It works well and is safe, but the label won't tell you what grain it came from (corn, wheat, potato, etc.). If your pet has a known grain allergy and is on a strict elimination diet, the unspecified source is worth asking the manufacturer about.

detail_body: Modified food starch is regulated by FDA under 21 CFR 172.892, which permits a range of physical, chemical, and enzymatic modifications including acid treatment, oxidation, esterification, etherification, and cross-linking. The label must bear only the common name "food starch-modified" — manufacturers are not required to disclose the source grain. This is the primary transparency concern: pets with documented wheat or corn allergies on elimination diets may need to avoid this ingredient, or owners may need to contact the manufacturer to confirm the source.

The modifications permitted under 21 CFR 172.892 are well-characterized and FDA-regulated, with chemical residues limited by specification. Modified starches are used in wet and canned pet food as thickeners and binders, sometimes at significant levels where they serve as the primary texturizing agent. They are nutritionally equivalent to other dietary starches — providing digestible carbohydrate calories with no unique nutritional value. At typical inclusion levels, they are a benign functional ingredient. The unspecified-source issue is a labeling transparency matter, not a toxicological or nutritional concern for pets without known grain sensitivities.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 172.892 — Food Starch-Modified

primary_concern_basis: Processing aid (standard)
```

---

## 16. Sodium Tripolyphosphate

```
canonical_name: sodium_tripolyphosphate
display_name: Sodium Tripolyphosphate (STPP)
category: binder_emulsifier
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: caution
cat_base_severity: caution

definition: Sodium tripolyphosphate (pentasodium triphosphate, Na₅P₃O₁₀) is a linear condensed polyphosphate salt containing approximately 25% phosphorus by weight, produced by heating monosodium and disodium phosphate.

base_description: A multifunctional additive used as an emulsifier, moisture binder, and dental tartar control agent in pet food, notable for its high bioavailable phosphorus content — a concern for renal-compromised animals.

dog_context: Inorganic phosphates including STPP cause significant changes in phosphorus homeostasis regulatory factors in healthy adult dogs (Dobenecker et al., 2021). Elevated serum phosphate is linked with renal disease progression and increased mortality. Senior dogs and dogs with early or subclinical kidney disease are at increased risk from chronic high-phosphorus diets containing inorganic phosphorus sources.

cat_context: Chronic kidney disease affects 20–50% of cats over age 10 and up to 80% of cats over 15. STPP is one of the most commonly added inorganic phosphorus sources in US wet cat foods (Laflamme, 2020). In cats, STPP at ≥0.5 g P/Mcal causes significant increases in plasma phosphate and parathyroid hormone with decreased blood ionized calcium. Inorganic phosphorus from salts like STPP is >90% bioavailable — nearly double the absorption rate of organic phosphorus from meat — creating disproportionate renal phosphorus load per gram.

tldr: STPP serves a useful dual purpose — it helps control dental tartar and improves food texture. However, it's a concentrated source of highly absorbable phosphorus, which burdens the kidneys. This matters because kidney disease is very common in older pets, especially cats. It's not dangerous in a healthy pet, but it's worth being aware of, particularly for senior animals.

detail_body: Sodium tripolyphosphate is FDA GRAS under 21 CFR 182.1810 (multipurpose) and 21 CFR 582.1810/582.6810 (animal feed). It serves dual functions in pet food: as a dental tartar control agent (chelating salivary calcium to prevent calculus formation on tooth surfaces) and as a processing aid (increasing protein water-holding capacity, chelating pro-oxidant metals, and stabilizing emulsions). AAFCO recognizes STPP as a GRAS ingredient for animal feed.

The caution rating reflects STPP's role as a concentrated source of inorganic phosphorus (~25% P by weight) with >90% bioavailability — substantially higher than organic phosphorus from meat or bone (40–60% bioavailability). Laflamme (2020, Journal of Veterinary Internal Medicine) demonstrated that added inorganic phosphorus at ≥0.5 g P/Mcal caused dose-dependent increases in plasma phosphate and parathyroid hormone in cats, with calcium-to-phosphorus ratios below 1:1 worsening the response. Dobenecker et al. (2021) showed that most inorganic phosphates including STPP caused "significant changes in regulatory factors" of phosphorus homeostasis in healthy adult beagle dogs, while organic phosphorus sources did not — concluding that "the use of these inorganic phosphates in pet food is potentially harmful and should be restricted." Given that CKD affects up to 50% of cats over 10 years old and is the leading cause of death in older cats, the phosphorus load from STPP represents a genuine and well-documented nutritional concern that applies regardless of an individual animal's known renal status.

position_context: This ingredient's impact depends on how much is used. Higher on the label = more concern. Phosphorus load is cumulative across the diet, and STPP's high bioavailability means even moderate inclusion contributes disproportionately to total absorbable phosphorus.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 182.1810 / 582.1810 — GRAS Substances; Laflamme DP (2020), Bioavailability and adverse effects of some dietary phosphorus sources in cats and dogs, JVIM; Dobenecker B et al. (2021), Effect of inorganic phosphates on parameters of phosphorus homeostasis in healthy dogs, PLOS ONE

primary_concern_basis: Phosphorus source (renal note)
```

---

## 17. Smoke Flavor

```
canonical_name: smoke_flavor
display_name: Smoke Flavor
category: flavor_enhancer
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Smoke flavor is a liquid or dry concentrate produced by controlled pyrolysis of hardwood, in which smoke condensate is captured, filtered to remove tars and heavy resins, and concentrated into a water-soluble flavoring.

base_description: A natural or artificial smoke flavoring used as a palatability enhancer in semi-moist treats, jerky-style products, and dental chews, with secondary antimicrobial and antioxidant properties.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels. Smoke flavor contains phenolic compounds (guaiacol, syringol) that theoretically engage feline-deficient glucuronidation pathways, but at typical flavoring levels (< 1%) the exposure is far below any clinically relevant threshold.

tldr: Smoke flavor is what gives some treats their smoky, savory taste. Commercial products are filtered to remove harmful compounds, and only the flavor-active parts are kept. It's used in small amounts and is FDA-approved. Nothing to worry about at the levels found in pet food.

detail_body: Liquid smoke has been classified as GRAS by the FDA since 1981 following a commissioned safety review. Commercial smoke flavor is produced by controlled pyrolysis of hardwood under low-oxygen conditions, with the resulting smoke captured via water condensation. Critically, the production process includes filtration steps that remove insoluble tars, heavy resins, and a substantial portion of polycyclic aromatic hydrocarbons (PAHs) — known carcinogens present in raw smoke. Commercial liquid smoke preparations typically contain fewer PAHs than traditionally smoked foods.

In pet food, smoke flavor is used at typically less than 1% as a palatability enhancer, particularly in semi-moist treats and jerky-style products. The phenolic compounds (guaiacol, syringol, cresols) that provide the smoky aroma also contribute antimicrobial and antioxidant properties, with demonstrated efficacy against Listeria monocytogenes and Aspergillus flavus. The EU (EFSA) maintains stricter evaluation criteria for individual smoke flavoring products than the FDA's blanket GRAS determination, but no regulatory body has identified safety concerns at typical food-use concentrations. No pet-specific adverse effect studies exist in the literature, and at standard flavoring levels the ingredient poses no documented risk.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA GRAS determination for liquid smoke (1981)

primary_concern_basis: Processing aid (standard)
```

---

**ENTRY #18 — SKIPPED**

`brewer_dried_yeast` is the same AAFCO ingredient as `brewers_yeast` (Tier 2). AAFCO Section 96.4 defines "Brewers Dried Yeast" as "the dried, non-fermentative, non-extracted yeast of the botanical classification Saccharomyces resulting as a by-product from the brewing of beer and ale." The term "brewers yeast" on pet food labels and product descriptions is the informal shorthand for this same ingredient. **Database alias mapping: `brewer_dried_yeast` → `brewers_yeast` (Tier 2 entry).**

---

## 18. Dried Whey

```
canonical_name: dried_whey
display_name: Dried Whey
category: flavor_enhancer
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Dried whey is a dairy byproduct powder produced by spray-drying or roller-drying the liquid whey remaining after milk has been curdled and strained during cheese or casein production, containing not less than 11% protein and 61% lactose.

base_description: A dairy byproduct used as a palatability enhancer, protein source, and Maillard browning agent in pet food, containing significant lactose that may affect lactose-intolerant animals at higher inclusion levels.

dog_context: Many adult dogs have reduced lactase production after weaning, though lactose intolerance is less universal in dogs than cats. At typical pet food inclusion levels (1–3%), the lactose contribution is generally well-tolerated. Dogs with confirmed dairy sensitivity or on elimination diets should avoid this ingredient.

cat_context: Most adult cats (estimated 50–80%) are lactose intolerant due to declining lactase activity after weaning. However, at typical pet food inclusion levels (1–3%), dried whey contributes approximately 0.65–1.5% lactose to the total diet — translating to roughly 0.3–1.4g lactose per day for an average cat. This is well below the documented threshold of 6g/day at which GI symptoms appear in lactose-intolerant cats (Beynen, 2017). GI effects are unlikely at standard inclusion levels.

tldr: Dried whey is a dairy ingredient that adds flavor and a bit of protein. It does contain lactose (milk sugar), and most adult cats and some dogs don't digest lactose well. The good news: at the small amounts typically used in pet food, it's well below the level that would cause stomach upset even in lactose-intolerant pets. It's fine in most foods.

detail_body: Dried whey is AAFCO-defined as the product obtained by removing water from whey, containing not less than 11% protein and 61% lactose. It is FDA GRAS under 21 CFR 184.1979. In pet food, dried whey functions primarily as a palatability enhancer (the lactose content provides sweetness), a source of high biological value whey proteins (β-lactoglobulin, α-lactalbumin, immunoglobulins), and a Maillard browning agent during extrusion and baking. It is typically used at 1–5% of the formula.

The principal concern is lactose content. Lactase activity declines in most mammals after weaning, and both dogs and cats can develop osmotic diarrhea, gas, and bloating from lactose malabsorption. The degree of intolerance varies individually and by species — an estimated 50–80% of adult cats are lactose intolerant (Cornell Feline Health Center), while dogs show more variable tolerance. Critically, dose matters: Beynen (2017) established that cats tolerate up to 6g lactose per day without symptoms, with intermittent diarrhea appearing at 10g and continuous diarrhea at 16g. At 1–3% inclusion in pet food, an average 4kg cat consuming 50–60g of dry food would ingest approximately 0.3–1.4g of lactose per day — well below the symptom threshold. The neutral rating reflects that typical inclusion levels are insufficient to cause clinical effects in most animals. Dairy protein allergy is a separate concern, documented in approximately 17% of dogs with confirmed adverse food reactions, but this is a protein-mediated immune response distinct from lactose intolerance.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 184.1979 — GRAS Substances; Beynen AC (2017), Milk for cats, Creature Companion; Mueller RS, Olivry T, Prélaud P (2016), BMC Vet Res 12:9

primary_concern_basis: Lactose source (GI note)
```

---

## 19. Calcium Stearate

```
canonical_name: calcium_stearate
display_name: Calcium Stearate
category: anti_caking
is_legume: FALSE
position_reduction_eligible: FALSE

dog_base_severity: neutral
cat_base_severity: neutral

definition: Calcium stearate is the calcium salt of stearic acid (a C18 saturated fatty acid), forming a white, waxy, water-insoluble powder used as a lubricant and flow agent.

base_description: A fatty acid salt used as a flow agent, lubricant, and anti-caking agent in pet supplement tablet manufacturing and powdered ingredient blending.

dog_context: No additional dog-specific concerns at typical inclusion levels.

cat_context: No additional cat-specific concerns at typical inclusion levels.

tldr: Calcium stearate is a manufacturing lubricant used mostly in pet supplement tablets — it keeps ingredients from sticking to the machines and helps tablets hold together. It's made from a common natural fatty acid and calcium, is considered essentially non-toxic, and is used in tiny amounts.

detail_body: Calcium stearate is FDA GRAS under 21 CFR 184.1229 (human food) and approved as a food additive for animal feed under 21 CFR 573.280 as an anticaking agent in accordance with GMP. USDA technical review classifies it as "essentially innocuous" presenting "no toxicological concern." It is used primarily in pet supplement tablet manufacturing at 0.25–2% by weight as a lubricant (preventing ingredients from adhering to die surfaces during tablet compression), anti-caking agent, and flow enhancer in dry ingredient blending.

Calcium stearate is insoluble in water, largely unabsorbed in the GI tract, and metabolically inert at the trace levels present in finished products. Despite containing calcium in its chemical formula, it does not contribute bioavailable calcium at the concentrations used. Modern feed-grade calcium stearate is predominantly derived from vegetable oils. No adverse effects, drug interactions, or contraindications have been documented for any companion animal species. It is among the most benign processing aids in the pet food and supplement manufacturing toolkit.

position_context: This ingredient appears in small quantities as a processing aid. Its presence is not a significant scoring factor.

citations_display: AAFCO Official Publication — Definitions of Feed Ingredients; FDA 21 CFR 184.1229 / 573.280 — GRAS Substances

primary_concern_basis: Anti-caking agent (inert)
```

---

## Summary Table

| # | canonical_name | category | dog_severity | cat_severity | same_or_different | note |
|---|---------------|----------|-------------|-------------|-------------------|------|
| 1 | glycerin | humectant | neutral | neutral | same | GRAS humectant; safe replacement for propylene glycol |
| 2 | sorbitol | humectant | neutral | neutral | same | Sugar alcohol; osmotic diarrhea only at doses far above pet food levels |
| 3 | molasses | flavor_enhancer | caution | caution | same | Added sugar; no nutritional need; dental/obesity risk |
| 4 | dextrose | processing_aid | caution | caution | same | Added sugar (GI 100); consistent with Tier 1.5 sugar ratings |
| 5 | soy_lecithin | emulsifier | neutral | neutral | same | Soy-derived but negligible allergenic protein after processing |
| 6 | cellulose_gum | emulsifier | neutral | neutral | same | EFSA confirmed safe for all species (2020); inert thickener |
| 7 | agar_agar | emulsifier | neutral | neutral | same | Seaweed-derived gelling agent; non-digestible, inert |
| 8 | sodium_alginate | emulsifier | neutral | neutral | same | EFSA safe up to 4% DM for dogs and cats; typical use far below |
| 9 | citric_acid | acidifier | neutral | neutral | same | Normal metabolic intermediate; bloat claim debunked |
| 10 | calcium_propionate | preservative | neutral | neutral | same | GRAS mold inhibitor; metabolized to normal fatty acid + calcium |
| 11 | potassium_sorbate | preservative | neutral | neutral | same | EFSA approved for cats and dogs; no confirmed feline sensitivity |
| 12 | silicon_dioxide | anti_caking | neutral | neutral | same | Chemically inert amorphous silica; FDA max 2% of feed |
| 13 | calcium_silicate | anti_caking | neutral | neutral | same | Inert anti-caking; FDA max 2% of feed; no adverse effects |
| 14 | maltodextrin | starch_modifier | neutral | neutral | same | High GI but negligible at typical carrier/coating levels |
| 15 | modified_food_starch | starch_modifier | neutral | neutral | same | Source grain unspecified; transparency concern for allergy diets |
| 16 | sodium_tripolyphosphate | binder_emulsifier | caution | caution | same | 25% P by weight, >90% bioavailable; documented renal concern |
| 17 | smoke_flavor | flavor_enhancer | neutral | neutral | same | GRAS since 1981; PAHs removed by filtration; safe at food levels |
| — | brewer_dried_yeast | — | — | — | SKIP | Alias for brewers_yeast (Tier 2, AAFCO 96.4); map, do not duplicate |
| 18 | dried_whey | flavor_enhancer | neutral | neutral | same | 61%+ lactose but below GI symptom threshold at typical inclusion |
| 19 | calcium_stearate | anti_caking | neutral | neutral | same | Essentially innocuous per USDA; inert lubricant/flow agent |

### Distribution Check
- **Neutral for both:** 16 entries ✓
- **Caution for both:** 3 entries (molasses, dextrose, sodium_tripolyphosphate) ✓
- **Different dog vs cat:** 0 entries ✓
- **Danger:** 0 entries ✓
- **Skipped:** 1 entry (brewer_dried_yeast → brewers_yeast alias) ✓
- **Total delivered:** 19 structured entries + 1 skip note = 20 ingredients addressed ✓