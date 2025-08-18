# Order Tracking System Guide

## Overview

This tracking system allows admins to efficiently add tracking information for orders and enables sellers to view tracking details in their delivery management section. The system uses a selective approach, storing only orders with tracking information to avoid performance issues.

## Architecture

### Database Design
- **`order_tracking` table**: Stores only orders with tracking information
- **Selective storage**: Only orders with assigned tracking IDs are stored
- **Performance optimized**: Avoids overwhelming the database with all orders

### Key Features
1. **Admin Dashboard**: Easy tracking ID input with auto-detection
2. **Seller View**: Clean tracking display with clickable links
3. **Carrier Detection**: Automatic carrier identification from tracking numbers
4. **URL Generation**: Auto-generated tracking URLs for major carriers

## How to Use

### For Administrators

1. **Access Admin Dashboard**
   - Navigate to `/admin`
   - Login with admin credentials

2. **Add Tracking Information**
   - Find the order in the orders table
   - Click "Add Tracking" button in the Tracking column
   - Enter tracking number (required)
   - Carrier and URL are auto-detected but can be customized
   - Add optional notes
   - Click "Add Tracking" to save

3. **Edit Existing Tracking**
   - Click the edit icon next to existing tracking info
   - Modify details as needed
   - Click "Update Tracking" to save

### For Sellers

1. **View Tracking Information**
   - Navigate to Dashboard → Manage Delivery
   - Orders with tracking will show:
     - Tracking number
     - Carrier name
     - "Track Package" button (clickable link)
     - Any admin notes

2. **Track Packages**
   - Click "Track Package" button to open carrier's tracking page
   - Link opens in new tab for easy reference

## Supported Carriers

### Indian Carriers
- **Blue Dart**: Auto-detected patterns, direct tracking links
- **DTDC**: Automatic URL generation
- **Ecom Express**: Pattern recognition and tracking
- **Delhivery**: Full integration support
- **Xpressbees**: Tracking number patterns
- **Shadowfax**: Local delivery tracking
- **India Post**: Government postal service

### International Carriers
- **UPS**: 1Z tracking numbers
- **FedEx**: 12/20 digit patterns
- **DHL**: International express

## API Endpoints

### `GET /api/tracking`
Fetch tracking information
- **Query params**: `orderId`, `storeUrl`, `supplierId`
- **Response**: Array of tracking records

### `POST /api/tracking`
Add/update tracking information
- **Body**: `{ shopifyOrderId, orderNumber, storeUrl, trackingNumber, carrier?, trackingUrl?, notes? }`
- **Response**: Created/updated tracking record

### `DELETE /api/tracking`
Remove tracking information
- **Query params**: `id` or `orderId + storeUrl`
- **Response**: Success confirmation

## Database Migration

To set up the tracking system, run the migration:

```sql
-- Execute the migration file
\i migrations/add-order-tracking.sql
```

This creates:
- `order_tracking` table with all necessary columns
- Indexes for performance optimization
- Triggers for automatic timestamp updates

## Benefits of This Approach

### Performance Advantages
1. **Selective Storage**: Only orders with tracking are stored
2. **Fast Queries**: Indexed lookups for quick access
3. **Scalable**: Won't slow down with large order volumes
4. **Memory Efficient**: Minimal database footprint

### User Experience
1. **Admin Efficiency**: Quick tracking input with auto-detection
2. **Seller Convenience**: Clear tracking display with direct links
3. **Customer Satisfaction**: Easy package tracking access
4. **Professional Appearance**: Clean, organized tracking information

### Technical Benefits
1. **Carrier Auto-Detection**: Reduces manual input errors
2. **URL Generation**: Automatic tracking links
3. **Flexible System**: Easy to add new carriers
4. **Error Handling**: Robust error management
5. **Real-time Updates**: Immediate tracking information availability

## Future Enhancements

Consider adding:
1. **Tracking Status Updates**: Real-time status polling from carriers
2. **Email Notifications**: Automatic customer notifications
3. **Bulk Upload**: CSV import for multiple tracking numbers
4. **Analytics**: Delivery performance metrics
5. **Customer Portal**: Direct customer tracking access

## Troubleshooting

### Common Issues
1. **Tracking not showing**: Check if store URL matches exactly
2. **Auto-detection failing**: Manually select carrier from dropdown
3. **Links not working**: Verify tracking number format
4. **Performance issues**: Monitor database queries and indexes

### Support
For technical support or feature requests, contact the development team.