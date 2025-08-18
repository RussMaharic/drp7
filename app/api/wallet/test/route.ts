import { NextRequest, NextResponse } from 'next/server';
import { WalletService } from '@/lib/services/wallet-service';

export async function GET(request: NextRequest) {
  try {
    const testStore = 'teast32123.myshopify.com';
    
    // Test 1: Get wallet balance
    const balance = await WalletService.getWalletBalance(testStore);
    
    // Test 2: Get transaction history
    const transactions = await WalletService.getTransactionHistory(testStore);
    
    // Test 3: Add a test margin transaction
    await WalletService.addMarginEarned(
      testStore,
      'test-order-001',
      'TEST001',
      150.00
    );
    
    // Test 4: Get updated balance
    const newBalance = await WalletService.getWalletBalance(testStore);
    
    // Test 5: Add a test RTO penalty
    await WalletService.deductRTOTPenalty(
      testStore,
      'test-order-002',
      'TEST002',
      100.00
    );
    
    // Test 6: Get final balance
    const finalBalance = await WalletService.getWalletBalance(testStore);
    
    // Test 7: Get final transaction history
    const finalTransactions = await WalletService.getTransactionHistory(testStore);
    
    return NextResponse.json({
      success: true,
      message: 'Wallet system test completed successfully',
      test_results: {
        initial_balance: balance,
        balance_after_margin: newBalance,
        final_balance: finalBalance,
        total_transactions: finalTransactions.length,
        recent_transactions: finalTransactions.slice(0, 5)
      }
    });
    
  } catch (error) {
    console.error('Wallet test error:', error);
    return NextResponse.json({ 
      error: 'Wallet system test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
