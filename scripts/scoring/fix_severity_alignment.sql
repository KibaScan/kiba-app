-- Kiba Ingredient Severity Alignment Fix
-- Generated: 2026-03-07 (M4 Pre-Session 2)
-- Purpose: Fix variant ingredient rows created by M3 parser that defaulted to 'neutral'
--          when they should inherit severity from their canonical parent ingredient.
--
-- The M3 ingredient parser sometimes stored ingredients with:
--   - Batch codes appended (e.g., bht._c620423)
--   - Recipe names leaked in (e.g., vitamin_d3_supplement_chicken)
--   - FD&C prefixes (e.g., fd&c_red_40 instead of red_40)
--   - Lake/color suffixes (e.g., red_40_lake, titanium_dioxide_color)
--   - Sub-ingredient forms (e.g., soy_flour, wheat_gluten, menadione_sodium_bisulfite)
--
-- These variant rows got default 'neutral' severity, causing products containing
-- concern ingredients (caution/danger) to be scored incorrectly.
--
-- Total rows to update: 862 (859 batch + 3 compound fixes)
-- HIGH confidence (parser artifacts, FD&C, lake/color): 737
-- MEDIUM confidence (sub-ingredient forms): 122
-- COMPOUND fixes (contain concern ingredients): 3
--
-- EXCLUDED (4 edge cases):
--   brown_rice_syrup — sugar, not grain (different risk profile)
--   corn_sugar — dextrose, not corn (different risk profile)
--   salmon_by_product(s) — by-products have different quality than whole salmon
--
-- POST-BATCH COMPOUND FIXES (applied manually after batch):
--   mixed_tocopherols_and_bha: good -> caution (contains BHA)
--   potassium_sorbate_and_citric_acid_and_mixed_tocopherols_and_calcium_propionate_and_bha: neutral -> caution
--   potassium_sorbate_and_citric_acid_and_calcium_propionate_and_mixed_tocopherols_and_bha: neutral -> caution
--   partially_hydrogenated_canola_oil_preserved_with_tbhq: neutral -> caution
--
-- EXECUTION RESULTS (2026-03-07):
--   All 862 rows updated successfully via PostgREST PATCH
--   Pure Balance reference score: 69 (unchanged)
--   447 tests passing (unchanged)
--   Category average deltas:
--     daily_food x cat x grain-inclusive: 69.2 -> 63.4 (-5.8)
--     daily_food x cat x grain-free: 75.1 -> 73.9 (-1.2)
--     daily_food x dog x grain-inclusive: 74.0 -> 72.7 (-1.3)
--     daily_food x dog x grain-free: 75.1 -> 74.9 (-0.2)
--     treat x cat x grain-inclusive: 73.2 -> 69.2 (-4.0)
--     treat x cat x grain-free: 73.2 -> 71.6 (-1.6)
--     treat x dog x grain-inclusive: 81.7 -> 79.4 (-2.3)
--     treat x dog x grain-free: 87.0 -> 86.4 (-0.6)
--
-- IMPORTANT: This does NOT modify the scoring engine. Data correction only.
-- IMPORTANT: Preserves all existing tldr/detail_body content on updated rows.

BEGIN;

-- animal_fat (caution/caution): 1 variants, 67 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('9f71a9ca-e206-4461-973c-9294190c54de');

-- beta_carotene (good/neutral): 10 variants, 14 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('54dcd991-5467-43a2-8fd5-a907d3fc07ea', '8a716fe2-8aaf-4110-a173-955b5a25d71d', '9a46e55b-2ad4-4a69-912b-900535ea5424', '21201cb0-ea3c-42b6-910f-9445daf6dae6', 'e05fb37e-3865-4130-bbf7-93ad8f2483b5', '3c7f89ec-b4fb-4bbf-91e4-ab72f8050458', 'd40ead85-a55f-4897-97a7-d7ca7f33991d', '38286a1e-d6f1-4510-9c36-31ee1a7050dd', 'dd1d9e20-e629-4359-bfff-ebf8b002af74', '6074ef5d-1722-4d8c-89ee-8d45e5950083');

-- bha (caution/caution): 2 variants, 1 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('159fc186-19fa-42cd-a4a8-f9e0938a39ec', '101ccd19-abce-4258-af32-9f43d294b133');

-- bht (caution/caution): 14 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN (
  '57301630-a1ee-4d27-af95-564aa9be81b7', 'dc138ac2-e0cd-47ec-babd-1f51094cc533', 'a5f59771-4fbe-4fd3-a328-3f0aa423ad31', 'd9abd9c9-83ca-4134-8cbb-9cbaf84481a0', '13900b3e-1536-47bb-aade-334f7ce1df44',
  '1cfdffb9-2548-4a5f-8964-cbf4409f5b94', 'add3c047-6be2-429a-b302-1c1565fafc18', '6669014d-daf2-4f04-817e-c92ead747a16', 'a691c28c-8811-4a1f-bd55-37f4fe321fb6', '68910340-f619-4b02-aac9-6540c9359083',
  'd5f7d7f7-9d4a-4d32-8cd2-88407d9a8769', '1b15fff4-d1fc-47c8-8f32-56c6802c1f1e', '87254985-ca23-466f-b907-d696db7543b2', '7a7f989e-45d6-4b31-8c10-aca5eae0168b'
);

-- blue_2 (caution/caution): 14 variants, 15 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN (
  '412ec13e-4522-4da1-961b-e111d732259c', '96c6d780-19a5-4685-a70d-8d09af633356', '365f4f94-6b13-4c49-8bac-e2cd6493ccdc', 'bcb48f21-441d-46ec-9a45-df2651278e4e', '588ed4c4-14c7-42b5-a860-ae8d39967003',
  '85b1f5b6-7300-4eaa-9bf7-72ccf22c9310', 'ed17534b-a2cc-49ca-bc6f-0a68e97fcf26', 'cd5acaba-2fa0-4298-ade2-76e082e1e066', 'a3f89d36-3010-46d2-acd0-cb7aed1cdbe6', '5ef9395f-d612-415c-9022-61f418887fae',
  'a06a3660-cbc5-4d8d-b9cd-9b257553b8e1', '70fd567d-3c13-49e2-b287-de892f6685fc', '9a9e4ced-c386-48d6-a988-02b0b6a3bc0d', '93eedfac-5fef-4ac1-a400-d6b36a533f92'
);

-- blueberries (good/good): 2 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('66bca612-014e-404c-a49c-3bc98c6146e4', '127185a8-a861-4e66-96bd-67b63a777791');

-- brewers_rice (neutral/caution): 1 variants, 9 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN ('785b71e0-113a-49fc-b7ad-39f51faa823c');

-- brown_rice (good/neutral): 1 variants, 31 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('b89a3095-bcfb-49be-9cbb-09b064b895dc');

-- carrageenan (caution/caution): 5 variants, 6 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('04f2df98-17ce-4580-92bf-1023bb7f6ee2', '64cb13b9-143c-4784-8a35-6fccd8f25e36', '1c8ce236-efb3-486d-9247-d2c52b422614', '3cdd4c50-162a-4b75-8209-7f23accee94a', '5611a4f3-6309-49de-90a9-afea458607e8');

-- carrots (good/neutral): 14 variants, 12 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN (
  '673a33d7-c737-4188-bcb8-be320592b884', '52a9c6ba-c457-4ec3-a85f-22571ba52cda', '8556d353-21a0-4478-83fa-62c01525d9ce', '85b31f6b-45e6-445a-a412-ebfeefc5fe40', 'd57c674a-361b-4814-9ab4-ba4edd70b28d',
  '4c4bad9a-f4d9-4197-8d81-7e02fa95f09c', '97388343-7a53-4407-a691-48c39b844175', '82712ea3-47f1-4d6c-b9e5-0fe9507a07d3', 'e5ce6719-2ea0-4ee5-9b0a-3e137ec31953', 'eb5266de-12aa-47b3-a094-eb4931aca082',
  '742cb266-603e-4006-8971-8bd7c56b6346', '118f4d29-5eaa-4447-a157-1967968b09f6', '21f81e3b-a69f-40c8-b423-123bac80c8c9', '195bcc65-8fe3-45bc-894c-523967dc8328'
);

-- chicken_fat (good/good): 2 variants, 4 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('97bcf7a6-d3a0-4b30-89c4-947137f276a7', 'ed08e505-c456-4726-b4c7-b2049ff0c7e1');

-- chickpeas (caution/caution): 1 variants, 1 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('787f01c8-cd79-4c0d-ac9f-6b4347f3dcc7');

-- chicory_root (good/good): 1 variants, 1 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('b4f8cc17-8198-42a6-b62a-24c1e0c1872c');

-- cinnamon (neutral/caution): 1 variants, 3 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN ('b2ec8804-aefd-43c2-88b6-b9646ffda7fa');

-- copper_proteinate (good/good): 2 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('7f3773ef-fb8d-4160-b837-35d4ab119435', 'd8e27666-0e76-469a-80e9-292bf28b7710');

-- copper_sulfate (caution/neutral): 1 variants, 3 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'neutral'
WHERE id IN ('a4c65439-b543-4649-9bda-229dbe6b0cda');

-- corn (neutral/caution): 15 variants, 644 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN (
  '1ef83a06-b6bb-41af-b8e5-cb46772d2016', '1ec77c14-656a-4392-80f2-dc4985119c96', '97547f72-9fbe-46af-aac9-78c96d7c72e3', 'cd7b618f-1e0e-450d-b12f-1aeae1dcdd0f', '30bfc50b-4307-4278-93ef-6cc47ceb4222',
  '436369bd-03fb-425e-bc1f-f4c0c9f1b401', 'dd07c82c-58b6-4e9a-bba3-a917d81011d4', 'cee2f6c9-a34a-472f-a9dd-6560b4542981', '8cc3863c-e4e3-4d74-bfbb-2968362709db', '3bcb89a8-63f6-43e2-b40b-315373c18d33',
  '46cb610c-7a85-48ad-bb32-0aa5c6e453ca', 'bb5a235e-6860-41dd-ab75-136498a7899f', '7f8c89d7-f1f6-431a-a26a-14ded792bc0a', 'a757a62a-0012-4ad9-bd6e-eb0911128c85', '145b40c1-963e-4223-8b84-e28d63a9dbc0'
);

-- corn_gluten_meal (neutral/caution): 1 variants, 1 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN ('2eefe96e-d1cd-4109-9fff-cf883b6ad4b6');

-- cranberries (good/neutral): 2 variants, 2 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('24ad2055-e776-4f48-a1c2-c4c977159232', '60827347-cbcb-44b1-a40a-dfd6bb75f3fb');

-- dl_methionine (neutral/good): 12 variants, 7 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'good'
WHERE id IN (
  'e7e87d41-c284-4714-bb1d-224f3de6608c', '75f8f2b9-a172-4c46-8b6a-1f5dfe313c8a', '6531aaad-66b6-426c-b4d9-19d88d089db2', '90c2686a-9781-48ad-9236-f59929abc259', 'e30e9f1f-8de8-4dcc-80b9-27c251c66a83',
  '9e7555b7-127f-4beb-9c79-61e2676a3d4f', 'bed175bc-611a-4e4f-853a-2d965e63d3fc', '5df543b6-0fb9-4023-805e-f73a8e902da6', 'b032e03f-a2c2-44e3-bfa1-cc3774d76faf', '3a7686d7-facf-4e3c-aacf-097d9f4c3510',
  '8db86652-a920-4e31-a9a0-131aef6ac708', '6454948c-30db-4c24-a3db-643f1b8a494e'
);

-- dried_bacillus_coagulans_fermentation_product (good/good): 10 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('fb785576-b756-4f0d-a0b2-931a9be7fc88', '7cf2ed26-45aa-4512-bd5d-371d3df0056c', 'f6d72d55-29b0-463f-9076-daf00c6cba54', '1091837b-fa22-46fc-9ab2-05c04dac892d', '02df168f-507b-4b5b-bf4c-b5997518175c', '02fbff92-81d5-4582-9972-5b7804767a83', '439ff688-bced-4bc9-b545-02b4d7ebb0d9', '4115a025-1e5b-482a-a45c-51c4dc37021b', 'f79c2bd9-90bf-4fcf-8bc7-1566a2984401', '8a2b54a9-f4cb-4147-a039-b1046a84a3e4');

-- dried_kelp (good/good): 3 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('9937e498-164d-4813-8cec-0fa12044db49', '1dd0bf43-120a-4487-a1e1-3ccaffea30ed', '986b3c94-88e2-4e5c-a9cb-50fe5a44da88');

-- dried_lactobacillus_acidophilus_fermentation_product (good/good): 1 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('99d4e0ad-3fae-4c57-9262-33b2efe25329');

-- dried_trichoderma_longibrachiatum_fermentation_extract (good/good): 2 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('820d991c-2b3b-41d7-a452-c1b0fbb243a4', 'fb0dcfee-fc5e-4111-8dfd-ad19231108c8');

-- fish_oil (good/good): 7 variants, 5 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('c1acdb49-2517-4344-824d-8e2e784f7d8e', '13d1de14-5622-4ee8-bc5c-b403487c1f17', 'f311d0ab-a597-4b3d-b693-98ca32b83300', '1aa2aa59-e747-4bab-b683-36e08efddf14', '21240e16-2d74-44d4-a2b5-40c2349255f0', '79797955-0173-4eb5-957d-97cf9a4a29e5', '355b9f9f-1adb-47e9-9391-47729c152fbd');

-- flaxseed (good/neutral): 3 variants, 66 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('edcee5bc-2e69-4a0c-bbf6-1b553dcd6d69', '1d8ebeda-0973-48d4-b81b-bc2f04fb12da', 'db5591db-a38d-446a-8577-e1d3164a11b3');

-- flaxseed_oil (good/neutral): 1 variants, 1 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('6d492fdb-1bf0-4706-8476-5b10cccb1c88');

-- ginger (good/neutral): 1 variants, 5 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('1d86d6d9-1081-4a11-afdc-202491551786');

-- green_beans (good/neutral): 7 variants, 10 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('b8f3d8f0-8736-412b-86ab-f5924313db84', 'cf78cf58-f773-4c91-bba6-f91e7f17a55a', '70e09e7f-a903-4757-8256-f11a49e2eb20', 'a52aefdc-f332-4705-97ce-8da3778a05ae', 'c99fa70f-9ef1-4abc-821a-a42613687d76', '055493e8-7ddd-4aac-ac07-5f1515c2fd49', '2ac76c4d-6ec4-4b35-80c5-e6a1e969dfb5');

-- green_tea_extract (neutral/caution): 54 variants, 71 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN (
  '157f55fa-8c4d-41b7-aed1-5043ca8f5857', '5f646e19-100d-4927-a2f5-d1f5d567a836', 'f4d4109f-0099-406d-8e81-6456fc15f76e', 'de0de1ac-0c57-4c81-b11f-7a8ca0034951', 'bd208e9b-24e3-45bc-b57e-5ef2165ab523',
  '91bd965b-4600-4ddd-8835-09698e6724df', '2def0a81-bee2-4963-bd87-95904de98781', '09bc6c5b-5e57-4a5d-86f8-0db9efc25484', '5bcf1f43-0e03-447d-990e-eac96be5c49b', '3499e324-5540-4e0b-9097-11d2033a42b7',
  'd4745d41-7906-44ef-a1f8-c8406fc425bf', '1d1563e5-d465-462e-9240-df0ea3402297', '2b6b6932-dbf3-43ba-886f-a427df8e223e', 'ddf03274-dd76-4c01-9516-810b3ee2e9d4', '004bbce1-1ca5-4f0e-94a3-da90576f98f8',
  '139f0f80-c73c-4b72-91cf-d5494d7cef48', '18ed1ba3-9082-43dd-8592-c02883bcf149', 'e29b6afe-4068-4c2a-929d-7b8fe43e6b89', '5b12ebdf-b83f-4557-8eb1-1b0ddc7cc39f', '24a8d7c8-04b2-4940-b81d-df1336e2b933',
  '3ecc5ca6-a456-452b-9743-e0b34c5472ed', '0ec0f7a5-4fae-4e4f-96dc-3cec10c9b173', 'd8cd9f29-e5f0-403c-ac09-4d1d0d4abc55', 'ff53df57-95e4-4f8c-b3fb-6980ace70ce1', '714d3ec9-d1d8-4236-8252-0bb9687bc5ea',
  '29bd6260-12f9-4faa-a465-471911b18e6d', 'a40dc1ac-1cae-46c2-97d9-b1131448db6e', '8dc4cd10-be47-48b4-97ad-cf6058587c41', 'ee64e87c-172a-4b3f-8573-5a4b0d8f8636', '25a00503-10de-461a-9cbf-a72a829be92e',
  '58466777-8ad0-4d84-8a05-e9dbad91c619', '23a2a999-5181-4ecb-b2b8-d2895315c56a', '3360eaec-62d6-474b-aa83-1d0dccd2229a', '0a8cfb58-b9fb-447b-9730-655bc5c9f8e0', '4f01c35a-5ff2-430d-9705-947cc660fd0e',
  '794e05c9-cd83-4b83-9539-beca6100546e', '5b246d85-f68b-4af0-9a1d-256981224168', '2e3090c1-704f-40d2-b9f6-e13fc3f20e3a', '8ade3a7a-294b-4ada-93f7-f2b42fe1dcbc', 'bcf3b24a-9df0-4ea7-ad4f-fc2b915268e9',
  '21ca530a-a7b0-4625-9500-6eb559440fcb', '92e43c87-2ab3-4a76-ad9a-610af5cd613c', 'cd6b926c-f403-49ad-baa4-1e00c69dedaf', '45ca0631-2b42-4186-bf74-4babfce02f0b', '35a336b3-97d7-4c16-b278-640e4e6a9a51',
  'a49015da-cd54-4593-ba45-b7fa40a492d8', '50ea6dd5-2a56-4a37-b236-3729745ecc84', '5374b19d-60da-48e4-abfd-5f7773af6e38', 'edd2afd9-7090-4c84-959e-760bb82504dc', '4255ec36-d264-4ad0-856e-67b761440834',
  '8f8eddad-13d7-485d-ac25-0d5d0c837302', '84e896c2-65dd-4079-82a0-7ef0a9faa295', '9209b0ac-fed7-4094-9c51-8cb0c08a2d39', '3143f089-3e96-4b7f-991a-d742243f8de1'
);

-- inulin (good/good): 6 variants, 3 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('b26718d6-f607-4f70-b21b-7cc1a591e965', 'cfaeec5b-a5d5-45a2-943b-283ddc41bac2', '3f5b93c5-58d3-456a-964a-2ce0b1907dcf', '8413fa57-ecab-4902-adfa-7f500fbc2bc7', 'b8d2f627-f948-4c48-93e0-c4394936a936', '541b963e-f51d-4718-8487-8afee70cd0f6');

-- iron_oxide (caution/caution): 5 variants, 60 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('ae2527d0-d5fe-44de-a725-7495a0c3f578', '2027563e-42b2-4af2-9127-ca785a26fed1', '865e039a-64fa-4213-92e1-2780c61d038b', 'a4e1481f-e624-4ca6-ac16-1cda01ec1627', 'd2b56f13-c3a0-461e-b175-b81f382578c4');

-- kale (neutral/caution): 3 variants, 9 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN ('dd3d1d68-f662-4a6d-a64e-8a5979ca5b42', 'a85acadc-d00d-4f98-9c77-eb83ed269492', 'bf3de6b0-4aac-4df8-83c2-aec26ae62230');

-- l_carnitine (good/good): 6 variants, 3 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('a754347b-0da8-473f-b222-325a5778926b', '3f11c9f0-5dfb-4e6a-994d-19e385346603', '45ee284e-c779-46b3-a23d-6ed4f175782b', '86f01064-31e8-4d10-aa8b-55b868376233', '9b443478-3866-486a-9192-ac02d3ec9ae8', 'fe6f6ef7-b7c7-4273-80e4-2e9d201e741c');

-- manganese_proteinate (good/good): 2 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('aced7da8-eee1-4082-8c72-b3e712f1707f', '4da1757c-d56c-4de1-beae-2c00cea50eec');

-- menadione (caution/caution): 115 variants, 70 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN (
  '5a3ca2c2-7e5a-401b-80f2-9ab94da5a030', '145db8d6-1790-4e6a-a701-52f8bc553a1a', 'b623a66f-8d8c-4ba7-b01b-7fbd04431c86', '6742608f-0dd9-4d5b-b257-f97bb092f866', '9941d5f0-8011-497a-a35b-8f49002be2d5',
  '50a1a57e-7efb-40a4-854a-13224732e996', '708f44b7-698d-40da-8e41-98e0f7d140cd', '501d4946-0931-480a-82b3-268157be1792', '8fffffff-a3ae-42f6-9410-f335ea25d112', '74f77dcd-7d7c-4a02-88fb-6ceff3713f04',
  '8092ea69-6811-45ef-9127-b017627dd00e', '96793ccf-338a-4eaa-9246-eb3db014faaf', '012f0a1e-1921-49a2-805a-240f2e0928db', '91b013f9-c70a-4f88-af37-7b83ecda9813', '0300bf07-cfec-4ad5-87a5-b1f3c74fb9ad',
  'cd21a0c1-3278-462e-ba98-6f96b5c67158', 'e4e142e4-f08f-407c-804a-26e6c36023e4', '5d34b6fb-419e-453f-b195-501d5885b438', 'ba88aaef-702c-4806-8ef3-fafec9b2744d', '0ce86d28-959b-4c2b-a44b-7c4b39662c33',
  '0dba6dee-aadb-444f-b2b3-64245e2fe0af', '6805306a-78a4-49da-93b0-7f423fb629f9', 'b807fa01-5318-41f5-9c00-0c1c3c5b4900', 'cbe46a01-a32b-4a9e-9f77-b78a70ab3d5c', '311299ea-41a4-436a-845a-484344860c4f',
  'b719d262-6cbf-44f4-8fe0-8f6de0e91a3d', '6b022c18-9d85-4a34-9b1d-ca1301215257', '6f9653fe-9150-4c56-a5a1-35c82f0212a4', '2f9f6fbb-a547-489c-a016-4faa25789e19', '34c8fdd6-fd49-48de-91eb-2322e4108ba2',
  '0cce74b3-4eaa-4c9f-8ba7-d3717f7b9da8', '31b261fe-c538-4396-a7a2-05a7c2e541e8', 'afc2ef4c-4f7b-4072-a2a4-3c95a105e962', '10c11dfe-a492-48eb-a1e8-f9548de39502', '354438a8-8c3e-4aec-b39a-1d8950243ff6',
  '50af1041-a49f-4da9-a5c5-b6b96436dcae', 'ce647b6b-0fa4-4d85-a6ad-443f9df977ea', '80f75bf5-7741-4dc6-9bb9-386827db34da', 'f814d876-be32-40d7-b014-7ce6aac6748b', '21fc8759-e50f-48e0-954a-02f02edddd4b',
  'cc093487-4b8e-4043-a8c2-c8786ed7fd34', 'b192ef39-9be8-4909-89da-6da7ae429fa6', 'a8a3fe56-e8db-475e-b217-14cf41f809a7', '2c17d24c-cf49-430b-8927-394e425f4a1d', '427b2fab-eaa9-4b2d-9324-de9283f47344',
  '81a937c8-0cbd-4842-8b82-e0493f6ed79f', 'b35aac8b-7e31-4ec6-8590-b3c1f5e784e0', 'ac8e3839-c196-4e34-a546-ed19e385d376', '034c7be8-1396-4d9b-a47b-6bc29bdccfbf', '48497a87-6e95-416e-9c21-64c6501e5b09',
  '3476e78a-52a6-4549-945e-9a5700dbbd7a', '3a461e0b-61fc-408b-ad6a-cdaa9712b7be', 'ad9e44ea-34fa-4681-82b3-feaed29d353e', 'd74c33b9-4925-4181-abbe-c46d8efa1fa1', '1d532cc5-c370-4614-98a7-dfe0af8c6701',
  '304a3a6f-a065-4e9c-a84c-3bc82c9fd9e8', '7e4d3308-0409-441c-bc1c-39abba06f259', 'dbd2de96-789f-4e33-8b29-b2745a2b0477', '9a09ad44-a2ff-4418-bb4f-f68bc29b1ad1', '62dbc0ba-eb4f-4eec-8a16-5895df4e0777',
  'e2cac76a-4450-45db-ba1b-24390696aa0f', 'bd521ab4-fc55-439c-92b1-affe2152c85b', '361493e1-1505-44f9-9f30-688faa794b77', '9d1dc3e2-249d-4a2b-9c12-e4f4740ca1c4', 'a6c4b2b2-beb7-47cf-90a6-cc839cf00b62',
  'd17a47fa-7cac-4d5b-87f5-08448bdf1bb6', 'f4f4acb2-977f-4e42-b80f-278084fca64b', 'd5745686-fbe0-4083-89a5-3fdff2f5955f', 'aecb35fa-4349-40b5-aead-bdbe21d866ce', 'b6c17dc3-46dd-4ba3-abe4-7ac8d430261a',
  'a885cf41-86a6-4c3e-a0d9-a2c22a4fd4a3', 'a6b7c4d5-0460-4b0c-8cf8-ddea4ea71787', '444e58b2-a9cc-49fa-8372-6fa61cad3d35', '88fb481d-aa33-4d33-923f-715226a269b7', '9e19dacb-1f7d-42ff-acf5-ab66e589a15b',
  '4839ce34-ae96-4b78-bc7f-e98a0994009e', '7b3e5065-e30f-4ed2-8746-4d8075356121', '8feb7c06-2bfa-4df5-b930-addbf238ef57', 'dde8c434-4efd-44fa-bd3b-fa3e0ce19ca7', '69285cec-e013-49b5-8c47-773f39c668e3',
  '1926eda7-8dcd-47c8-ba2c-ec04ed0cfcbb', '96dce342-1882-410d-a166-356ed09ba2a1', '6561cf29-062d-4d3e-b137-dcaec49f5199', '312cf81e-ec70-47f7-8528-08012c4131d4', '11dabbf9-7dc1-46b0-aafb-80069b6d99be',
  'ce0819f2-dab8-4ec0-b781-40d38c0c2641', '342120fc-0c7b-4cfd-b8c3-7803a57c4727', 'c0f0af7b-7aa2-4b30-96f2-e95969b36f3a', 'de4a9f09-1c6e-4468-8874-64edff5b50bc', '4ebddee2-cc91-4be3-91d9-bd29eaa8ac71',
  'e2c62a24-9414-407f-8640-993654f65f56', 'd7679792-f345-467a-8c69-9b120da5aecb', 'c7c413bf-afe5-4d08-99c9-c28d0648ac7d', '6bd11261-ac37-4b69-8388-0be78c6afecf', '4d312aa8-473c-48af-a827-7ea86c6dbd40',
  'd1290d02-fa1b-4584-9e47-f8e00cd6587d', '254bbe6e-6de5-4d61-9420-2f340ef35a6f', 'e9952bf7-b40c-4fc7-858f-721621e6df44', '8a3432bc-c764-4c26-8c24-4fbb5687fabf', 'ba0bf093-b12c-4291-a91b-2f2196bdc8a8',
  'b4247778-534a-4bb3-bc99-1c99a49c010b', '9f335abd-d008-474f-b898-c0a19db0d1c2', '1283b736-d10b-4f10-bb22-47267b516236', '498a1687-50a1-4bf6-a6ea-50cef1f44a64', 'e1780db4-27ac-4bcd-97b4-10d6d74a004a',
  '211389d9-729a-47f5-a6e0-899541b4dc16', '241b9fb2-0899-4499-9ece-feddfa25643a', '028c8bb5-4fa2-4236-b87c-6c7a7f47d52d', '5e5e911d-e7ac-4e88-babc-c7e82cd0b939', '83245bc2-c253-49d9-9d3b-660e520003f1',
  '35dc2fe1-b7cd-4c61-8ef7-cea5fb76dca4', 'da8ddc68-fdf9-44b1-89d4-d20d353b6b09', '29242a7e-a05d-4cab-9687-128d4cbb8b0c', '7277001f-5e92-4ce0-899d-05730e152435', 'abed6c9e-cfa4-4620-81d2-46c6304d3a97'
);

-- mixed_tocopherols (good/good): 28 variants, 104 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN (
  'd5ee4577-608d-4ac5-8919-2f7704a4e468', 'c69f7c23-f8c1-4519-bfa2-b78ebd2ac75c', 'b27a0a89-cbb1-4969-b519-259eff245afc', '15d80928-7cb5-4701-9dee-c2aeb240142f', '3b298009-b786-4970-8854-082aafa7d731',
  'c4a78437-2118-4f73-9cd9-ee0377687476', 'f5090c2c-24f6-4c44-8057-f57f39e6f480', '22374ac0-3782-4826-8c1f-5adf105ba93e', '42b1e5fb-c6b1-4e82-8999-4abe999382d4', 'ac8e2a82-153f-4192-aa47-4528b7e70dcc',
  '89f74392-f03b-43e0-9a4a-2f16bb09dae6', 'ba9445e3-bdac-46db-ac13-6496747308bd', '40ba50c3-241a-4d9e-a03b-ad6393ca838b', 'f4426bc2-ab7f-4817-8654-a14096c976e3', '1295bfd9-5ad4-44cf-b200-003c95fff378',
  '30e55b1a-5e75-4fb9-ab6b-4f4798e19493', '547ee796-558f-4af2-bf1f-de7d721086d3', '5883e864-f734-4dab-9ec2-3148bb71ed77', '3a77a529-5084-40dd-8f4f-c15e07470d32', '90997fc2-aab5-45db-a189-7bf14844cb21',
  '4a0dacfc-82e0-45f7-913c-feddc8d156a3', '31d63e24-7f6e-4d8e-ad99-6a31988604f6', 'ff0b770c-7e1e-4be5-86d6-d07d3ce402a3', 'a43e44a0-4afe-47df-9afd-0a9f5623a12e', 'b8d05a2a-6ebf-441d-aa6c-1d4d61e5dacd',
  'c951e95a-258f-4896-b944-bef317ff4922', 'b43dd51c-fd74-494c-b2a8-26677bbcda29', '80ca0e2f-282c-44b3-adf3-b554dcb926de'
);

-- natural_flavor (caution/caution): 3 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('f53a3810-9b33-4702-b2bd-f2782fa53b3e', 'f8e7d3cb-10a0-4520-9d21-5ff256c6fa92', '34ae4c2f-f7f9-491a-a5e2-5daa6d276b0d');

-- pea_protein (caution/danger): 2 variants, 5 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'danger'
WHERE id IN ('5bed48a5-98d6-4a8f-a410-15f76a06cbdb', '30bc00d0-54b1-4c0d-b997-4f24be7dd3e8');

-- pomegranate (good/neutral): 2 variants, 5 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('c2b8375f-9a51-495d-95a6-0b755f62e0b5', '3e0952f5-44bf-4a94-a226-6f80ea7cdf04');

-- pumpkin (good/good): 13 variants, 118 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN (
  'a953d194-c107-4b68-b8b2-b339f2de7e6e', '13efdd3b-c51b-4063-8e3c-7fc91f14d842', 'bf1967de-2dd1-4e1a-b114-bc1f7f78bb41', 'c5045c0b-f516-4bc3-ade3-e92eaadf75cf', 'd675d712-5e81-4ce0-bcd8-7e244d0259a8',
  '5d84655c-76f4-4711-a378-ff241d14f17c', '6af80405-bba2-4251-b3cd-251f85e743ff', 'b30907bc-3ed1-464e-91c5-be9c35c771f5', 'c3ff4686-24df-4a28-802c-25298430950e', '22817dac-5b86-47fd-b27b-7d0c88a5f5d0',
  '83c4176c-091b-4b4d-a5c6-96bd692f9276', '17a0ffc8-5dc2-4e87-832d-989705bc13e7', 'f8285280-ca88-4525-ad35-d71e3c67d088'
);

-- red_3 (danger/danger): 5 variants, 5 product links
UPDATE ingredients_dict SET dog_base_severity = 'danger', cat_base_severity = 'danger'
WHERE id IN ('6f091a3f-04ca-496f-b7bc-81a0d15f9cc2', '10d6055b-17fe-4ec3-9a72-6f3c87efa536', '7fb93373-32f2-4e1f-9bd8-ccaa844482ab', '4acbe0c3-c09c-4161-9093-23d681edf096', '3c5868a9-d004-4a90-8050-f5a2f951c9b8');

-- red_40 (caution/caution): 8 variants, 23 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('9b2fcc45-41db-4ef0-9b25-813ff9aa543f', '7e189650-241f-47de-911e-92e1c2f4466e', '8c996778-71db-4c2b-a8ab-5128e6de8400', 'fcc14e2d-aac2-4d01-8dd8-a7a77e64bd9c', '320bdabd-330e-4989-8dda-8b7ba273a74e', 'f1d99322-fc4b-4e1c-b828-ea142cdb5f73', 'd0071156-7093-472e-bbe7-011238019320', '1f652509-f43b-4d16-be1a-54d7faebc6dc');

-- retinol (neutral/caution): 1 variants, 2 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN ('e5e2b185-99e0-4f0d-883e-e2d235cbb761');

-- rosemary_extract (good/good): 44 variants, 56 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN (
  '03a0555f-a40d-4e92-bf83-7e39e4cbb787', 'd16c2ad2-4961-4f79-a8d6-598bc5fce315', '0c2c8f88-0ad1-4f87-8014-34dfd19679f9', '60c9bb55-26ba-457a-969e-24bf99bd743d', '9187fb92-91f8-4615-a8bd-3075195391bf',
  'a8807ba4-f908-43c6-9040-2c8628573631', 'db27f86c-ea97-442c-9ad4-3436974fcacd', '22a3ccb4-27c7-4af0-b975-51ad7dc5d8d1', '1aaae1f1-1422-40eb-a433-c977a9782f30', 'dd85be24-7dff-4627-a874-3bac8b54361e',
  'ffb5df5e-638d-4995-b3f6-1df57661f472', '35d90b02-7a73-4c3b-b2b0-fa94c2d840c8', 'a86c9c35-74e9-4265-bdfb-7b620e022ee7', '1d74509e-79be-41b4-9229-ba53c7dbb902', 'e4710e5a-cfbb-4c99-93ff-fa2f8573d43f',
  '9c29592a-c302-41bf-88fe-262d0f6e006c', '18cb2d54-7281-466f-bc5b-a2abfc25e75b', 'c8348495-6054-4aef-a20c-57acf6a4701b', '609baa6c-0708-4cfc-abef-abb6c4a210a6', '7e4e2689-593e-4c86-8aff-48f23e8ce2ae',
  '18a10c79-de2c-486f-aa50-19847185ef53', '4a564130-429f-4686-b7b0-bcc3f4e3df09', '8e93b3e0-5607-4fba-9fa2-29c15bd233c6', '49931223-96cd-40fd-9f47-509fa9c7f0f4', 'c6fb39c0-ff5e-4765-a50b-72adc7b7f2db',
  '27f72e1f-d8ea-47b9-b82a-c6d9ad804027', '8bfd58e5-e212-4754-b86e-2be8427bd07b', 'be1cb942-d30b-4888-b54c-f688f0cb3ae8', '14e65cd6-981f-433f-ad86-3fbf8d5ff62c', '8b76026a-0ee9-4db6-a99c-ad4ba5ff7380',
  '2dee1974-47e0-4896-82b2-dac7fc106e81', '1b597c5d-7b1d-450d-af6e-d09c11928c8f', '30617213-6e1f-457f-b04d-89397bf46ebc', 'abcf1373-3f43-4107-99de-76f928ceff57', 'f1f95acd-623b-4a30-b2f6-a25796c3b98b',
  '65249268-cb3f-4c04-8b63-73e5c74d880b', '3b19e6c8-ba7e-46b2-8efd-18850660a59c', '525a1957-dfe6-415f-aece-e2c2d0e3ba91', 'a4e71c76-d355-43c3-bc4a-b3b9c784622e', 'b85408fd-7bee-4658-ae8c-fbfb812e3d75',
  '6f36b993-76e8-48c3-b927-c16a1ce9259c', '56b53b94-9381-46b6-85b4-67fa94478193', '230cf97d-8fcb-4cb6-b999-8a36d93baabe', 'dcea8c68-504b-491d-bca7-fdb0378cc7f8'
);

-- salmon (good/good): 23 variants, 101 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN (
  '14d1e76d-1934-48bb-9023-e688de1e630d', '2819e81e-0150-48e9-9094-3dc37f7fd813', 'df2ffc11-dedd-4570-ae75-f57a5b11c301', '3498d5d1-7767-44fa-bf20-3f57651f4e54', 'b74b494c-70bd-4500-8629-a61ad7b0a39a',
  'f6d6b805-06ca-4d8c-8744-76e4fdcab9cd', 'd381b19b-5f1c-4716-87f5-1158746e01c6', '70d39367-c7d3-42a1-b0a8-75e08bbb5c5c', 'c889bf6f-0a19-45f8-a1f5-6296cdaf304d', '76d66192-3f78-4fa2-8d44-2e53c030276e',
  'b2491a7a-3602-4790-8a6d-924076ee8070', 'fe644537-d59b-45c4-abad-57b7d88a0d92', '7a2821e0-4e45-46ae-8ca6-eec5d8ccb715', 'e833cb27-87b5-464f-903e-0d6a53c0d715', '062c21f4-c54f-4911-9af6-a4431d3f11a6',
  '8e9abd3e-925f-49b3-bb38-f714d7a1ad4a', 'ed6f04a5-9f57-4a3b-b79c-8ba0ea4d18e2', '165ee977-adc0-457a-a383-4ae4baa93d0e', 'd3f10fbc-009e-4bf3-9e37-2114c869060d', '88d71383-1cfe-4ba2-a47f-1ebfc5db85d4',
  'eb3b5dc9-b73f-4320-81e7-fb4cf94dd15a', 'df556f20-748e-4110-90e9-070ab5047e06', '748aaa5b-faed-4eaf-8422-bc8e945cd5df'
);

-- salmon_oil (good/good): 1 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('72920746-f3ce-4044-9187-93499979d796');

-- salt (caution/caution): 57 variants, 48 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN (
  '69db08f0-5846-4457-8068-4df6bf0861ce', '1f8c13ad-95f2-4e0d-b242-3d1622c7bc78', '9d49539b-777f-481c-8f1e-003357613b5a', 'c2eb192b-e369-43ec-b050-e65435422e80', 'fbab5433-41f9-43e8-adaa-8640ee3d0959',
  'fa1a4b13-de78-4efe-8fb9-6e3fb9904168', 'ac92ba33-b12e-46bc-aad3-cb8f7e41d7d8', 'aa0fd132-7e53-439e-b5a1-46eb0628bee4', '83c60e8e-bab0-4eef-a93f-20ea6cee3db5', '9f979951-c9c3-41a2-b711-6821c2eccb60',
  'a0543550-b9be-4560-97a3-57974d88e193', 'd139fe9a-a2e1-47f2-9927-976ea727d623', 'dbbde65e-9c0b-49ce-ba9f-a14572098c08', '810ee620-7a42-42a2-a54c-e0654154afa6', '16358cfc-1f48-4651-a047-0a835372db60',
  '2e3978c1-52ce-4edd-a775-bd86c938636f', '8d736a26-5792-4cab-aa33-064200e231dd', 'eee02127-31fc-44ab-9a2f-70645b5a5dd6', 'e221e0ea-afc1-435f-87e2-e1004ba7369c', '4ebaefb7-96ac-4efe-bd66-0d2bf34023d9',
  '337513a1-320c-459d-a162-43fd840a29ee', 'ac19c077-8f3d-4ca1-b59a-66d21a974bbc', '58811bec-e529-42ec-a3fc-ce72dca16353', 'd586ed8a-a649-40a6-a56f-1f35ef8820a8', '607cf869-0984-41b1-897e-3164067ccbae',
  '4d4db27e-c539-421d-82ef-c2dfa67c9663', 'e0b7da19-8aae-40cf-8926-48d310c46550', '19d747c3-94da-4300-96a5-64c7c6afddbb', '0c41c05c-6df5-4d64-9a46-dd767c500e80', '85d14c6a-65bd-432a-bb38-c589968256a8',
  '824c5335-0390-4456-8dd0-9bad661d349c', 'b781ffa5-7cac-4630-aa05-7271e4d3ab22', '5bf1f849-718a-4a7c-a5fc-f0ff66901142', '7f0ed6db-4334-464c-af71-300e42f88055', 'e82e5438-f292-4353-badb-8ed9cf54e877',
  'de6ef157-bc7f-425d-8adc-2371131650ad', 'c22f2ce0-7314-4977-85f9-0222bd2db2b0', '6d62ebd9-9475-48cf-8563-9538401a399c', '2b16c6b4-50cf-4ed7-8987-2bf33ac74c56', 'ef793487-b6d3-4480-99a5-4d40c745d3bf',
  '268a62f8-3a32-4bba-9b62-497d91ff5fd7', '9f1bdf0a-99cf-4cfc-9a28-a3224bc93e48', '0fbd257e-768a-43c7-9bc1-fb51bc6af504', '01d7a3fc-aad5-4670-8d7d-a08a6184d3a6', '849af0b8-8872-48b3-ba92-b1f5cf8efd52',
  'ddf519f8-9fe0-41f6-a1be-7fbd39bbe6cc', '96408d70-a8d1-47ce-be43-ba1a3ef4511f', '9d35eb89-de72-406d-a260-7e6214e26a13', '0d1f3bc7-34c7-41dd-8806-75f99336f54d', '5c383ed9-d08d-40fa-89bf-0dba480278d6',
  'c0287706-b78f-45ff-8590-740d209b68fe', '90bc6481-083f-4a33-b3ad-8b12324f7f4d', 'd8584a48-6d14-4a37-83fb-665a07537333', '0f4502aa-d8bb-403d-aaed-d4d6167d45f2', 'a5dcfb64-d0a0-43b4-9460-9836448ed434',
  '01d39a1f-d818-4e47-bb41-0e114ed6273b', 'ad056321-2013-48a7-9a61-85b803b5e21e'
);

-- sodium_nitrite (caution/danger): 26 variants, 0 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'danger'
WHERE id IN (
  'aaed5bd9-b643-4070-9337-7ecd5666f2b1', '29955f34-d4d8-4833-bb96-24faed6a11fc', '1a7d4c19-c97d-456b-a78d-cad3a924826d', '2c58ed6a-2cbc-4609-871a-c63ef1ee24f4', '08e2bf0d-130c-4da8-8947-e025fad13cb8',
  '67271892-bf90-46cb-8627-a3c27687af32', 'b252988b-a755-4e87-a45e-2d9f4f37e6d2', '9fcf2ba5-a3cf-41f2-8c3a-e253c28c6b48', '3621aeff-08dd-4358-9400-8b4ba12677e7', 'd98a261b-e63d-4a5f-a2b7-fc1049b8e86a',
  '6492ad7b-8aa2-4eec-87f6-54f7aa793bb1', '78da27e0-f42c-4ac3-8043-f5f5e0569eba', 'fe994d44-2887-4600-9592-8c91115022c6', '0a9f449e-72dc-411e-a499-c2fbfebedd6d', 'eef073d2-4a54-4366-97dc-f957ad09e015',
  'dcd5db2c-3de5-4551-a9b0-86864646fecc', 'd943b5b6-c08f-4ca1-b996-f066ca660e69', '43c9013f-95da-4dc9-abb6-caa2bb0fb283', '5581d3ee-8415-4e4c-8b58-c2775254fe3d', '79112cf5-9d4e-450e-8341-3936155c0fac',
  '4b53308e-073a-4bb0-a748-d60ce1de3bba', 'f216203b-0628-4200-84d9-3a01c6c5f243', 'ddb5f9db-8ac3-4648-bd19-bde33b796189', 'eb5b11bd-9bc2-47e9-b2d0-96ea57e8273d', '3ae3028c-c4f1-4c65-a2f7-a241e8359c89',
  '54bcf54c-7407-44c6-a128-fb9b111b9dc3'
);

-- sodium_selenite (caution/caution): 37 variants, 26 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN (
  'fd51b36e-4b4e-44e6-9cee-8313907b2c8f', '304de275-3b7d-4358-b80d-31b8e7798886', 'b4e8ab2a-de30-4406-adde-a0d93951cd5b', 'e6eece2f-b569-4398-8c7e-1b95e0f6159e', '451bbb04-b1d9-4fa8-82c4-6e250f64f2f1',
  '8b59deb3-bf0b-478f-a7e0-de74fd4e9143', 'f74762e3-5a40-441f-a12c-52181a30ce37', '42c6122d-1a8c-4ab2-9f12-85f66bbda722', '21475e0c-117e-4d1b-936c-c95a907b4226', 'a64cd69b-00f2-4441-a3ca-0b1d08c6f4ba',
  '4b9fbed3-549c-4d3e-a5ad-719035f674f0', 'ccd0a5a1-cfeb-4439-82e7-31002cfdbb1e', 'f5febee1-b56f-402d-bb3a-bb63b828c626', '53581f42-4b39-4dcd-ae16-db70b01fd729', '9a0c9339-e1ff-476a-b891-af2cffbf2e30',
  '922182e5-c5e2-44dc-af5f-9a9c28aabda4', 'f9822f32-10d9-402e-939d-962877edb7a3', '43e9617c-9624-4da4-a9ef-25f084ce573d', 'da09310a-dff9-478b-b654-cde1d7f4e73c', '0ac901ca-94d9-49f7-a9d5-bb65d6261d68',
  '9e79e6be-b498-4285-aa0a-aaee25729f21', 'bf5f43a1-64b8-4848-b70a-abdd9f8ff848', '4e4494f4-b38c-4734-8ef8-b67dc6bae96a', '88924cad-6b50-4467-b5d2-cacc0372c171', '7226a8dd-5caf-4e4f-a2ce-20c0613ed47b',
  '39559049-6c5e-46e4-82c5-ad7b2b150d5f', '2342a2f4-7b81-477a-86fd-80f0b043692f', 'a05ebf4b-2ce8-4a5e-95a6-b3a1f891eecb', 'acd9bdad-40db-4331-bd12-4225b0ccc7af', '949794ff-c1cb-4742-ab48-214fba1cb88f',
  'a4e22fa7-5bca-4f09-a059-0578551b4a2a', '86fffb24-3258-4f5c-8b22-d00ad0893856', '8d50637d-432a-4b88-b30c-383039b2171a', '7c3b9e5e-ef66-4652-bddd-f4c812dbd16e', '8cbe65d0-fd03-4371-9440-c00f2c498170',
  '9fc23a92-2096-43c8-8d76-3cd00654ab37', '05ae0201-d6d7-4cb3-bb0f-d774091ecaa4'
);

-- soy (caution/caution): 11 variants, 864 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN (
  '38166c06-3e3e-4e34-a1be-a1e1b2740f6f', 'e83d2812-73e3-48b2-9f70-d43c66fd6669', 'ee8c66c1-cf1e-4491-9129-d5080b05834a', 'aa8bc3b3-33de-45c0-a045-dfc3fe325c9a', 'c1791fda-966c-4449-b406-25a12f067104',
  '15860bee-8d67-4ca2-b945-b29dbbbf6286', '64c8d984-a254-48ad-bb3b-6e48f7bc5a4d', 'c2a0f3a3-4517-4287-bfa7-4ac3c08d0a00', 'b2bcfcf1-b738-47c4-bb00-6df4712a0ed7', 'da3ff041-06e7-47de-a9df-c86d6b87beb1',
  '7e4bee84-f639-4c99-a917-c34a8b849260'
);

-- spinach (neutral/caution): 2 variants, 5 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN ('99f87487-c079-4c71-a098-eb5d8337e57c', '8a73c56b-6c70-4866-a3c0-44c22966ee44');

-- tapioca_starch (neutral/caution): 3 variants, 22 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN ('deb29534-a390-4d9b-bacf-5b8ef24aedcf', 'e19e8cef-7fcc-40f4-8b88-403c7a2c978f', '88222133-cb4e-4db3-85db-2a339b5bab04');

-- taurine (good/good): 31 variants, 37 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN (
  'a5fe5517-44b0-47dd-a2e7-fec2abb5275a', '9be9e007-2f86-4c37-8db4-c7fde831f5dd', '26b3790c-0b00-4f29-9ab4-143d2715ef26', '9a45b035-1e4d-41bd-9a73-a31f2352c3ff', '14279f78-ce6f-4d4d-abf1-8b169dbb6291',
  '30a1aa27-0d2e-4d45-bb74-dc92ee8a2301', '2c372ab5-cb88-4fd0-9afc-fd2bcba47d51', '38f1090c-fa98-45fd-8370-54d76752929b', '8240f417-eb8b-4c96-93b2-805e97ad53c0', '2ce1e661-8a9f-4c9a-8994-3fce098f4c8f',
  'ea78e679-342b-43ff-9746-a0fc4bbace84', '1ff00d40-22f3-461d-a710-463bc7f6a6ab', 'acf01aba-53b5-487b-9bdc-678869893fb2', '7232a507-aeb4-46a9-98d1-b3e911fd751e', 'fd5e6c47-1e7b-4a79-8c14-9ee2731e6228',
  '1e6dad7b-b8d6-483f-a1a4-d989cbf7faae', 'a2f45b05-696a-436c-a663-50768b4321e1', '8c260bbe-9e2b-49a0-b04e-f025e508d7a1', 'dbc1dec2-de78-4d9d-87cd-a9aaa98b93e1', '4b96c873-d974-4937-bd04-60ab68916d2f',
  'e896d391-bf24-4c38-b267-958f9f4d399a', '01095f0e-c30b-42f8-82f9-e8e3e5e285ff', '4c9a059d-c4e7-4430-9dbe-b34a61ddb69f', '128d4065-6ad8-4846-a95f-28bce81d4046', 'b6e3d1c9-5c26-42e3-bfee-7c34ffd6cf72',
  '32eb4e5b-eb34-4369-a07e-1fd685f8ca58', '7b44d751-cfe3-41ca-a6f2-668a58262ffe', '8c840aa9-7fd2-41dd-9417-955962ea69c3', '244a5856-3497-49bc-b313-58e9141cc875', '868bd186-0519-4b13-8b9b-733dd83f4df1',
  '53548dbd-dc7b-418f-bf32-1c1c89169980'
);

-- titanium_dioxide (caution/caution): 1 variants, 14 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('62888a6e-7b55-439c-81bf-f5fb56749c47');

-- turmeric (good/neutral): 8 variants, 59 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'neutral'
WHERE id IN ('88fa2a72-951c-4b9d-b966-d526f29757d8', '96feec02-6837-4abe-86d3-96093040248d', '962e9265-a9ce-44f2-971d-bd7109f51e02', '9a708920-bc02-4ae6-b902-fa7b3117b7a1', '8f185198-91e4-46e9-b2c9-a72dee16f20a', '92ba9c60-71dd-4fd9-bb2c-e6031519564e', 'bef7e3a2-2228-4799-b57c-fdde6c9ccfa1', '930519d1-5bfa-4ce8-b56f-d67c400c1b39');

-- vitamin_d3_supplement (caution/caution): 195 variants, 227 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN (
  'f046661c-91bc-4b70-bada-aff643d8e745', 'ec8ddfb2-0ba7-4ebf-8849-438feb775074', '8814216d-5271-4a90-940f-3b1143621f44', 'f828bdda-7aff-4bfb-a880-3a0617bc8e8b', 'd065ea3d-6caa-4b36-9b83-a558f59ebd41',
  'f84b07f7-2d09-416c-ad97-325ff1b70048', '313c8224-0b9f-4136-a889-1407d7199e26', 'd408451a-9a38-4267-b41b-912619b5786e', 'd5c9239d-82f0-4e77-a549-dceeab755dd4', '3a1f78b6-657b-4fc1-8500-74c5642fbcd0',
  '02020010-e97d-4258-87c2-332c32633c0a', 'f997b5ce-09e7-4234-b232-60fe46302763', 'dd4de4d5-19e6-47c4-bdcf-156b9ce52cb4', 'e5c41b0a-dfc7-4b3c-9336-d47cdb1f13a6', 'a5a45592-babe-47c2-ba7f-32b8006477df',
  '3280e9a2-c87a-49eb-b256-99f826aa7239', 'b219e6df-5869-4b32-9adb-19331af765ee', '64b43464-54cc-476f-a76a-647974e2f950', 'f7f6ea9e-a280-4423-ba71-cb6a3e66921d', 'fd0f4c86-6450-4a7d-9051-9a12dc453189',
  '785e65d2-8a03-4b70-94d6-9aba8ef0cd4c', '77976ccc-0a3c-4cd1-8797-fde31e823ce3', '066213fd-5ac0-4ff1-8c63-f11a7a463010', '22ee3fab-8a0a-4356-b904-b6ce31134c97', '6ec4bc6b-6d0d-41cf-903f-73cf77f2e0f6',
  'dcb6c74a-f73a-440b-bea5-69f2da04a3d5', 'aea44bb6-cc5e-40d5-abbd-a5095e11afe0', '888e47c7-f916-4023-870e-787f11b5903c', '63af5f45-93f1-4ea3-b6b1-6ff7edb679ca', '3f4e1baf-3cf5-42cb-9801-69e54e87e686',
  '660294f7-4389-4e82-9f42-6143cf24c6ff', 'fea94a22-3c1c-4e9a-9793-f563d142f43a', '4adbfc06-6755-4623-89bc-5cf283ec5f49', 'c69f171b-0e8d-4a7a-a45f-b01271352c99', '80dfa8fa-1aad-4955-ae52-985ccbc8c638',
  '9059298b-288b-4417-81cd-799b01d93a9f', '6a4c0d59-f8ba-406e-ba48-1ccef4c11f50', 'c3306e9a-a32c-4290-8e05-89cdec398c2d', 'ba2e9301-565d-4dd6-b321-27f022a4cca9', '150ee0d7-c7ae-4715-a8cc-50c7cf72b3b0',
  'ddb57d06-1f7d-425e-9971-801cfeb54c25', '3ccf6745-5a13-4c57-bf2b-ee4b31ef1bb6', 'eefc23ab-8e56-4fdf-a808-ad7a407dde36', 'a71137c6-0c71-4f80-91a9-d050ccf5a7cc', '03251fe2-4d25-41ce-9512-c4602384cb69',
  'c5a9df83-a4ec-4699-b288-d4ad74ac9b23', '2ded75b6-9888-49f4-90fd-2851c233cbb1', 'f20028c7-906f-41b4-8155-91ad7a5504af', '3faef55c-8f20-4d11-9dc8-85e4efe9db89', '4b1d5701-13cc-4059-8c69-134158dbbd40',
  'fc7a2643-979d-404b-be98-dbf19e512637', 'f97733e7-0e7d-45ec-a74c-55a920790c20', '0bf16032-8307-4be4-a339-06e33e7c6d27', '93c95de6-0cf6-4c13-9b11-62d1daf8a512', '074ebe91-0d27-43a0-bc7a-3461099386fb',
  '22f608ed-0cbc-44fa-9df6-5acf2168cf58', '8035f2df-f23a-425f-b750-7bea447e8947', '77cd6304-2672-4f5d-b380-5882d88b0233', '4646b545-aecc-41a7-839f-4bc408cc4c70', 'c6a1620e-da4a-42dc-9aed-51ffa1b1dc55',
  '38f234e0-7842-412e-ae8c-90f103dce95a', '5baf8c87-1031-4d46-9bbc-dfe17fb31269', 'c04fa197-d9cf-4794-ba05-e1b8bcc57aad', '90af1e0a-d5fa-499d-8327-71ca890e6a88', '13acec33-80d7-455f-802a-aba918f178ec',
  '48a63aba-dd20-42af-9e9c-98d6d958a962', '12fa1eb0-cb46-4ab3-a34c-6baa2d1a95c2', 'eba0cced-703c-4aa0-8ab6-5fa1fe23c72c', '50d500ce-b363-490c-b4b0-e0156810e11e', '91c1093c-62d2-48eb-98cd-f943d571db7b',
  'c1c7b25c-7988-47bb-be75-d77970956eb6', '58f62311-2e8c-42ae-86e4-a62d0ff2844b', '6c042931-c927-4f1b-87cc-55278aafef51', '55431a8c-f937-478f-8de6-fe12fb61c314', '5ff173e6-8302-4a01-a433-3c31a4c82330',
  '8dea023a-3ff4-41c4-9835-3d4347dd1022', '64d75595-907b-4bd3-be7b-e9563c603ecd', 'a2f81688-402f-4f86-b7e7-e0a16c6404e4', 'b99b5d4c-70b6-41c8-86db-8af01d4ad47f', '721b5c7f-7e33-438c-ab64-66358bb39e6a',
  '5247e71e-95dc-4887-86f3-c3f909cae17a', 'a0ff0173-68d4-4c9e-bd06-9b8cdf60443e', 'e5b8778b-5675-48b6-8e11-27170f6acee4', '198fa8e2-96aa-4ac1-8508-7b9fe1c89d32', 'd6f014d8-483d-4563-8854-087d069d7bb5',
  '1dcf5e93-46d1-460f-b1cb-25176b23190f', '18e581d7-fb26-4fac-8dd5-688b517e554d', 'd0ab3a6d-8593-4968-80c6-cff7285e6fc1', '96044caf-6619-4ca4-8113-78ab7e94a36d', 'a6c37b36-4592-4bae-a811-f8ad1ee77be0',
  '9a8adc04-abda-4ef6-9cbd-dd536748321f', 'ea6cce54-4b95-4afc-8d29-23f966a8a28e', 'b8f98685-05f8-4891-bb29-8f57fb4bc621', '51c5f597-270a-4ca2-acee-a19436d4ebc8', 'acaed809-d048-4d99-b75a-6ae375dd138b',
  '16eea7a6-41a9-43b1-a00b-d6134cd8849e', '37fd81cb-cdd5-4503-ae50-f5931af80cef', '791c85d8-bca2-4803-820c-62f817aeec85', 'eb4dd5d2-9cfe-43c4-a088-cb3c55a48a4b', '161cc85d-8f82-496f-96f0-91f50398d316',
  '7575ba8b-a673-4fef-98d7-d84e07a4ba51', '400655e6-8596-4363-adcb-75a6efe6ed48', 'ac2d09df-c00d-489c-a8b4-82f5fb5fb61a', 'c656608d-2a3c-41ce-a111-38349c57f3eb', 'ed6f4d06-4795-4e47-919a-f80112bf56bf',
  '0e2c64b2-4355-4e3d-a944-32978accb1af', '91699a93-0ec1-4793-874a-bf69e2a9d489', 'c1d00431-3f5b-45cd-934e-f2640f9348ba', 'e74a5867-7b00-4133-b430-e6bdda4ac3e3', '681cc49a-2558-4255-aa6c-5c60b2e731f7',
  '8cba7828-eb8f-46ef-aade-b2ff60525f61', 'f4fb34d5-4bef-455a-bfc5-ae4017dd48c9', '4bbd0507-a98c-4577-aae2-bb3a77cfc34a', 'd0ea0012-fd39-48b1-82d9-cf110fbc2ece', 'd2477200-55bf-42ef-9a66-e0521618d1c3',
  '9b4d4149-d47e-42e7-97eb-ad7e9a1f73d3', '4037472f-37a4-4aac-8b6f-f7ec15ea7889', '65a14330-b367-41ae-98bb-40b7b5a23614', '49d228ba-77c7-49be-bd9a-8fae391bdee9', 'b59b8b1b-8561-4058-9808-189d6545f776',
  'f4a20dff-1291-4653-a8c7-631b5c2d06c7', '23dbbd98-ebc0-4e5f-b466-3422634df2df', 'db3cc847-13e7-483d-bdab-7e61f8c4a152', 'ab145864-066c-43f9-980d-7b4470ddd6b7', 'aecdce8b-af87-4a32-af2a-08ef7a46dddc',
  '9581a915-5fa1-4aec-b6f1-6980f0d07ce3', 'ee4cf288-71a7-4f3e-af6b-f2ba2d7e9b26', '2ce13dac-3ed3-4e4b-8ab0-6417c96eceb4', 'bbcb8529-daa8-4dbb-ab99-023eac97af7c', '7e52fba6-7208-4cfa-b33a-bbedb1f3cb50',
  '17c0772e-305d-4a04-865c-927ae6012ada', 'bbf00668-0221-43a5-a9c2-fac2e01ba1a9', '329813fa-6add-40d5-9aca-6c25f8239873', 'ee51a4e2-254c-4abb-b975-11f5c87d4765', '001f7ae0-72a6-41c4-94c0-31b2447d8235',
  '5dc3455a-d680-4e7d-9a95-83e5dea48e32', '5faacacf-c00b-4476-b1a7-cccb710f910b', '02f701aa-4cc3-4fc3-8a8c-879baae8729e', 'a6e53ee7-3867-41b4-85f0-6d531607c953', '77c08a89-71a4-4655-b0f6-707698570c91',
  '0c0e2359-6586-4a56-8197-ce00d9fd1b7f', '1742c066-1df8-47bf-82a4-61a9b128b499', '1e26f2db-bc68-4f88-884b-6c99a9b0e5c6', '111b762f-c2c2-4077-8385-c36411f3f754', '1d91b96a-7cf0-48d6-9031-cf8cbad66e03',
  '34efcf26-dbec-43e2-92b5-1b88ee105873', '3a96ec01-efef-4f12-aad4-c61a042badba', '98794be7-cbb7-4a35-a9e5-0e40192b8277', 'dd072273-92c0-4b9e-b9f8-9a13c5a933e2', '5c39cd89-16d7-4137-a0a7-1926692e2452',
  '9f823dd3-f653-43fc-b079-bbdd131d2d70', '833147b2-dba4-4fc8-bc0b-a4e999aaf748', '41a28a39-d314-4247-8862-4e32f5c4c8e0', '218fae2e-774a-40cb-bfe8-66474395b061', 'dd55f6ba-79e1-47a0-aea5-e047e9834f28',
  '6c5586ba-559d-4ca4-afe6-aad2a6927490', '5c1e8586-abb3-4149-8e40-daa5832c798a', '7ad7dc56-847e-4385-9963-33cc2f2c1a86', '124e7973-891f-4160-a111-7ac62851e5ae', '9fde1a45-7a24-483b-9ab1-3c3172952ac9',
  '456a0842-f505-494b-8f22-4b978cc9adb5', 'a557d74a-4718-4384-9bd9-e4910f2c3311', '59ab9b8d-11f6-4656-b7ca-82f18a26f80b', '0e369c5c-56ce-493e-9f46-f0a7a9285d52', 'aab1c409-4743-437e-8e60-1d897a0916a8',
  '084db567-2f56-4390-acbb-7f5d2f34452c', '26eddee0-c4fd-4786-9e9c-b9a59c182a96', '0b57578c-e185-4939-8b74-173b48586355', 'dfcaacc6-504e-4018-a6c9-744aa799a354', '9907fb7d-574e-456e-9ccb-fffb29bb7f7b',
  '07533fb8-1036-4f96-8a7c-79f5ad0e7cac', 'c5f055ac-e353-4f37-ba65-67245506a9cb', 'fbe45d1d-54ed-4e0e-a270-080a68716826', '96b750bc-721a-4ad6-a22f-c26d3870e975', 'eae165cc-c311-442f-b0f9-8733a3f4e43d',
  '370be8f2-8fb3-4b6b-9306-f31d111d3721', 'd09635af-0190-450a-96fb-869a6911a698', '6af5299a-106a-4246-80ce-94bd885b5860', '1a5200eb-826a-4eb9-8ea0-cf3392f3a0a0', '4d28e657-1476-4147-93fd-2eaa15f2e548',
  'fa78e594-5b3e-4e42-a932-7ccaea86896a', '56d67f69-ae18-4eff-b692-0fc9f9a0dc4e', 'e053702e-5f2e-4b3a-b119-03df68d4c651', '4400d49e-52d6-40fe-b381-f495b526725a', 'c4055908-d3b5-48c1-82c5-a2b781daf432',
  '08a8607e-0951-404a-861f-c168279150c9', 'abe9f651-22d7-4671-8031-778b84841fbc', 'f5ada6af-f725-4762-b84e-3f65ac1dbec8', '3b0bdd6d-2547-4851-9950-96d1ab2da6ba', '6c13d759-866b-4463-a8dc-ca6b48aa62f9',
  'fe51406c-b5a6-450d-abb3-b7e416a2d2e7', 'cd5afe69-0079-481f-9e68-514113a6add9', '9d14bb29-9df6-46ac-89ff-ebfc71867d53', '0aab5112-47d6-4783-b457-5800fbd445d6', '94ae1da6-1d7f-48b6-b4d3-9949d273589d'
);

-- wheat (neutral/caution): 14 variants, 1204 product links
UPDATE ingredients_dict SET dog_base_severity = 'neutral', cat_base_severity = 'caution'
WHERE id IN (
  '86157126-efeb-4142-a351-25fcd4308379', '41de331d-788b-4c4d-914a-f144008f23f4', 'a67931c4-5789-4c5d-ac88-ec691beffdca', '1114b6c5-b9c9-4cb0-87ad-2a0aa699d2c4', '5b683263-8bdb-4e60-a432-c52b7fc5d09f',
  'ed33c6ca-59a6-44d0-8cb4-a2f3c27da7c6', 'e769518d-4656-437a-bf1a-f1e71848aad5', 'e674542e-623b-436e-80fb-822866f97f4c', '9f79581d-c3f1-4d3b-8297-f10700787cde', '1208494d-5530-44d0-b1d6-d2f4b4aa927f',
  '7cf7ec9d-25a1-4f5e-815f-9d1b3e98f464', 'c6e5778b-58e8-4e59-a9eb-7a0d09dba950', 'dbd0b1f6-94d6-489b-a88d-b9d15c912561', '9254297d-3a5d-44cd-82fd-8869bfb08eff'
);

-- yellow_5 (caution/caution): 6 variants, 13 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('717e46ba-7ede-4517-92f4-d41836c73235', '91763e20-00a2-48ca-ba4a-7746dbb80fca', 'af9286c6-8abb-4d8b-86b0-c8cc4e7dd3c9', 'a0d845c8-4904-41af-9c4f-0ac3a94ca521', '31d91d6e-022a-4527-a08e-f66e01f9d66a', 'be4df861-3b5b-4c7f-af71-dc35d8ef18b1');

-- yellow_6 (caution/caution): 4 variants, 17 product links
UPDATE ingredients_dict SET dog_base_severity = 'caution', cat_base_severity = 'caution'
WHERE id IN ('d0f1bd1f-2925-4bc2-95ac-790743c3fe86', 'd1b0b55d-e64a-4eff-bda6-f1e3cb9c4f18', '1f83afa4-f256-4344-8724-ed29218a7174', '9e90ecc0-ce14-4bf2-b16b-6309d0b0b34b');

-- yucca_schidigera_extract (good/good): 6 variants, 6 product links
UPDATE ingredients_dict SET dog_base_severity = 'good', cat_base_severity = 'good'
WHERE id IN ('ff49a903-854a-409b-89a9-353744a3143b', 'edd6a951-e910-4b61-8991-e8d9dcaa4cc9', 'bcabb5a3-a8e8-40ff-97b5-8ab78c22de46', 'e25f6910-9036-4d94-88ae-7fcc6491c29b', '0a3f512e-d8f8-4548-9c27-40b4faf81078', '521f2ea8-2d5c-4a13-91e5-020e70c1d1fd');

COMMIT;

-- SUMMARY:
-- 859 rows updated across 61 ingredient families
-- Severity corrections:
--   neutral -> includes caution: 575 rows
--   neutral -> includes danger: 33 rows
--   neutral -> good (beneficial): 251 rows
-- 4 edge cases excluded (review separately)