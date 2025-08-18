import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AuthService } from '@/lib/auth-service';
import { SellerStoreService } from '@/lib/services/seller-store-service';

export async function POST(request: Request) {
  try {
    // Get session token from cookies to identify the seller
    const sessionToken = request.headers.get('cookie')?.split('; ')
      .find(row => row.startsWith('session_token='))?.split('=')[1];

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify session and get seller info
    const sessionResult = await AuthService.verifySession(sessionToken);
    if (!sessionResult.success || !sessionResult.user || sessionResult.user.userType !== 'seller') {
      return NextResponse.json({ error: 'Seller authentication required' }, { status: 401 });
    }

    const sellerId = sessionResult.user.id;

    const body = await request.json();
    const { storeName, storeUrl, accessToken, adminApiKey, adminApiSecret } = body;

    if (!storeName || !storeUrl) {
      return NextResponse.json({ error: 'Store name and URL are required' }, { status: 400 });
    }

    if (!accessToken && (!adminApiKey || !adminApiSecret)) {
      return NextResponse.json({ 
        error: 'Either access token or both admin API key and secret are required' 
      }, { status: 400 });
    }

    // Add store connection for this seller
    let connection;
    try {
      // Log the request data
      const requestData = {
        sellerId,
        username: sessionResult.user.username,
        storeUrl,
        storeName,
        hasAccessToken: !!accessToken,
        hasApiKey: !!adminApiKey,
        hasApiSecret: !!adminApiSecret
      };
      console.log('Adding store connection with data:', requestData);

      // First check if store is already connected
      const { data: existingStore, error: checkError } = await supabase
        .from('seller_store_connections')
        .select('seller_username, is_active')
        .eq('store_url', storeUrl)
        .single();

      if (checkError) {
        console.error('Error checking existing store:', checkError);
      } else if (existingStore) {
        console.log('Found existing store connection:', existingStore);
      }

      connection = await SellerStoreService.addStoreConnection(
        sellerId, 
        sessionResult.user.username, // Use the seller's username
        {
          storeUrl,
          storeName,
          storeType: 'shopify',
          connectionType: 'direct',
          accessToken,
          apiKey: adminApiKey,
          apiSecret: adminApiSecret
        }
      );

      if (!connection) {
        console.error('addStoreConnection returned null');
        return NextResponse.json({ error: 'Failed to add store connection' }, { status: 500 });
      }

      console.log('Store connection added successfully:', connection.id);
    } catch (err) {
      console.error('Error adding store connection:', err);
      return NextResponse.json({ 
        error: err instanceof Error ? err.message : 'Failed to add store connection',
        details: err instanceof Error ? err.stack : undefined
      }, { status: 500 });
    }

    // Also store in the existing store_configs table for backwards compatibility
    const { error: storeError } = await supabase
      .from('store_configs')
      .upsert({
        store_url: storeUrl,
        store_name: storeName,
        access_token: accessToken || null,
        api_key: adminApiKey || null,
        api_secret: adminApiSecret || null,
        is_active: true,
        pull_orders_from: new Date().toISOString()
      });

    if (storeError) {
      console.error('Error storing in store_configs:', storeError);
    }

    // Also store in the existing shopify_tokens table for compatibility
    if (accessToken) {
      const { error: tokenError } = await supabase
        .from('shopify_tokens')
        .upsert({
          shop: storeUrl,
          access_token: accessToken,
          username: sessionResult.user.username,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'shop'
        });

      if (tokenError) {
        console.error('Error storing token:', tokenError);
      }
    }

    // Format the connection data to avoid circular references
    const safeConnection = {
      id: connection.id,
      storeUrl: connection.storeUrl,
      storeName: connection.storeName,
      connectionType: connection.connectionType,
      connectedAt: connection.connectedAt,
      isActive: connection.isActive
    };

    // Ensure the response is serializable
    try {
      // Test JSON serialization
      JSON.stringify({ success: true, connection: safeConnection });
      
      return new NextResponse(
        JSON.stringify({ success: true, connection: safeConnection }),
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    } catch (err) {
      console.error('Error serializing response:', err);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to process store connection response',
          details: err instanceof Error ? err.message : 'Unknown error'
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/stores/direct:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    // Get session token from cookies for seller
    const cookies = request.headers.get('cookie')?.split('; ')
      .reduce((acc: any, cookie) => {
        const [key, value] = cookie.split('=');
        acc[key] = value;
        return acc;
      }, {});
    
    const sessionToken = cookies?.['session_token'];

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify session and get seller info
    const sessionResult = await AuthService.verifySession(sessionToken);
    if (!sessionResult.success || !sessionResult.user || sessionResult.user.userType !== 'seller') {
      return NextResponse.json({ error: 'Seller authentication required' }, { status: 401 });
    }

    const sellerId = sessionResult.user.id;

    // Get seller's store connections
    const connections = await SellerStoreService.getSellerStoreConnections(sessionResult.user.username);

    const stores = connections
      .filter(conn => conn.connectionType === 'direct')
      .map(conn => ({
        shop: conn.storeUrl,
        name: conn.storeName,
        connectedAt: conn.connectedAt,
        lastUpdated: conn.updatedAt,
        type: 'direct'
      }));

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Error in GET /api/stores/direct:', error);
    return NextResponse.json({ stores: [] });
  }
}

export async function DELETE(request: Request) {
  try {
    // Get session token from cookies for seller
    const cookies = request.headers.get('cookie')?.split('; ')
      .reduce((acc: any, cookie) => {
        const [key, value] = cookie.split('=');
        acc[key] = value;
        return acc;
      }, {});
    
    const sessionToken = cookies?.['session_token'];

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify session and get seller info
    const sessionResult = await AuthService.verifySession(sessionToken);
    if (!sessionResult.success || !sessionResult.user || sessionResult.user.userType !== 'seller') {
      return NextResponse.json({ error: 'Seller authentication required' }, { status: 401 });
    }

    const sellerId = sessionResult.user.id;

    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');

    if (!shop) {
      return NextResponse.json({ error: 'Shop parameter is required' }, { status: 400 });
    }

    // Remove store connection for this seller only
    const success = await SellerStoreService.removeStoreConnection(sessionResult.user.username, shop);

    if (!success) {
      return NextResponse.json({ error: 'Failed to remove store connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/stores/direct:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}