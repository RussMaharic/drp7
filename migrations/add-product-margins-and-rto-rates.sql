-- Add margin column to product_shopify_mappings table
ALTER TABLE product_shopify_mappings 
ADD COLUMN IF NOT EXISTS margin DECIMAL(10,2) DEFAULT 0.00;

-- Create seller RTO rates table
CREATE TABLE IF NOT EXISTS seller_rto_rates (
  id SERIAL PRIMARY KEY,
  seller_id VARCHAR(255) NOT NULL,
  store_url VARCHAR(255) NOT NULL,
  rto_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Fixed rupee amount (e.g., 100.00 for ₹100)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'admin',
  UNIQUE(seller_id, store_url)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_rto_rates_seller_id ON seller_rto_rates(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_rto_rates_store_url ON seller_rto_rates(store_url);
CREATE INDEX IF NOT EXISTS idx_product_shopify_mappings_margin ON product_shopify_mappings(margin);

-- Add trigger to update updated_at timestamp for seller_rto_rates
CREATE OR REPLACE FUNCTION update_seller_rto_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_seller_rto_rates_updated_at
    BEFORE UPDATE ON seller_rto_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_seller_rto_rates_updated_at();

