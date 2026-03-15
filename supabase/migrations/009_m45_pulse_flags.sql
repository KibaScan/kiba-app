-- D-137: Pulse classification for DCM detection
ALTER TABLE ingredients_dict ADD COLUMN is_pulse BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ingredients_dict ADD COLUMN is_pulse_protein BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN ingredients_dict.is_pulse IS
  'TRUE for peas, lentils, chickpeas, fava/dry beans and ALL derivatives (flour, starch, fiber, hull). Excludes potatoes, sweet potatoes, soy, tapioca. D-137.';
COMMENT ON COLUMN ingredients_dict.is_pulse_protein IS
  'TRUE for pulse protein isolates/concentrates ONLY (pea protein, lentil protein, chickpea protein). Subset of is_pulse. Triggers D-137 Rule 3. NOT pea starch, pea fiber, pea flour.';
