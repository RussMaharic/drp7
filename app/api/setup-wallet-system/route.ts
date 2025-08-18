import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('Setting up wallet system...');

    // Step 1: Create wallet tables
    const createTablesSQL = `
      -- Create wallet table for each store
      CREATE TABLE IF NOT EXISTS store_wallets (
        id SERIAL PRIMARY KEY,
        store_url VARCHAR(255) NOT NULL UNIQUE,
        balance DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create wallet transactions table for logging all wallet activities
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        store_url VARCHAR(255) NOT NULL,
        order_id VARCHAR(255),
        order_number VARCHAR(255),
        transaction_type VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        balance_before DECIMAL(10,2) NOT NULL,
        balance_after DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by VARCHAR(100) DEFAULT 'system'
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_store_wallets_store_url ON store_wallets(store_url);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_store_url ON wallet_transactions(store_url);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON wallet_transactions(order_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

      -- Add trigger to update updated_at timestamp
      CREATE OR REPLACE FUNCTION update_store_wallets_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_store_wallets_updated_at ON store_wallets;
      CREATE TRIGGER update_store_wallets_updated_at
          BEFORE UPDATE ON store_wallets
          FOR EACH ROW
          EXECUTE FUNCTION update_store_wallets_updated_at();
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTablesSQL });
    if (createError) {
      console.error('Error creating tables:', createError);
      return NextResponse.json({ error: 'Failed to create wallet tables' }, { status: 500 });
    }

    console.log('Wallet tables created successfully');

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

    // Step 3: Create wallet entries for each store
    if (stores && stores.length > 0) {
      const walletEntries = stores.map(store => ({
        store_url: store.store_url,
        balance: 0.00
      }));

      const { error: insertError } = await supabase
        .from('store_wallets')
        .upsert(walletEntries, { onConflict: 'store_url' });

      if (insertError) {
        console.error('Error creating wallet entries:', insertError);
        return NextResponse.json({ error: 'Failed to create wallet entries' }, { status: 500 });
      }

      console.log(`Created wallet entries for ${stores.length} stores`);
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
      orders_processed: existingOrders?.length || 0
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Internal server error during setup' }, { status: 500 });
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
