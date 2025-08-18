import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET all stores (from seller_store_connections)
export async function GET(request: Request) {
  try {
    // Use seller_store_connections as the canonical source of connected stores
    const { data, error } = await supabase
      .from('seller_store_connections')
      .select('store_url, store_name, is_active')
      .eq('is_active', true)
      .order('store_name', { ascending: true });

    if (error) {
      console.error('Error fetching seller store connections:', error);
      return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
    }

    // Deduplicate by store_url
    const unique = new Map<string, { shop: string; store_name: string }>();
    (data || []).forEach((row) => {
      if (!unique.has(row.store_url)) {
        unique.set(row.store_url, {
          shop: row.store_url,
          store_name: row.store_name || row.store_url,
        });
      }
    });

    return NextResponse.json({ stores: Array.from(unique.values()) });
  } catch (error) {
    console.error('Error in GET stores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

