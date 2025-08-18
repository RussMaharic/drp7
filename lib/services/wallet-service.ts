import { supabase } from '@/lib/supabase'

export interface WalletTransaction {
  id: number
  store_url: string
  order_id?: string
  order_number?: string
  transaction_type: 'margin_earned' | 'rto_penalty' | 'withdrawal' | 'refund'
  amount: number
  balance_before: number
  balance_after: number
  description: string
  created_at: string
  created_by: string
}

export interface StoreWallet {
  id: number
  store_url: string
  balance: number
  created_at: string
  updated_at: string
}

export class WalletService {
  // Get wallet balance for a store
  static async getWalletBalance(storeUrl: string): Promise<number> {
    const { data, error } = await supabase
      .from('store_wallets')
      .select('balance')
      .eq('store_url', storeUrl)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to get wallet balance: ${error.message}`)
    }

    return data?.balance || 0
  }

  // Add margin earned from confirmed order
  static async addMarginEarned(
    storeUrl: string, 
    orderId: string, 
    orderNumber: string, 
    marginAmount: number,
    productDetails?: string
  ): Promise<void> {
    const { data: wallet, error: walletError } = await supabase
      .from('store_wallets')
      .select('balance')
      .eq('store_url', storeUrl)
      .single()

    let balanceBefore = 0
    let walletId: number

    if (walletError && walletError.code === 'PGRST116') {
      // Create new wallet if it doesn't exist
      const { data: newWallet, error: createError } = await supabase
        .from('store_wallets')
        .insert({ store_url: storeUrl, balance: marginAmount })
        .select()
        .single()

      if (createError) throw new Error(`Failed to create wallet: ${createError.message}`)
      walletId = newWallet.id
      balanceBefore = 0
    } else if (walletError) {
      throw new Error(`Failed to get wallet: ${walletError.message}`)
    } else {
      balanceBefore = wallet.balance
      const newBalance = balanceBefore + marginAmount

      const { error: updateError } = await supabase
        .from('store_wallets')
        .update({ balance: newBalance })
        .eq('store_url', storeUrl)

      if (updateError) throw new Error(`Failed to update wallet: ${updateError.message}`)
    }

    // Log transaction
    await this.logTransaction({
      store_url: storeUrl,
      order_id: orderId,
      order_number: orderNumber,
      transaction_type: 'margin_earned',
      amount: marginAmount,
      balance_before: balanceBefore,
      balance_after: balanceBefore + marginAmount,
      description: `Margin earned from order #${orderNumber}${productDetails ? ` - ${productDetails}` : ''}`,
      created_by: 'system'
    })
  }

  // Deduct RTO penalty based on seller-specific rate  
  static async deductRTOTPenalty(
    storeUrl: string, 
    orderId: string, 
    orderNumber: string, 
    penaltyAmount: number
  ): Promise<void> {
    // penaltyAmount is now passed directly (calculated by calling code)
    console.log(`[WalletService] Deducting RTO penalty: Order ${orderNumber}, Amount: ₹${penaltyAmount}`);

    const { data: wallet, error } = await supabase
      .from('store_wallets')
      .select('balance')
      .eq('store_url', storeUrl)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Create wallet with negative balance for RTO penalty
        await supabase
          .from('store_wallets')
          .insert({ store_url: storeUrl, balance: -penaltyAmount })

        await this.logTransaction({
          store_url: storeUrl,
          order_id: orderId,
          order_number: orderNumber,
          transaction_type: 'rto_penalty',
          amount: -penaltyAmount,
          balance_before: 0,
          balance_after: -penaltyAmount,
          description: `RTO penalty for order #${orderNumber}`,
          created_by: 'system'
        })
        return
      }
      throw new Error(`Failed to get wallet: ${error.message}`)
    }

    const balanceBefore = wallet.balance
    const newBalance = balanceBefore - penaltyAmount

    const { error: updateError } = await supabase
      .from('store_wallets')
      .update({ balance: newBalance })
      .eq('store_url', storeUrl)

    if (updateError) throw new Error(`Failed to update wallet: ${updateError.message}`)

    // Log transaction
    await this.logTransaction({
      store_url: storeUrl,
      order_id: orderId,
      order_number: orderNumber,
      transaction_type: 'rto_penalty',
      amount: -penaltyAmount,
      balance_before: balanceBefore,
      balance_after: newBalance,
      description: `RTO penalty for order #${orderNumber}`,
      created_by: 'system'
    })
  }

  // Get transaction history for a store
  static async getTransactionHistory(storeUrl: string): Promise<WalletTransaction[]> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('store_url', storeUrl)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to get transaction history: ${error.message}`)
    return data || []
  }

  private static async logTransaction(transaction: Omit<WalletTransaction, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('wallet_transactions')
      .insert(transaction)

    if (error) throw new Error(`Failed to log transaction: ${error.message}`)
  }
}
