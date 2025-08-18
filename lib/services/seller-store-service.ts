import { supabase } from '@/lib/supabase'

export interface SellerStoreConnection {
  id: string
  sellerId: string
  sellerUsername: string
  storeUrl: string
  storeName: string
  storeType: 'shopify' | 'direct'
  connectionType: 'oauth' | 'direct'
  accessToken?: string
  apiKey?: string
  apiSecret?: string
  isActive: boolean
  connectedAt: string
  lastSyncAt?: string
  createdAt: string
  updatedAt: string
}

export interface StoreConnectionData {
  storeUrl: string
  storeName: string
  storeType?: 'shopify' | 'direct'
  connectionType: 'oauth' | 'direct'
  accessToken?: string
  apiKey?: string
  apiSecret?: string
}

export class SellerStoreService {
  /**
   * Add a new store connection for a seller
   */
  static async addStoreConnection(
    sellerId: string,
    sellerUsername: string,
    connectionData: StoreConnectionData
  ): Promise<SellerStoreConnection> {
    try {
      console.log('SellerStoreService.addStoreConnection called with:', {
        sellerId,
        sellerUsername,
        storeUrl: connectionData.storeUrl,
        storeName: connectionData.storeName
      });

      // First check if a connection already exists for this store URL and seller
      const { data: existingData } = await supabase
        .from('seller_store_connections')
        .select('*')
        .eq('store_url', connectionData.storeUrl)
        .eq('seller_id', sellerId)
        .single();

      // Check if this store is connected to any other user
      const { data: otherUserConnection } = await supabase
        .from('seller_store_connections')
        .select('seller_username')
        .eq('store_url', connectionData.storeUrl)
        .neq('seller_id', sellerId)
        .eq('is_active', true)
        .single();

      if (otherUserConnection) {
        throw new Error(`This store is already connected to user: ${otherUserConnection.seller_username}`);
      }

      // If there's an existing connection for this user, update it
      if (existingData) {
        console.log('Existing store connection found for this user, updating...');
        
        const { data: updatedData, error: updateError } = await supabase
          .from('seller_store_connections')
          .update({
            store_name: connectionData.storeName,
            access_token: connectionData.accessToken,
            api_key: connectionData.apiKey,
            api_secret: connectionData.apiSecret,
            is_active: true, // Reactivate if it was inactive
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating existing store connection:', {
            message: updateError.message,
            details: updateError.details,
            code: updateError.code,
          });
          throw new Error(`Failed to update store connection: ${updateError.message}`);
        }

        return this.mapDbToConnection(updatedData);
      }

      // Try to deactivate any existing connections for this store first
      const { error: deactivateError } = await supabase
        .from('seller_store_connections')
        .update({ is_active: false })
        .eq('store_url', connectionData.storeUrl);

      if (deactivateError) {
        console.error('Error deactivating existing connections:', deactivateError);
      }

      // Now create the new connection
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('seller_store_connections')
        .insert({
          seller_id: sellerId,
          seller_username: sellerUsername,
          store_url: connectionData.storeUrl,
          store_name: connectionData.storeName,
          store_type: connectionData.storeType || 'shopify',
          connection_type: connectionData.connectionType,
          access_token: connectionData.accessToken,
          api_key: connectionData.apiKey,
          api_secret: connectionData.apiSecret,
          is_active: true,
          connected_at: now,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding new store connection:', {
          message: error.message,
          details: error.details,
          code: error.code,
        });
        throw new Error(`Failed to create store connection: ${error.message}`);
      }

      if (!data) {
        throw new Error('Failed to create store connection: no data returned');
      }

      console.log('Successfully created store connection:', data.id);
      return this.mapDbToConnection(data);
    } catch (err) {
      console.error('Error in addStoreConnection:', err);
      throw err; // Re-throw to be handled by the API route
    }
  }

  /**
   * Get all store connections for a seller by username
   */
  static async getSellerStoreConnections(sellerUsername: string): Promise<SellerStoreConnection[]> {
    try {
      const { data, error } = await supabase
        .from('seller_store_connections')
        .select('*')
        .eq('seller_username', sellerUsername)
        .eq('is_active', true)
        .order('connected_at', { ascending: false })

      if (error) {
        console.error('Error fetching seller store connections:', error)
        return []
      }

      return data.map(this.mapDbToConnection)
    } catch (error) {
      console.error('Error in getSellerStoreConnections:', error)
      return []
    }
  }

  /**
   * Get a specific store connection for a seller by username
   */
  static async getSellerStoreConnection(
    sellerUsername: string, 
    storeUrl: string
  ): Promise<SellerStoreConnection | null> {
    try {
      const { data, error } = await supabase
        .from('seller_store_connections')
        .select('*')
        .eq('seller_username', sellerUsername)
        .eq('store_url', storeUrl)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error('Error fetching seller store connection:', error)
        return null
      }

      return this.mapDbToConnection(data)
    } catch (error) {
      console.error('Error in getSellerStoreConnection:', error)
      return null
    }
  }

  /**
   * Update store connection
   */
  static async updateStoreConnection(
    sellerUsername: string,
    storeUrl: string,
    updates: Partial<StoreConnectionData>
  ): Promise<SellerStoreConnection | null> {
    try {
      const { data, error } = await supabase
        .from('seller_store_connections')
        .update({
          ...(updates.storeName && { store_name: updates.storeName }),
          ...(updates.accessToken && { access_token: updates.accessToken }),
          ...(updates.apiKey && { api_key: updates.apiKey }),
          ...(updates.apiSecret && { api_secret: updates.apiSecret }),
          last_sync_at: new Date().toISOString()
        })
        .eq('seller_username', sellerUsername)
        .eq('store_url', storeUrl)
        .select()
        .single()

      if (error) {
        console.error('Error updating store connection:', error)
        return null
      }

      return this.mapDbToConnection(data)
    } catch (error) {
      console.error('Error in updateStoreConnection:', error)
      return null
    }
  }

  /**
   * Remove store connection for a seller
   */
  static async removeStoreConnection(sellerUsername: string, storeUrl: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('seller_store_connections')
        .update({ is_active: false })
        .eq('seller_username', sellerUsername)
        .eq('store_url', storeUrl)

      if (error) {
        console.error('Error removing store connection:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in removeStoreConnection:', error)
      return false
    }
  }

  /**
   * Check if a seller has access to a specific store
   */
  static async hasStoreAccess(sellerUsername: string, storeUrl: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('seller_store_connections')
        .select('id')
        .eq('seller_username', sellerUsername)
        .eq('store_url', storeUrl)
        .eq('is_active', true)
        .single()

      return !error && !!data
    } catch (error) {
      return false
    }
  }

  /**
   * Get all sellers connected to a specific store
   */
  static async getSellersForStore(storeUrl: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('seller_store_connections')
        .select('seller_id')
        .eq('store_url', storeUrl)
        .eq('is_active', true)

      if (error) {
        console.error('Error fetching sellers for store:', error)
        return []
      }

      return data.map(row => row.seller_id)
    } catch (error) {
      console.error('Error in getSellersForStore:', error)
      return []
    }
  }

  /**
   * Validate store connection by testing API access
   */
  static async validateStoreConnection(connection: SellerStoreConnection): Promise<boolean> {
    try {
      if (connection.connectionType === 'oauth' && connection.accessToken) {
        // Test OAuth connection
        const response = await fetch(`https://${connection.storeUrl}/admin/api/2023-10/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': connection.accessToken,
            'Content-Type': 'application/json'
          }
        })
        return response.ok
      } else if (connection.connectionType === 'direct' && connection.apiKey && connection.apiSecret) {
        // Test direct API connection - this would depend on your specific API implementation
        // For now, we'll assume it's valid if we have the credentials
        return true
      }
      return false
    } catch (error) {
      console.error('Error validating store connection:', error)
      return false
    }
  }

  /**
   * Get access token for a seller's store
   */
  static async getStoreAccessToken(sellerUsername: string, storeUrl: string): Promise<string | null> {
    try {
      const connection = await this.getSellerStoreConnection(sellerUsername, storeUrl)
      return connection?.accessToken || null
    } catch (error) {
      console.error('Error getting store access token:', error)
      return null
    }
  }

  /**
   * Map database row to SellerStoreConnection interface
   */
  private static mapDbToConnection(data: any): SellerStoreConnection {
    // Ensure all dates are properly formatted strings
    const formatDate = (date: string | null) => date ? new Date(date).toISOString() : undefined;

    return {
      id: data.id,
      sellerId: data.seller_id,
      sellerUsername: data.seller_username,
      storeUrl: data.store_url,
      storeName: data.store_name,
      storeType: data.store_type,
      connectionType: data.connection_type,
      accessToken: data.access_token,
      apiKey: data.api_key,
      apiSecret: data.api_secret,
      isActive: data.is_active,
      connectedAt: formatDate(data.connected_at) || new Date().toISOString(),
      lastSyncAt: formatDate(data.last_sync_at),
      createdAt: formatDate(data.created_at) || new Date().toISOString(),
      updatedAt: formatDate(data.updated_at) || new Date().toISOString()
    }
  }
}