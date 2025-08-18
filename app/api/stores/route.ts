import { NextResponse } from 'next/server';
import { StoreManager } from '@/lib/services/store-manager';
import { ShopifyStoreConfig } from '@/lib/types/store-config';

const storeManager = new StoreManager();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const storeConfig: ShopifyStoreConfig = {
      storeUrl: body.storeUrl,
      storeName: body.storeName,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      pullOrdersFrom: new Date(body.pullOrdersFrom),
      isActive: body.isActive ?? true
    };

    const success = await storeManager.addStore(storeConfig);
    if (!success) {
      return NextResponse.json({ error: 'Failed to add store' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/stores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('storeUrl');

    if (storeUrl) {
      const store = await storeManager.getStore(storeUrl);
      if (!store) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      return NextResponse.json(store);
    }

    const stores = await storeManager.getAllStores();
    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Error in GET /api/stores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('storeUrl');

    if (!storeUrl) {
      return NextResponse.json({ error: 'Store URL is required' }, { status: 400 });
    }

    const success = await storeManager.deleteStore(storeUrl);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/stores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}