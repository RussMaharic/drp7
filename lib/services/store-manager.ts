import { supabase } from '../supabase';
import { ShopifyStoreConfig, ShopifyOrder } from '../types/store-config';
import { ShopifyDirectClient } from './shopify-direct-client';

export class StoreManager {
  async addStore(config: ShopifyStoreConfig): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('store_configs')
        .upsert({
          store_url: config.storeUrl,
          store_name: config.storeName,
          api_key: config.apiKey,
          api_secret: config.apiSecret,
          pull_orders_from: config.pullOrdersFrom,
          is_active: config.isActive
        });

      if (error) {
        console.error('Error adding store:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in addStore:', error);
      return false;
    }
  }

  async getStore(storeUrl: string): Promise<ShopifyStoreConfig | null> {
    try {
      const { data, error } = await supabase
        .from('store_configs')
        .select('*')
        .eq('store_url', storeUrl)
        .single();

      if (error || !data) {
        console.error('Error fetching store:', error);
        return null;
      }

      return {
        id: data.id,
        storeUrl: data.store_url,
        storeName: data.store_name,
        apiKey: data.api_key,
        apiSecret: data.api_secret,
        pullOrdersFrom: new Date(data.pull_orders_from),
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error in getStore:', error);
      return null;
    }
  }

  async getAllStores(): Promise<ShopifyStoreConfig[]> {
    try {
      const { data, error } = await supabase
        .from('store_configs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.error('Error fetching stores:', error);
        return [];
      }

      return data.map(store => ({
        id: store.id,
        storeUrl: store.store_url,
        storeName: store.store_name,
        apiKey: store.api_key,
        apiSecret: store.api_secret,
        pullOrdersFrom: new Date(store.pull_orders_from),
        isActive: store.is_active,
        createdAt: new Date(store.created_at),
        updatedAt: new Date(store.updated_at)
      }));
    } catch (error) {
      console.error('Error in getAllStores:', error);
      return [];
    }
  }

  async getStoreOrders(storeUrl: string): Promise<ShopifyOrder[] | null> {
    try {
      const store = await this.getStore(storeUrl);
      if (!store) return null;

      const client = new ShopifyDirectClient(store);
      return client.fetchOrders(store.pullOrdersFrom);
    } catch (error) {
      console.error('Error in getStoreOrders:', error);
      return null;
    }
  }

  async updateStorePullDate(storeUrl: string, newDate: Date): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('store_configs')
        .update({ pull_orders_from: newDate.toISOString() })
        .eq('store_url', storeUrl);

      return !error;
    } catch (error) {
      console.error('Error updating store pull date:', error);
      return false;
    }
  }

  async deleteStore(storeUrl: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('store_configs')
        .delete()
        .eq('store_url', storeUrl);

      return !error;
    } catch (error) {
      console.error('Error deleting store:', error);
      return false;
    }
  }
}