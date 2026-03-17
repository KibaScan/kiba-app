-- Migration 010: Add product_form column to products table
-- Values: 'dry' | 'wet' | 'freeze_dried' | 'raw' | 'dehydrated' | NULL
-- NULL means unknown/unclassified. No default.

ALTER TABLE products
ADD COLUMN product_form TEXT;
