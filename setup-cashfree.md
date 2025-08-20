# Quick Cashfree Setup Guide

## The Error You're Seeing

The "Internal server error" occurs because Cashfree environment variables are not configured. Here's how to fix it:

## Immediate Fix

1. **Create `.env.local` file** in the `drp6` folder with these variables:

```env
# Cashfree Payment Gateway (REQUIRED)
CASHFREE_CLIENT_ID=your_client_id_here
CASHFREE_CLIENT_SECRET=your_client_secret_here
CASHFREE_ENVIRONMENT=sandbox

# Base URL (REQUIRED)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Your existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

2. **Get Cashfree Test Credentials:**
   - Go to [Cashfree Dashboard](https://merchant.cashfree.com)
   - Sign up for a test account
   - Navigate to Developers → API Keys
   - Copy Client ID and Client Secret

3. **Restart your development server** after adding environment variables

## Test Credentials (For Development Only)

If you want to test immediately, you can use these Cashfree test credentials:

```env
CASHFREE_CLIENT_ID=TEST10372306e0b4e4c8e8b9d7d8a8f8e8f8e8
CASHFREE_CLIENT_SECRET=cfsk_ma_test_12345678901234567890123456789012
CASHFREE_ENVIRONMENT=sandbox
```

**Note**: These are example credentials. You need to get real test credentials from Cashfree.

## Database Setup

Run this migration to add payment fields to your database:

```sql
-- Execute this in your Supabase SQL editor or database client
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS payment_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sellers_payment_order_id ON sellers(payment_order_id);
```

## Quick Test

After configuration:
1. Restart your dev server: `npm run dev`
2. Go to `/auth/seller/signup`
3. Fill the form and proceed to payment
4. You should see the payment plans without errors

## Production Setup

For production:
1. Get production API keys from Cashfree
2. Set `CASHFREE_ENVIRONMENT=production`
3. Update `NEXT_PUBLIC_BASE_URL` to your domain
4. Whitelist your domain in Cashfree dashboard

