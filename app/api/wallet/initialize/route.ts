import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function initializeAll() {
  try {
    console.log('Initializing wallet system for all sellers and stores...');

    const results = {
      stores_found: [],
      wallets_created: [],
      transactions_processed: [],
      errors: []
    };

    // Step 1: Find all stores from multiple sources
    const allStores = new Set<string>();

    // Source 1: seller_store_configs table
    try {
      const { data: configStores, error: configError } = await supabase
        .from('seller_store_configs')
        .select('store_url')
        .not('store_url', 'is', null);

      if (!configError && configStores) {
        configStores.forEach(store => allStores.add(store.store_url));
        console.log(`Found ${configStores.length} stores from seller_store_configs`);
      }
    } catch (error) {
      console.log('seller_store_configs table not accessible');
    }

    // Source 2: seller_store_connections table
    try {
      const { data: connStores, error: connError } = await supabase
        .from('seller_store_connections')
        .select('store_url')
        .not('store_url', 'is', null)
        .eq('is_active', true)

      if (!connError && connStores) {
        connStores.forEach(row => allStores.add(row.store_url));
        console.log(`Found ${connStores.length} stores from seller_store_connections`);
      }
    } catch (error) {
      console.log('seller_store_connections table not accessible');
    }

    // Source 3: order_status table
    try {
      const { data: orderStores, error: orderError } = await supabase
        .from('order_status')
        .select('store_url')
        .not('store_url', 'is', null);

      if (!orderError && orderStores) {
        orderStores.forEach(order => allStores.add(order.store_url));
        console.log(`Found ${orderStores.length} stores from order_status`);
      }
    } catch (error) {
      console.log('order_status table not accessible');
    }

    // Source 4: shopify_tokens table
    try {
      const { data: tokenStores, error: tokenError } = await supabase
        .from('shopify_tokens')
        .select('store_url')
        .not('store_url', 'is', null);

      if (!tokenError && tokenStores) {
        tokenStores.forEach(token => allStores.add(token.store_url));
        console.log(`Found ${tokenStores.length} stores from shopify_tokens`);
      }
    } catch (error) {
      console.log('shopify_tokens table not accessible');
    }

    // Source 5: store_configs table
    try {
      const { data: storeConfigs, error: storeError } = await supabase
        .from('store_configs')
        .select('store_url')
        .not('store_url', 'is', null);

      if (!storeError && storeConfigs) {
        storeConfigs.forEach(config => allStores.add(config.store_url));
        console.log(`Found ${storeConfigs.length} stores from store_configs`);
      }
    } catch (error) {
      console.log('store_configs table not accessible');
    }

    const uniqueStores = Array.from(allStores);
    results.stores_found = uniqueStores;
    console.log(`Total unique stores found: ${uniqueStores.length}`);

    // Step 2: Create wallet entries for all stores
    for (const storeUrl of uniqueStores) {
      try {
        const { error: insertError } = await supabase
          .from('store_wallets')
          .upsert({
            store_url: storeUrl,
            balance: 0.00
          }, { onConflict: 'store_url' });

        if (!insertError) {
          results.wallets_created.push(storeUrl);
        } else {
          results.errors.push(`Failed to create wallet for ${storeUrl}: ${insertError.message}`);
        }
      } catch (error) {
        results.errors.push(`Error creating wallet for ${storeUrl}: ${error}`);
      }
    }

    // Step 3: Process existing orders for all stores
    try {
      const { data: existingOrders, error: ordersError } = await supabase
        .from('order_status')
        .select('*')
        .in('status', ['confirmed', 'rto']);

      if (!ordersError && existingOrders && existingOrders.length > 0) {
        console.log(`Processing ${existingOrders.length} existing orders for wallet transactions`);

        for (const order of existingOrders) {
          try {
            const orderAmount = order.order_amount || 1000; // Default amount if not available
            const marginAmount = orderAmount * 0.15; // 15% margin
            const rtoPenalty = 100; // ₹100 penalty

            if (order.status === 'confirmed') {
              // Add margin earned
              await processWalletTransaction(
                order.store_url,
                order.order_id,
                order.order_number,
                'margin_earned',
                marginAmount,
                `Margin earned from order #${order.order_number}`
              );
              results.transactions_processed.push({
                store: order.store_url,
                order: order.order_number,
                type: 'margin_earned',
                amount: marginAmount
              });
            } else if (order.status === 'rto') {
              // Deduct RTO penalty
              await processWalletTransaction(
                order.store_url,
                order.order_id,
                order.order_number,
                'rto_penalty',
                -rtoPenalty,
                `RTO penalty for order #${order.order_number}`
              );
              results.transactions_processed.push({
                store: order.store_url,
                order: order.order_number,
                type: 'rto_penalty',
                amount: -rtoPenalty
              });
            }
          } catch (error) {
            results.errors.push(`Error processing order ${order.order_id}: ${error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Error fetching orders: ${error}`);
    }

    // Step 4: Get final statistics
    const { data: finalWallets, error: finalError } = await supabase
      .from('store_wallets')
      .select('*');

    const { data: finalTransactions, error: transactionsError } = await supabase
      .from('wallet_transactions')
      .select('*');

    return {
      success: true,
      message: 'Wallet system initialized for all sellers and stores',
      summary: {
        total_stores_found: uniqueStores.length,
        wallets_created: results.wallets_created.length,
        transactions_processed: results.transactions_processed.length,
        total_wallets_in_db: finalWallets?.length || 0,
        total_transactions_in_db: finalTransactions?.length || 0
      },
      details: results,
      stores: uniqueStores
    };

  } catch (error) {
    console.error('Initialization error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await initializeAll();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error during wallet initialization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Convenience GET so you can hit it in the browser
export async function GET(request: NextRequest) {
  try {
    const result = await initializeAll();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error during wallet initialization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function processWalletTransaction(
  storeUrl: string,
  orderId: string,
  orderNumber: string,
  transactionType: string,
  amount: number,
  description: string
) {
  try {
    // Get current wallet balance
    const { data: wallet } = await supabase
      .from('store_wallets')
      .select('balance')
      .eq('store_url', storeUrl)
      .single();

    const currentBalance = wallet?.balance || 0;
    const newBalance = currentBalance + amount;

    // Update wallet balance
    await supabase
      .from('store_wallets')
      .upsert({
        store_url: storeUrl,
        balance: newBalance
      }, { onConflict: 'store_url' });

    // Log transaction
    await supabase
      .from('wallet_transactions')
      .insert({
        store_url: storeUrl,
        order_id: orderId,
        order_number: orderNumber,
        transaction_type: transactionType,
        amount: amount,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: description
      });

  } catch (error) {
    console.error(`Error processing transaction for ${storeUrl}:`, error);
    throw error;
  }
}
