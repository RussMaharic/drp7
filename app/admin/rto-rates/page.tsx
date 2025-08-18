"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Edit, Trash2, Save, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface SellerRTORate {
  id: number
  seller_id: string
  store_url: string
  rto_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
}

interface Seller {
  id: string
  username: string
  name: string
  email: string
}

interface Store {
  shop: string
  store_name?: string
}

export default function RTORatesPage() {
  const [rtoRates, setRtoRates] = useState<SellerRTORate[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<SellerRTORate | null>(null)
  const [formData, setFormData] = useState({
    sellerId: '',
    storeUrl: '',
    rtoRate: ''
  })
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  const checkAuthentication = () => {
    const adminUser = localStorage.getItem('adminUser')
    if (adminUser) {
      setIsAuthenticated(true)
    } else {
      router.push('/login/admin')
    }
    setAuthLoading(false)
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch RTO rates
      const rtoResponse = await fetch('/api/admin/seller-rto-rates')
      if (rtoResponse.ok) {
        const rtoData = await rtoResponse.json()
        setRtoRates(rtoData.rtoRates || [])
      }

      // Fetch sellers
      const sellersResponse = await fetch('/api/admin/sellers')
      if (sellersResponse.ok) {
        const sellersData = await sellersResponse.json()
        setSellers(sellersData.sellers || [])
      }

      // Fetch stores
      const storesResponse = await fetch('/api/admin/stores')
      if (storesResponse.ok) {
        const storesData = await storesResponse.json()
        setStores(storesData.stores || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.sellerId || !formData.storeUrl || !formData.rtoRate) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      })
      return
    }

    const rtoRate = parseFloat(formData.rtoRate)
    if (isNaN(rtoRate) || rtoRate < 0) {
      toast({
        title: "Error",
        description: "RTO rate must be >= 0",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/admin/seller-rto-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerId: formData.sellerId,
          storeUrl: formData.storeUrl,
          rtoRate: rtoRate
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: editingRate ? "RTO rate updated successfully" : "RTO rate created successfully",
        })
        setDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to save RTO rate",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error saving RTO rate:', error)
      toast({
        title: "Error",
        description: "Failed to save RTO rate",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (sellerId: string, storeUrl: string) => {
    if (!confirm('Are you sure you want to delete this RTO rate?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/seller-rto-rates?sellerId=${sellerId}&storeUrl=${storeUrl}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "RTO rate deleted successfully",
        })
        fetchData()
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to delete RTO rate",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting RTO rate:', error)
      toast({
        title: "Error",
        description: "Failed to delete RTO rate",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (rate: SellerRTORate) => {
    setEditingRate(rate)
    setFormData({
      sellerId: rate.seller_id,
      storeUrl: rate.store_url,
      rtoRate: rate.rto_rate.toString()
    })
    setDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditingRate(null)
    resetForm()
    setDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      sellerId: '',
      storeUrl: '',
      rtoRate: ''
    })
  }

  const getSellerName = (sellerId: string) => {
    const seller = sellers.find(s => s.id === sellerId)
    return seller ? `${seller.name} (${seller.username})` : sellerId
  }

  const getStoreName = (storeUrl: string) => {
    const store = stores.find(s => s.shop === storeUrl)
    return store?.shop || storeUrl
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seller RTO Rates</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage seller-specific RTO (Return to Origin) rates
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add RTO Rate
        </Button>
      </div>

      {/* RTO Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle>RTO Rates Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>RTO Rate (₹)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rtoRates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No RTO rates configured. Click "Add RTO Rate" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rtoRates.map((rate) => (
                  <TableRow key={`${rate.seller_id}-${rate.store_url}`}>
                    <TableCell>{getSellerName(rate.seller_id)}</TableCell>
                    <TableCell>{getStoreName(rate.store_url)}</TableCell>
                    <TableCell>₹{rate.rto_rate}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        rate.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {rate.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(rate.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(rate)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(rate.seller_id, rate.store_url)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? 'Edit RTO Rate' : 'Add New RTO Rate'}
            </DialogTitle>
            <DialogDescription>
              Configure seller-specific RTO rates for different stores.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Seller *</label>
              <select
                value={formData.sellerId}
                onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select a seller</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name} ({seller.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Store *</label>
              <select
                value={formData.storeUrl}
                onChange={(e) => setFormData({ ...formData, storeUrl: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select a store</option>
                {stores.map((store) => (
                  <option key={store.shop} value={store.shop}>
                    {store.shop}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">RTO Rate (₹) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 100.00"
                value={formData.rtoRate}
                onChange={(e) => setFormData({ ...formData, rtoRate: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500">
                Enter the fixed rupee amount that will be deducted from the seller's wallet for RTO orders.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {editingRate ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

