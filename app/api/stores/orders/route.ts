import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getShopToken } from '../../auth/shopify/route';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('storeUrl');

    if (!storeUrl) {
      return NextResponse.json({ error: 'Store URL is required' }, { status: 400 });
    }

    // First try to get from store_configs (direct API connections)
    const { data: storeConfig } = await supabase
      .from('store_configs')
      .select('*')
      .eq('store_url', storeUrl)
      .eq('is_active', true)
      .single();

    let orders;

    if (storeConfig) {
      // Use direct API credentials
      const params = new URLSearchParams({ shop: storeUrl });
      
      if (storeConfig.access_token) {
        params.append('accessToken', storeConfig.access_token);
      } else if (storeConfig.api_key && storeConfig.api_secret) {
        params.append('apiKey', storeConfig.api_key);
        params.append('apiSecret', storeConfig.api_secret);
      }

      const baseUrl = request.url.includes('localhost') ? 'http://localhost:3000' : request.url.split('/api')[0];
      const response = await fetch(`${baseUrl}/api/shopify-direct-orders?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        orders = data.orders;
      } else {
        console.error('Direct orders API failed:', await response.text());
      }
    }

    // If no direct config or failed, try OAuth token
    if (!orders) {
      const accessToken = await getShopToken(storeUrl);
      if (accessToken) {
        const response = await fetch(`${request.url.split('/api')[0]}/api/shopify-orders-graphql?shop=${storeUrl}`);
        if (response.ok) {
          const data = await response.json();
          orders = data.orders;
        }
      }
    }

    if (!orders) {
      return NextResponse.json({ error: 'Store not found or error fetching orders' }, { status: 404 });
    }

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error in GET /api/stores/orders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}