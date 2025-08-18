import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET all sellers
export async function GET(request: Request) {
  try {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, username, name, email')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching sellers:', error);
      return NextResponse.json({ error: 'Failed to fetch sellers' }, { status: 500 });
    }

    return NextResponse.json({ sellers: data || [] });
  } catch (error) {
    console.error('Error in GET sellers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

