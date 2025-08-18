-- Add customer_phone column to supplier_orders table
ALTER TABLE supplier_orders 
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_orders_customer_phone 
ON supplier_orders(customer_phone); 