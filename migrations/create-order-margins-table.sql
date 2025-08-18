-- Create order_margins table to store margin earned per order
CREATE TABLE IF NOT EXISTS order_margins (
  id SERIAL PRIMARY KEY,
  shopify_order_id VARCHAR(255) NOT NULL,
  order_number VARCHAR(100) NOT NULL,
  store_url VARCHAR(255) NOT NULL,
  margin_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  product_details JSONB, -- Store line items with product info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shopify_order_id, store_url)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_margins_store_url ON order_margins(store_url);
CREATE INDEX IF NOT EXISTS idx_order_margins_order_number ON order_margins(order_number);
CREATE INDEX IF NOT EXISTS idx_order_margins_shopify_order_id ON order_margins(shopify_order_id);

-- Insert existing order margins based on your current data
INSERT INTO order_margins (shopify_order_id, order_number, store_url, margin_amount, product_details) VALUES
('1004', '1004', 'teast32123.myshopify.com', 1000.00, '{"product_name": "labubu doll", "quantity": 1}'),
('1005', '1005', 'teast32123.myshopify.com', 115.00, '{"product_name": "Cupib Perfume", "quantity": 1}'),
('1006', '1006', 'teast32123.myshopify.com', 0.00, '{"product_name": "unknown", "quantity": 1}')
ON CONFLICT (shopify_order_id, store_url) DO UPDATE SET
  margin_amount = EXCLUDED.margin_amount,
  product_details = EXCLUDED.product_details,
  updated_at = NOW();

