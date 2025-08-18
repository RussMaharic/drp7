-- Add unique constraint to order_status table
ALTER TABLE order_status ADD CONSTRAINT unique_order_store UNIQUE (shopify_order_id, store_url);