import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const status = {
      system_overview: {
        total_stores: 0,
        stores_with_wallets: 0,
        stores_without_wallets: 0,
        total_transactions: 0,
        total_wallet_balance: 0
      },
      stores: [],
      missing_wallets: [],
      recent_transactions: []
    };

    // Get all stores from multiple sources
    const allStores = new Set<string>();

    // Source 1: seller_store_configs table
    try {
      const { data: configStores, error: configError } = await supabase
        .from('seller_store_configs')
        .select('store_url')
        .not('store_url', 'is', null);

      if (!configError && configStores) {
        configStores.forEach(store => allStores.add(store.store_url));
      }
    } catch (error) {
      console.log('seller_store_configs table not accessible');
    }

    // Source 2: order_status table
    try {
      const { data: orderStores, error: orderError } = await supabase
        .from('order_status')
        .select('store_url')
        .not('store_url', 'is', null);

      if (!orderError && orderStores) {
        orderStores.forEach(order => allStores.add(order.store_url));
      }
    } catch (error) {
      console.log('order_status table not accessible');
    }

    // Source 3: shopify_tokens table
    try {
      const { data: tokenStores, error: tokenError } = await supabase
        .from('shopify_tokens')
        .select('store_url')
        .not('store_url', 'is', null);

      if (!tokenError && tokenStores) {
        tokenStores.forEach(token => allStores.add(token.store_url));
      }
    } catch (error) {
      console.log('shopify_tokens table not accessible');
    }

    // Source 4: store_configs table
    try {
      const { data: storeConfigs, error: storeError } = await supabase
        .from('store_configs')
        .select('store_url')
        .not('store_url', 'is', null);

      if (!storeError && storeConfigs) {
        storeConfigs.forEach(config => allStores.add(config.store_url));
      }
    } catch (error) {
      console.log('store_configs table not accessible');
    }

    const uniqueStores = Array.from(allStores);
    status.system_overview.total_stores = uniqueStores.length;

    // Get all wallet balances
    try {
      const { data: wallets, error: walletError } = await supabase
        .from('store_wallets')
        .select('*')
        .order('balance', { ascending: false });

      if (!walletError && wallets) {
        status.system_overview.stores_with_wallets = wallets.length;
        status.system_overview.total_wallet_balance = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance), 0);

        // Add wallet info to stores
        for (const storeUrl of uniqueStores) {
          const wallet = wallets.find(w => w.store_url === storeUrl);
          if (wallet) {
            status.stores.push({
              store_url: storeUrl,
              wallet_balance: parseFloat(wallet.balance),
              wallet_created: wallet.created_at,
              wallet_updated: wallet.updated_at,
              has_wallet: true
            });
          } else {
            status.stores.push({
              store_url: storeUrl,
              wallet_balance: 0,
              has_wallet: false
            });
            status.missing_wallets.push(storeUrl);
          }
        }
      }
    } catch (error) {
      console.log('Error fetching wallets:', error);
      // If wallets table doesn't exist, mark all stores as missing wallets
      uniqueStores.forEach(storeUrl => {
        status.stores.push({
          store_url: storeUrl,
          wallet_balance: 0,
          has_wallet: false
        });
        status.missing_wallets.push(storeUrl);
      });
    }

    status.system_overview.stores_without_wallets = status.missing_wallets.length;

    // Get recent transactions
    try {
      const { data: transactions, error: transactionError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!transactionError && transactions) {
        status.system_overview.total_transactions = transactions.length;
        status.recent_transactions = transactions.map(t => ({
          id: t.id,
          store_url: t.store_url,
          order_number: t.order_number,
          transaction_type: t.transaction_type,
          amount: parseFloat(t.amount),
          balance_after: parseFloat(t.balance_after),
          description: t.description,
          created_at: t.created_at
        }));
      }
    } catch (error) {
      console.log('Error fetching transactions:', error);
    }

    // Get order statistics for each store
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('order_status')
        .select('store_url, status')
        .in('status', ['confirmed', 'rto']);

      if (!ordersError && orders) {
        const orderStats = {};
        orders.forEach(order => {
          if (!orderStats[order.store_url]) {
            orderStats[order.store_url] = { confirmed: 0, rto: 0 };
          }
          if (order.status === 'confirmed') {
            orderStats[order.store_url].confirmed++;
          } else if (order.status === 'rto') {
            orderStats[order.store_url].rto++;
          }
        });

        // Add order stats to stores
        status.stores.forEach(store => {
          const stats = orderStats[store.store_url] || { confirmed: 0, rto: 0 };
          store.order_stats = stats;
          store.expected_margin = stats.confirmed * 150; // 15% of 1000 default
          store.expected_penalties = stats.rto * 100; // ₹100 per RTO
          store.net_expected = store.expected_margin - store.expected_penalties;
        });
      }
    } catch (error) {
      console.log('Error fetching order statistics:', error);
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

  if (status.system_overview.stores_without_wallets > 0) {
    recommendations.push({
      action: 'Initialize Missing Wallets',
      description: `${status.system_overview.stores_without_wallets} stores don't have wallet entries`,
      endpoint: '/api/wallet/initialize',
      method: 'POST'
    });
  }

  if (status.system_overview.total_transactions === 0 && status.system_overview.total_stores > 0) {
    recommendations.push({
      action: 'Process Existing Orders',
      description: 'No wallet transactions found. Process existing confirmed/RTO orders',
      endpoint: '/api/wallet/initialize',
      method: 'POST'
    });
  }

  if (status.system_overview.total_stores === 0) {
    recommendations.push({
      action: 'Add Test Data',
      description: 'No stores found. Add test stores and orders first',
      endpoint: '/api/setup-test-data',
      method: 'POST'
    });
  }

  return recommendations;
}
