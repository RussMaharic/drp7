import { supabase } from '@/lib/supabase';
import { WalletService } from './wallet-service';

export interface OrderWalletUpdate {
  orderId: string;
  orderNumber: string;
  storeUrl: string;
  status: 'confirmed' | 'cancelled' | 'rto';
  orderAmount: number;
  sellerId?: string;
}

export class OrderWalletService {
  // Process wallet updates when order status changes
  static async processOrderStatusChange(update: OrderWalletUpdate): Promise<void> {
    try {
      console.log(`Processing wallet update for order ${update.orderNumber}:`, update);

      switch (update.status) {
        case 'confirmed':
          await this.handleConfirmedOrder(update);
          break;
        case 'cancelled':
        case 'rto':
          await this.handleRTOCancellation(update);
          break;
        default:
          console.log(`No wallet action needed for status: ${update.status}`);
      }
    } catch (error) {
      console.error('Error processing order wallet update:', error);
      throw error;
    }
  }

  // Handle confirmed order - add margin to wallet
  private static async handleConfirmedOrder(update: OrderWalletUpdate): Promise<void> {
    try {
      // Get order details and product mappings
      const { data: orderItems } = await supabase
        .from('supplier_orders')
        .select(`
          id,
          shopify_order_id,
          order_number,
          total_amount,
          line_items
        `)
        .eq('shopify_order_id', update.orderId)
        .eq('store_url', update.storeUrl)
        .single();

      if (!orderItems) {
        console.log(`No supplier order found for ${update.orderId}`);
        return;
      }

      // Get product mappings to calculate total margin
      const { data: productMappings } = await supabase
        .from('product_shopify_mappings')
        .select('margin, shopify_product_id')
        .eq('shopify_store_url', update.storeUrl);

      if (!productMappings || productMappings.length === 0) {
        console.log(`No product mappings found for store ${update.storeUrl}`);
        return;
      }

      // Calculate total margin from order items
      let totalMargin = 0;
      const lineItems = orderItems.line_items || [];
      
      for (const item of lineItems) {
        const mapping = productMappings.find(m => m.shopify_product_id === item.product_id?.toString());
        if (mapping && mapping.margin) {
          totalMargin += mapping.margin * item.quantity;
        }
      }

      if (totalMargin > 0) {
        await WalletService.addMarginEarned(
          update.storeUrl,
          update.orderId,
          update.orderNumber,
          totalMargin,
          `Total margin from ${lineItems.length} items`
        );
        console.log(`Added margin ${totalMargin} to wallet for order ${update.orderNumber}`);
      } else {
        console.log(`No margin found for order ${update.orderNumber}`);
      }
    } catch (error) {
      console.error('Error handling confirmed order:', error);
      throw error;
    }
  }

  // Handle RTO/cancelled order - deduct penalty from wallet
  private static async handleRTOCancellation(update: OrderWalletUpdate): Promise<void> {
    try {
      // Get seller ID for the store
      let sellerId = update.sellerId;
      if (!sellerId) {
        const { data: storeConnection } = await supabase
          .from('seller_store_connections')
          .select('seller_id')
          .eq('store_url', update.storeUrl)
          .eq('is_active', true)
          .single();
        
        if (storeConnection) {
          sellerId = storeConnection.seller_id;
        }
      }

      await WalletService.deductRTOTPenalty(
        update.storeUrl,
        update.orderId,
        update.orderNumber,
        update.orderAmount,
        sellerId
      );
      
      console.log(`Deducted RTO penalty for order ${update.orderNumber}`);
    } catch (error) {
      console.error('Error handling RTO cancellation:', error);
      throw error;
    }
  }

  // Get seller ID for a store
  static async getSellerIdForStore(storeUrl: string): Promise<string | null> {
    try {
      const { data: storeConnection } = await supabase
        .from('seller_store_connections')
        .select('seller_id')
        .eq('store_url', storeUrl)
        .eq('is_active', true)
        .single();

      return storeConnection?.seller_id || null;
    } catch (error) {
      console.error('Error getting seller ID for store:', error);
      return null;
    }
  }

  // Get RTO rate for a seller and store
  static async getRTORate(sellerId: string, storeUrl: string): Promise<number> {
    try {
      const { data: rtoRate } = await supabase
        .from('seller_rto_rates')
        .select('rto_rate')
        .eq('seller_id', sellerId)
        .eq('store_url', storeUrl)
        .eq('is_active', true)
        .single();

      return rtoRate?.rto_rate || 0.0; // Default 0 rupees (no penalty if not configured)
    } catch (error) {
      console.error('Error getting RTO rate:', error);
      return 0.0; // Default rate
    }
  }
}

