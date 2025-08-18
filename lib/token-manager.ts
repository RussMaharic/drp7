import { supabase } from './supabase'

export interface ShopifyToken {
  shop: string
  access_token: string
  username?: string
  created_at: string
  updated_at: string
}

export class TokenManager {
  // Get token for a specific shop
  static async getToken(shop: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('shopify_tokens')
        .select('access_token')
        .eq('shop', shop)
        .single()

      if (error) {
        console.error('Error fetching token:', error)
        return null
      }

      return data?.access_token || null
    } catch (error) {
      console.error('Error in getToken:', error)
      return null
    }
  }

  // Store token for a shop
  static async storeToken(shop: string, accessToken: string, username?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('shopify_tokens')
        .upsert({
          shop,
          access_token: accessToken,
          username,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'shop'
        })

      if (error) {
        console.error('Error storing token:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in storeToken:', error)
      return false
    }
  }

  // Get all connected stores (optionally filtered by username)
  static async getAllStores(username?: string): Promise<{ shop: string; created_at: string; updated_at: string; username?: string }[]> {
    try {
      let query = supabase
        .from('shopify_tokens')
        .select('shop, created_at, updated_at, username')
        .order('created_at', { ascending: false })

      if (username) {
        query = query.eq('username', username)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching stores:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getAllStores:', error)
      return []
    }
  }

  // Get stores for a specific user
  static async getUserStores(username: string): Promise<{ shop: string; created_at: string; updated_at: string }[]> {
    try {
      const { data, error } = await supabase
        .from('shopify_tokens')
        .select('shop, created_at, updated_at')
        .eq('username', username)
        .not('username', 'is', null) // Exclude records with null username
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching user stores:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getUserStores:', error)
      return []
    }
  }

  // Remove token for a shop
  static async removeToken(shop: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('shopify_tokens')
        .delete()
        .eq('shop', shop)

      if (error) {
        console.error('Error removing token:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in removeToken:', error)
      return false
    }
  }

  // Clear all tokens
  static async clearAllTokens(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('shopify_tokens')
        .delete()
        .neq('shop', '') // Delete all rows

      if (error) {
        console.error('Error clearing tokens:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in clearAllTokens:', error)
      return false
    }
  }

  // Check if token exists for a shop
  static async hasToken(shop: string): Promise<boolean> {
    const token = await this.getToken(shop)
    return !!token
  }
} 