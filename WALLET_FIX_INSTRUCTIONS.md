# Wallet System Fix Instructions

## Issue Summary
The wallet is showing ₹0.00 balance and "No orders found" because:
1. Database tables for the wallet system haven't been created
2. No test data exists in the order_status table
3. The wallet system needs proper initialization

## Step-by-Step Fix

### Step 1: Create Database Tables
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `scripts/create-wallet-tables.sql`
4. Run the SQL script
5. Verify that both `store_wallets` and `wallet_transactions` tables are created

### Step 2: Test the Wallet System
1. Start your development server: `npm run dev`
2. Navigate to: `http://localhost:3000/api/test-wallet`
3. Check the response to see if tables exist and wallet functions work

### Step 3: Set Up Test Data
1. Navigate to: `http://localhost:3000/api/setup-test-data`
2. This will create:
   - 3 test orders in the `order_status` table
   - Tracking information in the `order_tracking` table
   - Wallet transactions for confirmed and RTO orders

### Step 4: Verify Wallet Dashboard
1. Go to your seller dashboard
2. Navigate to the "Wallet" tab
3. You should now see:
   - Wallet balance (should be ₹200.00 - 2 confirmed orders × ₹150 - 1 RTO × ₹100)
   - 3 orders in the "Orders & Wallet Impact" section
   - Transaction history with 3 entries

## Expected Results

After completing these steps, your wallet should show:

### Summary Cards:
- **Total Orders**: 3
- **Confirmed Orders**: 2
- **RTO Orders**: 1
- **Net Earnings**: ₹200.00

### Wallet Balance:
- **Current Balance**: ₹200.00

### Orders Table:
1. **Order #1001**: Confirmed (+₹150.00)
2. **Order #1002**: RTO (-₹100.00)
3. **Order #1003**: Confirmed (+₹150.00)

### Transaction History:
1. Margin earned from order #1001
2. RTO penalty for order #1002
3. Margin earned from order #1003

## Troubleshooting

### If tables don't exist:
- Check your Supabase permissions
- Make sure you're running the SQL in the correct database
- Verify the SQL script executed without errors

### If no data appears:
- Check the browser console for errors
- Verify the API endpoints are working
- Make sure the store URL matches exactly: `teast32123.myshopify.com`

### If wallet balance is wrong:
- Check the transaction history for correct amounts
- Verify order statuses are set correctly
- Refresh the page to get latest data

## API Endpoints for Testing

- `GET /api/test-wallet` - Test wallet system functionality
- `POST /api/setup-test-data` - Create test data
- `GET /api/wallet/orders?store=teast32123.myshopify.com` - Get wallet data

## Database Tables Created

1. **store_wallets** - Stores wallet balance for each store
2. **wallet_transactions** - Logs all wallet transactions

## Files Modified

- `scripts/create-wallet-tables.sql` - Database setup script
- `app/api/test-wallet/route.ts` - Enhanced test endpoint
- `app/api/setup-test-data/route.ts` - Test data creation endpoint
- `app/api/wallet/orders/route.ts` - Wallet orders API
- `app/dashboard/wallet/page.tsx` - Enhanced wallet page
