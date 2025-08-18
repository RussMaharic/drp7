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

    console.log(`Fetching products for store: ${storeUrl}`);

    // First try to get from store_configs (direct API connections)
    const { data: storeConfig, error: configError } = await supabase
      .from('store_configs')
      .select('*')
      .eq('store_url', storeUrl)
      .eq('is_active', true)
      .single();

    console.log(`Store config found:`, !!storeConfig, configError ? `Error: ${configError.message}` : '');

    let products;

    if (storeConfig) {
      // Use direct API credentials
      let headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (storeConfig.access_token) {
        console.log('Using access token for direct API');
        headers['X-Shopify-Access-Token'] = storeConfig.access_token;
      } else if (storeConfig.api_key && storeConfig.api_secret) {
        console.log('Using API key/secret for direct API');
        const credentials = Buffer.from(`${storeConfig.api_key}:${storeConfig.api_secret}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const response = await fetch(`https://${storeUrl}/admin/api/2023-10/products.json`, {
        headers,
        cache: 'no-store'
      });
      
      console.log(`Direct API response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        products = data.products;
        console.log(`Found ${products?.length || 0} products via direct API`);
      } else {
        const errorText = await response.text();
        console.error('Direct products API failed:', errorText);
      }
    }

    // If no direct config or failed, try OAuth token
    if (!products) {
      console.log('Trying OAuth token...');
      const accessToken = await getShopToken(storeUrl);
      console.log('OAuth token found:', !!accessToken);
      
      if (accessToken) {
        const response = await fetch(`https://${storeUrl}/admin/api/2023-10/products.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`OAuth API response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          products = data.products;
          console.log(`Found ${products?.length || 0} products via OAuth`);
        } else {
          console.error('OAuth products API failed:', await response.text());
        }
      }
    }

    if (!products) {
      console.log('No products found from any API');
      return NextResponse.json({ error: 'Store not found or error fetching products' }, { status: 404 });
    }

    // Log product titles for debugging
    const productTitles = products.map((p: any) => p.title);
    console.log('Product titles found:', productTitles);

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error in GET /api/stores/products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}