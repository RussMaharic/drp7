import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET all seller RTO rates
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('sellerId');
    const storeUrl = searchParams.get('storeUrl');

    let query = supabase
      .from('seller_rto_rates')
      .select('*')
      .order('created_at', { ascending: false });

    if (sellerId) {
      query = query.eq('seller_id', sellerId);
    }

    if (storeUrl) {
      query = query.eq('store_url', storeUrl);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching seller RTO rates:', error);
      return NextResponse.json({ error: 'Failed to fetch RTO rates' }, { status: 500 });
    }

    return NextResponse.json({ rtoRates: data || [] });
  } catch (error) {
    console.error('Error in GET seller RTO rates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST to create or update seller RTO rate
export async function POST(request: Request) {
  try {
    const { sellerId, storeUrl, rtoRate } = await request.json();

    if (!sellerId || !storeUrl || rtoRate === undefined) {
      return NextResponse.json({ 
        error: 'sellerId, storeUrl, and rtoRate are required' 
      }, { status: 400 });
    }

    // Validate RTO penalty amount (in INR)
    if (rtoRate < 0) {
      return NextResponse.json({ 
        error: 'RTO penalty amount must be >= 0' 
      }, { status: 400 });
    }

    // Check if rate already exists for this seller and store
    const { data: existingRate } = await supabase
      .from('seller_rto_rates')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('store_url', storeUrl)
      .single();

    let result;
    if (existingRate) {
      // Update existing rate
      const { data, error } = await supabase
        .from('seller_rto_rates')
        .update({ 
          rto_rate: rtoRate,
          updated_at: new Date().toISOString()
        })
        .eq('seller_id', sellerId)
        .eq('store_url', storeUrl)
        .select()
        .single();

      if (error) {
        console.error('Error updating RTO rate:', error);
        return NextResponse.json({ error: 'Failed to update RTO rate' }, { status: 500 });
      }
      result = data;
    } else {
      // Create new rate
      const { data, error } = await supabase
        .from('seller_rto_rates')
        .insert({
          seller_id: sellerId,
          store_url: storeUrl,
          rto_rate: rtoRate,
          created_by: 'admin'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating RTO rate:', error);
        return NextResponse.json({ error: 'Failed to create RTO rate' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ 
      success: true, 
      rtoRate: result 
    });
  } catch (error) {
    console.error('Error in POST seller RTO rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE to remove seller RTO rate
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('sellerId');
    const storeUrl = searchParams.get('storeUrl');

    if (!sellerId || !storeUrl) {
      return NextResponse.json({ 
        error: 'sellerId and storeUrl are required' 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('seller_rto_rates')
      .delete()
      .eq('seller_id', sellerId)
      .eq('store_url', storeUrl);

    if (error) {
      console.error('Error deleting RTO rate:', error);
      return NextResponse.json({ error: 'Failed to delete RTO rate' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE seller RTO rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

