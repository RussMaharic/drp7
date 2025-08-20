-- Add payment-related fields to sellers table
-- Run this migration to support Cashfree payment integration

ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS payment_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

-- Add index for payment order lookup
CREATE INDEX IF NOT EXISTS idx_sellers_payment_order_id ON sellers(payment_order_id);

-- Add comments for documentation
COMMENT ON COLUMN sellers.payment_order_id IS 'Cashfree order ID for seller subscription payment';
COMMENT ON COLUMN sellers.subscription_amount IS 'Amount paid for seller subscription (25000, 50000, or 75000)';
COMMENT ON COLUMN sellers.payment_status IS 'Payment status: pending, paid, failed';
COMMENT ON COLUMN sellers.payment_date IS 'Timestamp when payment was completed';

