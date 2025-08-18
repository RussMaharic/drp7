-- Add product_name column to product_shopify_mappings for easier matching
ALTER TABLE product_shopify_mappings 
ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);

-- Add index for faster lookups by product name
CREATE INDEX IF NOT EXISTS idx_product_mappings_name 
ON product_shopify_mappings(shopify_store_url, product_name);

