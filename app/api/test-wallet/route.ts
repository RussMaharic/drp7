import { NextResponse } from 'next/server'
import { WalletService } from '@/lib/services/wallet-service'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Testing wallet system...')
    
    // Test wallet functionality
    const testStore = 'teast32123.myshopify.com'
    
    // First, check if the wallet tables exist by trying to query them
    console.log('📊 Checking if wallet tables exist...')
    
    try {
      // Test if store_wallets table exists
      const { data: walletTest, error: walletError } = await supabase
        .from('store_wallets')
        .select('*')
        .limit(1)
      
      if (walletError && walletError.code === '42P01') { // Table doesn't exist
        console.log('❌ store_wallets table does not exist. Creating tables...')
        
        // Create the tables manually
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
        `
        
        // Try to execute the SQL (this might not work without proper permissions)
        console.log('⚠️  Tables need to be created manually. Please run the migration SQL.')
        return NextResponse.json({
          success: false,
          error: 'Database tables not found',
          message: 'Please run the migration SQL to create wallet tables',
          migrationSQL: createTablesSQL
        })
      }
      
      console.log('✅ store_wallets table exists')
      
    } catch (error) {
      console.error('Error checking tables:', error)
    }
    
    // Test getting balance (should return 0 for new store)
    console.log('💰 Testing wallet balance...')
    const balance = await WalletService.getWalletBalance(testStore)
    console.log('Initial balance:', balance)
    
    // Test adding margin
    console.log('➕ Testing margin addition...')
    await WalletService.addMarginEarned(testStore, 'test-order-1', '1001', 150)
    
    // Test getting balance again
    const newBalance = await WalletService.getWalletBalance(testStore)
    console.log('Balance after margin:', newBalance)
    
    // Test RTO penalty
    console.log('➖ Testing RTO penalty...')
    await WalletService.deductRTOTPenalty(testStore, 'test-order-2', '1002', 100)
    
    // Test getting final balance
    const finalBalance = await WalletService.getWalletBalance(testStore)
    console.log('Final balance:', finalBalance)
    
    // Test getting transaction history
    console.log('📋 Testing transaction history...')
    const transactions = await WalletService.getTransactionHistory(testStore)
    console.log('Transaction count:', transactions.length)
    
    // Check if order_status table has data
    console.log('📦 Checking order_status table...')
    const { data: orderStatuses, error: orderError } = await supabase
      .from('order_status')
      .select('*')
      .eq('store_url', testStore)
    
    if (orderError) {
      console.log('❌ Error fetching order statuses:', orderError)
    } else {
      console.log('✅ Order statuses found:', orderStatuses?.length || 0)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Wallet system test completed successfully',
      results: {
        initialBalance: balance,
        afterMargin: newBalance,
        finalBalance: finalBalance,
        transactionCount: transactions.length,
        transactions: transactions,
        orderStatusesCount: orderStatuses?.length || 0,
        orderStatuses: orderStatuses || []
      }
    })
    
  } catch (error) {
    console.error('Wallet test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Wallet system test failed'
    }, { status: 500 })
  }
}
