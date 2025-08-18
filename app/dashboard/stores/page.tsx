"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { Store, Plus, ExternalLink, Trash2, Settings, User } from 'lucide-react'
import DashboardLayout from '@/components/dashboard-layout'

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

export default function StoresPage() {
  const [stores, setStores] = useState<UserStore[]>([])
  const [username, setUsername] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetchUserStores()
  }, [])

  const fetchUserStores = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/stores/user')
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/seller/login')
          return
        }
        throw new Error('Failed to fetch stores')
      }

      const data: UserStoresResponse = await response.json()
      setStores(data.stores)
      setUsername(data.username)
    } catch (err) {
      console.error('Error fetching stores:', err)
      setError(err instanceof Error ? err.message : 'Failed to load stores')
      toast({
        title: "Error",
        description: "Failed to load your stores",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConnectNewStore = () => {
    router.push('/connect-store')
  }

  const handleRemoveStore = async (storeUrl: string) => {
    try {
      const response = await fetch(`/api/stores/direct?shop=${encodeURIComponent(storeUrl)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to remove store')
      }

      toast({
        title: "Success",
        description: "Store removed successfully",
      })

      // Refresh the stores list
      fetchUserStores()
    } catch (err) {
      console.error('Error removing store:', err)
      toast({
        title: "Error",
        description: "Failed to remove store",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'direct': return 'default'
      case 'oauth': return 'secondary'
      case 'legacy': return 'outline'
      default: return 'outline'
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Store className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading your stores...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Stores</h1>
            <p className="text-muted-foreground">
              Manage your connected Shopify stores
            </p>
          </div>
          <Button onClick={handleConnectNewStore}>
            <Plus className="h-4 w-4 mr-2" />
            Connect Store
          </Button>
        </div>

        {/* User Info */}
        {username && (
          <Alert>
            <User className="h-4 w-4" />
            <AlertDescription>
              Showing stores for user: <strong>{username}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stores Grid */}
        {stores.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Store className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No stores connected</h3>
              <p className="text-muted-foreground text-center mb-6">
                Connect your first Shopify store to start managing your products and orders.
              </p>
              <Button onClick={handleConnectNewStore}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Your First Store
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <Card key={store.shop} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Store className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-base">{store.name}</CardTitle>
                    </div>
                    <Badge variant={getTypeColor(store.type)} className="text-xs">
                      {store.type}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">
                    {store.shop}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      <p>Connected: {formatDate(store.connectedAt)}</p>
                      <p>Updated: {formatDate(store.lastUpdated)}</p>
                      <p>Source: {store.source}</p>
                    </div>

                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`https://${store.shop}`, '_blank')}
                        className="flex-1"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Visit
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/dashboard/orders?store=${store.shop}`)}
                        className="flex-1"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Manage
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRemoveStore(store.shop)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        {stores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stores.length}</p>
                  <p className="text-sm text-muted-foreground">Total Stores</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {stores.filter(s => s.type === 'direct').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Direct Connections</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">
                    {stores.filter(s => s.type === 'oauth').length}
                  </p>
                  <p className="text-sm text-muted-foreground">OAuth Connections</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {stores.filter(s => s.type === 'legacy').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Legacy Connections</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}