-- Create order_tracking table for managing tracking IDs
-- This table only stores orders that have tracking information assigned

CREATE TABLE IF NOT EXISTS order_tracking (
  id SERIAL PRIMARY KEY,
  shopify_order_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(255) NOT NULL,
  store_url VARCHAR(255) NOT NULL,
  supplier_id UUID,
  tracking_number VARCHAR(255) NOT NULL,
  tracking_url VARCHAR(500),
  carrier VARCHAR(100),
  status VARCHAR(50) DEFAULT 'shipped',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'admin'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_tracking_shopify_order_id ON order_tracking(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_store_url ON order_tracking(store_url);
CREATE INDEX IF NOT EXISTS idx_order_tracking_supplier_id ON order_tracking(supplier_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_number ON order_tracking(tracking_number);

-- Create composite index for fast lookups
CREATE INDEX IF NOT EXISTS idx_order_tracking_order_store ON order_tracking(shopify_order_id, store_url);

-- Add foreign key constraint to suppliers table if it exists
-- ALTER TABLE order_tracking ADD CONSTRAINT fk_order_tracking_supplier 
-- FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_order_tracking_updated_at
    BEFORE UPDATE ON order_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_order_tracking_updated_at();