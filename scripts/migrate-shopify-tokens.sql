-- Migration script to populate username field in shopify_tokens table
-- This script should be run manually in your Supabase SQL editor

-- First, let's see current state
SELECT id, shop, username, created_at 
FROM shopify_tokens 
ORDER BY created_at DESC;

-- Update records that don't have a username but might be associated with a user
-- This will need manual review based on your specific data
-- Example queries (uncomment and modify as needed):

-- Option 1: If you can match by timing with seller_store_connections
-- UPDATE shopify_tokens 
-- SET username = ssc.seller_username
-- FROM seller_store_connections ssc
-- WHERE shopify_tokens.shop = ssc.store_url 
--   AND shopify_tokens.username IS NULL;

-- Option 2: If you want to assign all orphaned tokens to a specific user
-- UPDATE shopify_tokens 
-- SET username = 'default_user'  -- Replace with actual username
-- WHERE username IS NULL;

-- Option 3: Remove orphaned tokens that can't be attributed to any user
-- DELETE FROM shopify_tokens 
-- WHERE username IS NULL;

-- After migration, verify the results
-- SELECT username, COUNT(*) as store_count 
-- FROM shopify_tokens 
-- WHERE username IS NOT NULL
-- GROUP BY username;