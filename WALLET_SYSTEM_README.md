# Wallet System Implementation

## Overview
The wallet system has been successfully implemented for the seller dashboard. This system automatically tracks margins earned from confirmed orders and deducts penalties for RTO (Return to Origin) orders.

## Features Implemented

### 1. Database Schema
- **`store_wallets`** table: Stores wallet balance for each store
- **`wallet_transactions`** table: Logs all wallet transactions with timestamps

### 2. Wallet Service (`/lib/services/wallet-service.ts`)
- `getWalletBalance(storeUrl)`: Get current wallet balance
- `addMarginEarned(storeUrl, orderId, orderNumber, marginAmount)`: Add margin from confirmed orders
- `deductRTOTPenalty(storeUrl, orderId, orderNumber, penaltyAmount)`: Deduct RTO penalty
- `getTransactionHistory(storeUrl)`: Get transaction history for a store

### 3. UI Components
- **Wallet Tab**: New tab in seller dashboard navigation
- **Wallet Page**: `/dashboard/wallet` - Shows balance and transaction history
- **Header Display**: Wallet balance shown in dashboard header

### 4. Integration Points
- **Admin Dashboard**: Order status updates automatically trigger wallet transactions
- **Store Context**: Wallet balance is tracked and updated in real-time

## How It Works

### Margin Calculation
- When an order is marked as "confirmed", 15% of the order amount is added to the wallet
- Formula: `margin = orderAmount * 0.15`

### RTO Penalty
- When an order is marked as "RTO", a fixed penalty of ₹100 is deducted from the wallet
- If wallet balance is insufficient, it can go negative

### Transaction Logging
All wallet activities are logged with:
- Transaction type (margin_earned, rto_penalty, etc.)
- Amount (positive for earnings, negative for penalties)
- Balance before and after transaction
- Order details (ID, number)
- Timestamp and description

## Database Migration

To set up the wallet system, run the migration:

```sql
-- The migration file is located at: /migrations/add-wallet-system.sql
-- This creates the necessary tables and indexes
```

## API Endpoints

### Test Endpoint
- `GET /api/test-wallet`: Test the wallet system functionality

### Wallet Page
- `GET /dashboard/wallet`: Wallet dashboard page

## Usage

### For Sellers
1. Navigate to the "Wallet" tab in the seller dashboard
2. View current balance and transaction history
3. Balance is automatically updated when orders are processed

### For Admins
1. Update order status in the admin dashboard
2. When marking orders as "confirmed", margin is automatically added
3. When marking orders as "RTO", penalty is automatically deducted

## Configuration

### Margin Rate
- Currently set to 15% of order amount
- Can be modified in `/app/admin/page.tsx` line with margin calculation

### RTO Penalty
- Currently set to ₹100 fixed amount
- Can be modified in `/app/admin/page.tsx` line with penalty calculation

## Files Modified/Created

### New Files
- `/migrations/add-wallet-system.sql` - Database migration
- `/lib/services/wallet-service.ts` - Wallet service
- `/app/dashboard/wallet/page.tsx` - Wallet page
- `/app/api/test-wallet/route.ts` - Test endpoint
- `/WALLET_SYSTEM_README.md` - This documentation

### Modified Files
- `/components/dashboard-layout.tsx` - Added wallet tab and header balance
- `/contexts/store-context.tsx` - Added wallet balance tracking
- `/app/admin/page.tsx` - Added wallet integration to order status updates

## Testing

1. Start the development server: `npm run dev`
2. Navigate to `/api/test-wallet` to test the wallet system
3. Check the wallet page at `/dashboard/wallet`
4. Test order status updates in the admin dashboard

## Future Enhancements

1. **Withdrawal System**: Allow sellers to withdraw funds
2. **Multiple Currency Support**: Support for different currencies
3. **Advanced Analytics**: Detailed wallet analytics and reports
4. **Notification System**: Email/SMS notifications for wallet activities
5. **Manual Adjustments**: Admin ability to manually adjust wallet balances
