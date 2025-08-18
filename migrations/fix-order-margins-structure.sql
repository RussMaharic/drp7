-- Update the order_margins table to match how orders are actually stored
-- The shopify_order_id should match the shopify_order_id from order_status table

-- First, let's see what the actual shopify_order_ids are in order_status
-- They are likely the full order IDs like the ones in order_status table

-- Update existing records to match the pattern from order_status
-- For now, we'll set them to match the order numbers since that's what we have
UPDATE order_margins SET shopify_order_id = order_number WHERE store_url = 'teast32123.myshopify.com';

-- Add a trigger to automatically create order margin entries when orders are confirmed
CREATE OR REPLACE FUNCTION create_order_margin_on_confirm()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if order status is 'confirmed' and it's a new confirmation
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Calculate margin from product_shopify_mappings for this order
    -- For now, we'll insert with 0 and update via API when we have line items
    INSERT INTO order_margins (
      shopify_order_id, 
      order_number, 
      store_url, 
      margin_amount, 
      product_details
    ) VALUES (
      NEW.shopify_order_id,
      NEW.order_number,
      NEW.store_url,
      0.00, -- Will be calculated by API
      '{"auto_created": true}'::jsonb
    )
    ON CONFLICT (shopify_order_id, store_url) 
    DO UPDATE SET 
      margin_amount = EXCLUDED.margin_amount,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_create_order_margin ON order_status;
CREATE TRIGGER trigger_create_order_margin
  AFTER INSERT OR UPDATE ON order_status
  FOR EACH ROW
  EXECUTE FUNCTION create_order_margin_on_confirm();

