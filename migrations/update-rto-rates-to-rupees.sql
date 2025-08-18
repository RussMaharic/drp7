-- Update existing seller_rto_rates table to handle rupee amounts instead of percentages
-- This script should be run after the initial table creation

-- Increase the precision for rto_rate to handle larger rupee amounts
ALTER TABLE seller_rto_rates 
ALTER COLUMN rto_rate TYPE DECIMAL(10,2);

-- Add a comment to clarify the column now stores rupee amounts
COMMENT ON COLUMN seller_rto_rates.rto_rate IS 'Fixed rupee amount penalty for RTO orders (e.g., 100.00 for ₹100)';

-- Update any existing percentage values to reasonable rupee amounts
-- This assumes any value <= 100 was meant as a percentage and converts it
-- You may want to review and adjust these values manually
UPDATE seller_rto_rates 
SET rto_rate = 
  CASE 
    WHEN rto_rate <= 100 THEN rto_rate * 10  -- Convert percentage-like values to reasonable rupee amounts
    ELSE rto_rate  -- Keep larger values as-is (already rupee amounts)
  END
WHERE rto_rate > 0;
