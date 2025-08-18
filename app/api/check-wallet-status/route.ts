import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const status = {
      tables_exist: {
        store_wallets: false,
        wallet_transactions: false
      },
      data_counts: {
        stores: 0,
        wallets: 0,
        transactions: 0,
        orders: 0
      },
      sample_data: {
        stores: [],
        wallets: [],
        transactions: [],
        orders: []
      }
    };

    // Check if store_wallets table exists
    try {
      const { data: wallets, error: walletError } = await supabase
        .from('store_wallets')
        .select('*')
        .limit(5);

      if (!walletError) {
        status.tables_exist.store_wallets = true;
        status.data_counts.wallets = wallets?.length || 0;
        status.sample_data.wallets = wallets || [];
      }
    } catch (error) {
      console.log('store_wallets table does not exist');
    }

    // Check if wallet_transactions table exists
    try {
      const { data: transactions, error: transactionError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .limit(5);

      if (!transactionError) {
        status.tables_exist.wallet_transactions = true;
        status.data_counts.transactions = transactions?.length || 0;
        status.sample_data.transactions = transactions || [];
      }
    } catch (error) {
      console.log('wallet_transactions table does not exist');
    }

    // Get existing stores
    try {
      const { data: stores, error: storesError } = await supabase
        .from('seller_store_configs')
        .select('store_url')
        .not('store_url', 'is', null)
        .limit(5);

      if (!storesError) {
        status.data_counts.stores = stores?.length || 0;
        status.sample_data.stores = stores || [];
      }
    } catch (error) {
      console.log('Error fetching stores:', error);
    }

    // Get existing orders
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('order_status')
        .select('*')
        .in('status', ['confirmed', 'rto'])
        .limit(5);

      if (!ordersError) {
        status.data_counts.orders = orders?.length || 0;
        status.sample_data.orders = orders || [];
      }
    } catch (error) {
      console.log('Error fetching orders:', error);
    }

    return NextResponse.json({
      success: true,
      status,
      recommendations: getRecommendations(status)
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during status check',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getRecommendations(status: any) {
  const recommendations = [];

  if (!status.tables_exist.store_wallets || !status.tables_exist.wallet_transactions) {
    recommendations.push({
      action: 'Create Database Tables',
      description: 'Run the SQL script in Supabase SQL Editor to create wallet tables',
      endpoint: '/api/setup-wallet-system-simple',
      method: 'POST'
    });
  }

  if (status.data_counts.stores > 0 && status.data_counts.wallets === 0) {
    recommendations.push({
      action: 'Initialize Wallet Entries',
      description: 'Create wallet entries for existing stores',
      endpoint: '/api/setup-wallet-system-simple',
      method: 'POST'
    });
  }

  if (status.data_counts.orders > 0 && status.data_counts.transactions === 0) {
    recommendations.push({
      action: 'Process Existing Orders',
      description: 'Process existing confirmed/RTO orders for wallet transactions',
      endpoint: '/api/setup-wallet-system-simple',
      method: 'POST'
    });
  }

  if (status.data_counts.stores === 0) {
    recommendations.push({
      action: 'Add Test Store',
      description: 'No stores found. Add a test store first',
      endpoint: '/api/setup-test-data',
      method: 'POST'
    });
  }

  return recommendations;
}
