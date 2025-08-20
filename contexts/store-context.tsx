"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { WalletService } from '@/lib/services/wallet-service'

interface Store {
  shop: string
  connectedAt: string
  lastUpdated: string
  isValid?: boolean
  type?: 'oauth' | 'direct'
  name?: string
}

interface StoreContextType {
  selectedStore: string
  connectedStores: Store[]
  loading: boolean
  setSelectedStore: (store: string) => void
  refreshStores: () => Promise<void>
  disconnectStore: (shop: string) => Promise<void>
  checkConnectionStatus: (shop: string) => Promise<boolean>
  walletBalance: number
  refreshWalletBalance: () => Promise<void>
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [selectedStore, setSelectedStoreState] = useState<string>("")
  const [connectedStores, setConnectedStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const { toast } = useToast()

  const fetchConnectedStores = useCallback(async () => {
    try {
      setLoading(true)
      
      // Only fetch stores if we're on dashboard pages, not auth pages
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
      if (currentPath.includes('/auth/') || currentPath.includes('/login/')) {
        setConnectedStores([])
        setLoading(false)
        return
      }
      
      // Fetch user-specific stores only
      const userStoresResponse = await fetch('/api/stores/user');

      const allStores: Store[] = [];

      // Add user-specific stores
      if (userStoresResponse.ok) {
        const userData = await userStoresResponse.json();
        allStores.push(...userData.stores.map((store: any) => ({
          shop: store.shop,
          connectedAt: store.connectedAt,
          lastUpdated: store.lastUpdated,
          type: store.type as 'oauth' | 'direct',
          name: store.name
        })));
      } else if (userStoresResponse.status === 401) {
        // User not authenticated, clear stores
        setConnectedStores([]);
        setLoading(false);
        return;
      }
        
      // Validate each store's connection
      const storesWithStatus = await Promise.all(
        allStores.map(async (store: Store) => {
          try {
            // For direct stores, try the direct orders API first
            if (store.type === 'direct') {
              const validationResponse = await fetch(`/api/stores/orders?storeUrl=${store.shop}`);
              if (validationResponse.ok) {
                return {
                  ...store,
                  isValid: true
                };
              } else {
                // Try direct orders API as fallback for direct stores
                const directResponse = await fetch(`/api/shopify-direct-orders?shop=${store.shop}&accessToken=test`);
                return {
                  ...store,
                  isValid: directResponse.status !== 400 // 400 means auth issue, other errors might be valid
                };
              }
            }
            
            // Fallback to regular products API for OAuth stores
            const validationResponse = await fetch(`/api/shopify-products?shop=${store.shop}`);
            return {
              ...store,
              isValid: validationResponse.ok
            };
          } catch {
            return {
              ...store,
              isValid: false
            };
          }
        })
      );
        
      setConnectedStores(storesWithStatus)
        
        // Always select a store if available
        if (storesWithStatus.length > 0) {
          // First try to load from localStorage
          const savedStore = localStorage.getItem('selectedShopifyStore')
          const validSavedStore = savedStore && storesWithStatus.some((s: Store) => s.shop === savedStore && s.isValid !== false)
          
          if (validSavedStore) {
            setSelectedStoreState(savedStore)
          } else {
            // Otherwise select the first valid store
            const firstValidStore = storesWithStatus.find(s => s.isValid !== false)
            if (firstValidStore) {
              setSelectedStoreState(firstValidStore.shop)
              localStorage.setItem('selectedShopifyStore', firstValidStore.shop)
            } else {
              setSelectedStoreState("")
              localStorage.removeItem('selectedShopifyStore')
            }
          }
        } else {
          // No stores available
          setSelectedStoreState("")
          localStorage.removeItem('selectedShopifyStore')
        }
    } catch (error) {
      console.error('Error fetching stores:', error)
      setSelectedStoreState("")
    } finally {
      setLoading(false)
    }
  }, [])

  const setSelectedStore = useCallback((store: string) => {
    setSelectedStoreState(store)
    localStorage.setItem('selectedShopifyStore', store)
  }, [])

  const refreshStores = useCallback(async () => {
    await fetchConnectedStores()
  }, [fetchConnectedStores])

  const disconnectStore = useCallback(async (shop: string) => {
    try {
      // Find the store to determine its type
      const store = connectedStores.find(s => s.shop === shop);
      
      // Try to delete from both OAuth and direct API stores
      const promises = [
        // Delete from OAuth stores
        fetch(`/api/shopify/stores?shop=${shop}`, {
          method: 'DELETE'
        }),
        // Delete from direct API stores
        fetch(`/api/stores/direct?shop=${shop}`, {
          method: 'DELETE'
        })
      ];

      const responses = await Promise.allSettled(promises);
      let success = false;

      // Check if at least one deletion was successful
      for (const response of responses) {
        if (response.status === 'fulfilled' && response.value.ok) {
          success = true;
          break;
        }
      }

      if (success) {
        toast({
          title: "Store Disconnected",
          description: `${shop} has been disconnected successfully`,
        })
        
        // Clear selection if this was the selected store
        if (selectedStore === shop) {
          setSelectedStore('');
        }
        
        // Refresh stores list
        await fetchConnectedStores()
      } else {
        toast({
          title: "Error",
          description: "Failed to disconnect store from all systems",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect store",
        variant: "destructive",
      })
    }
  }, [fetchConnectedStores, toast, connectedStores, selectedStore, setSelectedStore])

  const checkConnectionStatus = useCallback(async (shop: string): Promise<boolean> => {
    if (!shop) return false
    
    try {
      const res = await fetch(`/api/shopify-products?shop=${shop}`)
      return res.ok
    } catch (error) {
      return false
    }
  }, [])

  const refreshWalletBalance = useCallback(async () => {
    // Only fetch wallet balance if we're on dashboard pages
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    if (currentPath.includes('/auth/') || currentPath.includes('/login/')) {
      return
    }
    
    if (selectedStore) {
      try {
        const balance = await WalletService.getWalletBalance(selectedStore)
        setWalletBalance(balance)
      } catch (error) {
        console.error('Failed to refresh wallet balance:', error)
      }
    }
  }, [selectedStore])

  useEffect(() => {
    fetchConnectedStores()
  }, [fetchConnectedStores])

  useEffect(() => {
    refreshWalletBalance()
  }, [selectedStore, refreshWalletBalance])

  const contextValue: StoreContextType = {
    selectedStore,
    connectedStores,
    loading,
    setSelectedStore,
    refreshStores,
    disconnectStore,
    checkConnectionStatus,
    walletBalance,
    refreshWalletBalance
  }

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}
