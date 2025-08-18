-- Create product_margins table to store margins for each product
CREATE TABLE IF NOT EXISTS product_margins (
  id SERIAL PRIMARY KEY,
  shopify_product_id VARCHAR(255) NOT NULL,
  shopify_store_url VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  margin_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  supplier_product_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shopify_product_id, shopify_store_url)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_margins_store_product ON product_margins(shopify_store_url, shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_product_margins_store_name ON product_margins(shopify_store_url, product_name);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_margins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_margins_updated_at
    BEFORE UPDATE ON product_margins
    FOR EACH ROW
    EXECUTE FUNCTION update_product_margins_updated_at();
