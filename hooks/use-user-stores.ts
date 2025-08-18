import { useState, useEffect, useCallback } from 'react'

interface UserStore {
  shop: string
  name: string
  connectedAt: string
  lastUpdated: string
  type: string
  source: string
}

interface UserStoresResponse {
  stores: UserStore[]
  username: string
  totalStores: number
}

export function useUserStores() {
  const [stores, setStores] = useState<UserStore[]>([])
  const [username, setUsername] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/stores/user')
      
      if (!response.ok) {
        throw new Error('Failed to fetch stores')
      }

      const data: UserStoresResponse = await response.json()
      setStores(data.stores)
      setUsername(data.username)
    } catch (err) {
      console.error('Error fetching stores:', err)
      setError(err instanceof Error ? err.message : 'Failed to load stores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  const hasStoreAccess = useCallback((storeUrl: string): boolean => {
    return stores.some(store => store.shop === storeUrl)
  }, [stores])

  const getStore = useCallback((storeUrl: string): UserStore | undefined => {
    return stores.find(store => store.shop === storeUrl)
  }, [stores])

  const refreshStores = useCallback(() => {
    fetchStores()
  }, [fetchStores])

  return {
    stores,
    username,
    loading,
    error,
    hasStoreAccess,
    getStore,
    refreshStores,
    totalStores: stores.length
  }
}