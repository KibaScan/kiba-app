-- D-136: Supplemental product classification
ALTER TABLE products ADD COLUMN is_supplemental BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for scoring engine weight selection
CREATE INDEX idx_products_is_supplemental ON products (is_supplemental) WHERE is_supplemental = TRUE;

COMMENT ON COLUMN products.is_supplemental IS 'TRUE when feeding guide contains AAFCO intermittent/supplemental language. Routes to 65/35/0 scoring weights (D-136).';
