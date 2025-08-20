# Cashfree Payment Integration for Seller Signup

## Overview

This integration adds Cashfree payment processing to the seller dashboard signup flow. Sellers must complete payment before accessing the dashboard.

## Payment Flow

1. **User Registration Form**: User fills out basic signup details (name, username, email, password)
2. **Payment Plan Selection**: User chooses from three subscription plans:
   - Starter Plan: ₹25,000
   - Professional Plan: ₹50,000 (Most Popular)
   - Enterprise Plan: ₹75,000
3. **Payment Processing**: User is redirected to Cashfree hosted checkout
4. **Account Creation**: After successful payment, seller account is created
5. **Dashboard Access**: User is redirected to seller dashboard login

## Files Modified/Created

### API Endpoints
- `app/api/payments/create-order/route.ts` - Creates Cashfree payment orders
- `app/api/payments/verify/route.ts` - Verifies payment status
- `app/api/payments/callback/route.ts` - Handles payment callbacks
- `app/api/auth/signup/route.ts` - Updated to handle payment verification

### Frontend Components
- `app/auth/seller/signup/page.tsx` - Updated with payment plan selection
- `app/auth/seller/signup/complete/page.tsx` - Payment completion page

### Services
- `lib/auth-service.ts` - Updated to store payment information

### Database
- `migrations/add-seller-payment-fields.sql` - Adds payment fields to sellers table

## Environment Variables Required

Add these to your `.env.local` file:

```env
# Cashfree Payment Gateway
CASHFREE_CLIENT_ID=your_cashfree_client_id
CASHFREE_CLIENT_SECRET=your_cashfree_client_secret
CASHFREE_ENVIRONMENT=sandbox
# Set to 'production' for live environment

# Base URL for callbacks
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# Update this to your production domain when deploying
```

## Setup Instructions

### 1. Cashfree Account Setup
1. Create a Cashfree merchant account
2. Generate test/production API keys from the dashboard
3. Whitelist your domain in Cashfree dashboard

### 2. Database Migration
Run the migration to add payment fields:
```sql
-- Execute migrations/add-seller-payment-fields.sql
```

### 3. Environment Configuration
1. Add Cashfree credentials to `.env.local`
2. Update `NEXT_PUBLIC_BASE_URL` to your domain
3. Set `CASHFREE_ENVIRONMENT` to `sandbox` for testing, `production` for live

### 4. Testing
1. Use Cashfree test credentials for development
2. Test with different payment scenarios (success/failure)
3. Verify account creation after successful payment

## Payment Plans

| Plan | Amount | Features |
|------|--------|----------|
| Starter | ₹25,000 | Basic dashboard, 100 products, Email support |
| Professional | ₹50,000 | Advanced dashboard, 500 products, Priority support, Analytics |
| Enterprise | ₹75,000 | Full access, Unlimited products, 24/7 support, Advanced analytics |

## Security Features

- Payment verification before account creation
- Secure order ID generation
- Session-based form data storage
- PCI compliant hosted checkout
- Order status verification

## Error Handling

- Payment failures redirect back to signup with error messages
- Form validation before payment processing
- Network error handling with user-friendly messages
- Automatic cleanup of session data

## Important Notes

1. **Domain Whitelisting**: Ensure your domain is whitelisted in Cashfree dashboard
2. **Environment**: Use sandbox for testing, production for live
3. **Return URL**: Payment callbacks are handled automatically
4. **Security**: Never expose client secret on frontend
5. **Testing**: Test all payment scenarios thoroughly before going live

## Next Steps

1. Set up Cashfree merchant account
2. Configure environment variables
3. Run database migration
4. Test the complete flow
5. Deploy and configure production environment

