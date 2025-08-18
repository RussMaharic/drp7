import { ShopifyStoreConfig, ShopifyOrder } from '../types/store-config';

export class ShopifyDirectClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(private config: ShopifyStoreConfig) {
    this.baseUrl = `https://${config.storeUrl}/admin/api/2024-01`;
    this.headers = this.getAuthHeaders();
  }

  private getAuthHeaders(): HeadersInit {
    const token = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async fetchOrders(since?: Date): Promise<ShopifyOrder[]> {
    try {
      const dateFilter = since ? `created_at_min=${since.toISOString()}` : '';
      const url = `${this.baseUrl}/orders.json?status=any&${dateFilter}`;
      
      const response = await fetch(url, {
        headers: this.headers,
        cache: 'no-store'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Shopify API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      return data.orders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  async fetchProducts(limit = 50, page = 1): Promise<any> {
    try {
      const url = `${this.baseUrl}/products.json?limit=${limit}&page=${page}`;
      
      const response = await fetch(url, {
        headers: this.headers,
        cache: 'no-store'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Shopify API error: ${JSON.stringify(error)}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async fetchInventoryLevels(locationId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/inventory_levels.json?location_ids=${locationId}`;
      
      const response = await fetch(url, {
        headers: this.headers,
        cache: 'no-store'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Shopify API error: ${JSON.stringify(error)}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching inventory levels:', error);
      throw error;
    }
  }
}