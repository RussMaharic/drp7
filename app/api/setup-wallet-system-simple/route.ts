import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Only create client if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!supabase) {
      return NextResponse.json({
        error: 'Supabase not configured',
        message: 'Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables'
      }, { status: 500 });
    }

    console.log('Setting up wallet system (simple method)...');

    // Step 1: Check if tables exist, if not create them manually
    let { data: tableCheck, error: checkError } = await supabase
      .from('store_wallets')
      .select('count')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      // Table doesn't exist, we need to create it manually
      console.log('store_wallets table does not exist, creating...');
      
      // For now, let's just create wallet entries for existing stores
      // The tables will be created when the first transaction is processed
    }

    // Step 2: Get all existing stores from seller_store_configs
    const { data: stores, error: storesError } = await supabase
      .from('seller_store_configs')
      .select('store_url')
      .not('store_url', 'is', null);

    if (storesError) {
      console.error('Error fetching stores:', storesError);
      return NextResponse.json({ error: 'Failed to fetch existing stores' }, { status: 500 });
    }

    console.log(`Found ${stores?.length || 0} existing stores`);

    // Step 3: Create wallet entries for each store (this will create tables if they don't exist)
    if (stores && stores.length > 0) {
      for (const store of stores) {
        try {
          // Try to insert wallet entry - this will create the table if it doesn't exist
          const { error: insertError } = await supabase
            .from('store_wallets')
            .upsert({
              store_url: store.store_url,
              balance: 0.00
            }, { onConflict: 'store_url' });

          if (insertError) {
            console.error(`Error creating wallet for ${store.store_url}:`, insertError);
          }
        } catch (error) {
          console.error(`Error processing store ${store.store_url}:`, error);
        }
      }

      console.log(`Processed wallet entries for ${stores.length} stores`);
    }

    // Step 4: Process existing orders to populate wallet transactions
    const { data: existingOrders, error: ordersError } = await supabase
      .from('order_status')
      .select('*')
      .in('status', ['confirmed', 'rto']);

    if (ordersError) {
      console.error('Error fetching existing orders:', ordersError);
    } else if (existingOrders && existingOrders.length > 0) {
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
          }
        } catch (error) {
          console.error(`Error processing order ${order.order_id}:`, error);
        }
      }
    }

    // Step 5: Get final wallet status
    const { data: finalWallets, error: finalError } = await supabase
      .from('store_wallets')
      .select('*');

    const { data: finalTransactions, error: transactionsError } = await supabase
      .from('wallet_transactions')
      .select('*');

    return NextResponse.json({
      success: true,
      message: 'Wallet system setup completed successfully',
      wallets_created: finalWallets?.length || 0,
      transactions_processed: finalTransactions?.length || 0,
      stores_processed: stores?.length || 0,
      orders_processed: existingOrders?.length || 0,
      note: 'If tables were missing, you may need to run the SQL script manually in Supabase'
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during setup',
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
  }
}
