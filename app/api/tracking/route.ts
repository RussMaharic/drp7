import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Fetch tracking information for orders
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const storeUrl = searchParams.get('storeUrl');
    const supplierId = searchParams.get('supplierId');

    let query = supabase.from('order_tracking').select('*');

    // Filter by specific order
    if (orderId) {
      query = query.eq('shopify_order_id', orderId);
    }

    // Filter by store
    if (storeUrl) {
      query = query.eq('store_url', storeUrl);
    }

    // Filter by supplier
    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: trackingData, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tracking data:', error);
      return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
    }

    return NextResponse.json({ tracking: trackingData || [] });
  } catch (error) {
    console.error('Error in GET /api/tracking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add or update tracking information
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      shopifyOrderId,
      orderNumber,
      storeUrl,
      supplierId,
      trackingNumber,
      trackingUrl,
      carrier,
      notes
    } = body;

    // Validate required fields
    if (!shopifyOrderId || !orderNumber || !storeUrl || !trackingNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: shopifyOrderId, orderNumber, storeUrl, trackingNumber' },
        { status: 400 }
      );
    }

    // Auto-detect carrier if not provided
    let detectedCarrier = carrier;
    if (!detectedCarrier) {
      detectedCarrier = detectCarrier(trackingNumber);
    }

    // Auto-generate tracking URL if not provided
    let finalTrackingUrl = trackingUrl;
    if (!finalTrackingUrl && detectedCarrier) {
      finalTrackingUrl = generateTrackingUrl(trackingNumber, detectedCarrier);
    }

    // Check if tracking already exists for this order
    const { data: existingTracking } = await supabase
      .from('order_tracking')
      .select('id')
      .eq('shopify_order_id', shopifyOrderId)
      .eq('store_url', storeUrl)
      .single();

    let result;
    if (existingTracking) {
      // Update existing tracking
      const { data, error } = await supabase
        .from('order_tracking')
        .update({
          tracking_number: trackingNumber,
          tracking_url: finalTrackingUrl,
          carrier: detectedCarrier,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTracking.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating tracking:', error);
        return NextResponse.json({ error: 'Failed to update tracking information' }, { status: 500 });
      }
      result = data;
    } else {
      // Create new tracking entry
      const { data, error } = await supabase
        .from('order_tracking')
        .insert({
          shopify_order_id: shopifyOrderId,
          order_number: orderNumber,
          store_url: storeUrl,
          supplier_id: supplierId || null,
          tracking_number: trackingNumber,
          tracking_url: finalTrackingUrl,
          carrier: detectedCarrier,
          notes: notes || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating tracking:', error);
        return NextResponse.json({ error: 'Failed to create tracking information' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ 
      message: existingTracking ? 'Tracking updated successfully' : 'Tracking created successfully',
      tracking: result 
    });
  } catch (error) {
    console.error('Error in POST /api/tracking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove tracking information
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingId = searchParams.get('id');
    const orderId = searchParams.get('orderId');
    const storeUrl = searchParams.get('storeUrl');

    if (!trackingId && !(orderId && storeUrl)) {
      return NextResponse.json(
        { error: 'Either tracking ID or (orderId + storeUrl) is required' },
        { status: 400 }
      );
    }

    let query = supabase.from('order_tracking').delete();

    if (trackingId) {
      query = query.eq('id', trackingId);
    } else {
      query = query.eq('shopify_order_id', orderId).eq('store_url', storeUrl);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting tracking:', error);
      return NextResponse.json({ error: 'Failed to delete tracking information' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Tracking deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/tracking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to detect carrier from tracking number
function detectCarrier(trackingNumber: string): string {
  const cleanNumber = trackingNumber.replace(/\s+/g, '').toUpperCase();

  // Common Indian carriers
  if (/^(BW|DL|HY|PU|CC|ND|MU|KO|CHN|BLR|JP)/.test(cleanNumber)) {
    return 'Blue Dart';
  }
  if (/^(DH|DE|DP|DR|DS|DT|DX|DG)/.test(cleanNumber) || /^\d{10}$/.test(cleanNumber)) {
    return 'DTDC';
  }
  if (/^(EC|EX|ED|EP|ES|ET|EW|EG)/.test(cleanNumber) || /^(7568|7569)/.test(cleanNumber)) {
    return 'Ecom Express';
  }
  if (/^(DM|DG|DH|DR|DS|DT|DX|DY|DZ)/.test(cleanNumber)) {
    return 'Delhivery';
  }
  if (/^(XP|XR|XS|XT|XW|XY|XZ)/.test(cleanNumber)) {
    return 'Xpressbees';
  }
  if (/^(SP|SR|SS|ST|SW|SY|SZ)/.test(cleanNumber)) {
    return 'Shadowfax';
  }

  // International carriers
  if (/^1Z/.test(cleanNumber)) {
    return 'UPS';
  }
  if (/^\d{12}$/.test(cleanNumber) || /^\d{20}$/.test(cleanNumber)) {
    return 'FedEx';
  }
  if (/^(EA|EB|EC|ED|EE|EF|EG|EH|EI|EJ|EK|EL|EM|EN|EO|EP|EQ|ER|ES|ET|EU|EV|EW|EX|EY|EZ)/.test(cleanNumber)) {
    return 'India Post';
  }

  return 'Other';
}

// Helper function to generate tracking URL
function generateTrackingUrl(trackingNumber: string, carrier: string): string {
  const baseUrls: { [key: string]: string } = {
    'Blue Dart': 'https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=',
    'DTDC': 'https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=',
    'Ecom Express': 'https://ecomexpress.in/tracking/?awb_field=',
    'Delhivery': 'https://www.delhivery.com/track/package/',
    'Xpressbees': 'https://www.xpressbees.com/track?awb=',
    'Shadowfax': 'https://shadowfax.in/tracking?awb=',
    'UPS': 'https://www.ups.com/track?tracknum=',
    'FedEx': 'https://www.fedex.com/fedextrack/?tracknumber=',
    'India Post': 'https://www.indiapost.gov.in/VAS/Pages/IndiaPostHome.aspx#'
  };

  return baseUrls[carrier] ? `${baseUrls[carrier]}${trackingNumber}` : '';
}