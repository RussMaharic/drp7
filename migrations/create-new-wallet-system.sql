-- Create store_product_margins table to store individual product margins per store
CREATE TABLE IF NOT EXISTS store_product_margins (
  id SERIAL PRIMARY KEY,
  shopify_product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  margin_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  store_url VARCHAR(255) NOT NULL,
  supplier_product_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shopify_product_id, store_url)
);

-- Create new_order_margins table to store calculated margins for orders
CREATE TABLE IF NOT EXISTS new_order_margins (
  id SERIAL PRIMARY KEY,
  shopify_order_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(255) NOT NULL,
  store_url VARCHAR(255) NOT NULL,
  margin_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  product_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_number, store_url)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_product_margins_store ON store_product_margins(store_url);
CREATE INDEX IF NOT EXISTS idx_store_product_margins_product ON store_product_margins(shopify_product_id, store_url);
CREATE INDEX IF NOT EXISTS idx_new_order_margins_store ON new_order_margins(store_url);
CREATE INDEX IF NOT EXISTS idx_new_order_margins_order ON new_order_margins(order_number, store_url);

-- Add triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_product_margins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_store_product_margins_updated_at
    BEFORE UPDATE ON store_product_margins
    FOR EACH ROW
    EXECUTE FUNCTION update_store_product_margins_updated_at();

CREATE OR REPLACE FUNCTION update_new_order_margins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_new_order_margins_updated_at
    BEFORE UPDATE ON new_order_margins
    FOR EACH ROW
    EXECUTE FUNCTION update_new_order_margins_updated_at();
