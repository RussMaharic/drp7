"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Search, Filter, Download, Package, User, Calendar, DollarSign, RefreshCw, Store, LogOut, MapPin, Truck, Plus, Edit, ExternalLink, CheckCircle, XCircle, Clock, AlertTriangle, RotateCcw } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TokenManager } from "@/lib/token-manager"
import { createClient } from '@supabase/supabase-js'
import { WalletService } from "@/lib/services/wallet-service"

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AdminOrder {
  id: string
  orderNumber: number
  name: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  shippingAddress?: {
    firstName?: string
    lastName?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    province?: string
    zip?: string
    country?: string
    phone?: string
  }
  billingAddress?: {
    firstName?: string
    lastName?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    province?: string
    zip?: string
    country?: string
    phone?: string
  }
  status: "pending" | "fulfilled" | "cancelled" | "partial"
  financialStatus: string
  amount: number
  currency: string
  date: string
  storeName: string
  margin: number
  lineItems: Array<{
    id: number
    name: string
    quantity: number
    price: number
  }>
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<AdminOrder[]>([])
  const [stores, setStores] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [productFilter, setProductFilter] = useState("all")
  const [storeFilter, setStoreFilter] = useState("all")
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [trackingData, setTrackingData] = useState<{[key: string]: any}>({})
  const [trackingForm, setTrackingForm] = useState({
    trackingNumber: '',
    carrier: '',
    trackingUrl: '',
    notes: ''
  })
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<string | null>(null)

  // Function to update order status
  const handleStatusUpdate = async (orderId: string, store: string, newStatus: string, orderNumber: number) => {
    try {
      setStatusUpdateLoading(orderId)
      
      // Calculate margin for confirmed orders (15% of order amount)
      const order = orders.find(o => o.id === orderId && o.storeName === store)
      const orderAmount = order?.amount || 0
      const marginAmount = orderAmount * 0.15
      const rtoPenaltyAmount = 100 // Fixed RTO penalty amount

      // Handle wallet transactions based on status change
      if (newStatus === 'confirmed') {
        await WalletService.addMarginEarned(store, orderId, orderNumber.toString(), marginAmount)
      } else if (newStatus === 'rto') {
        await WalletService.deductRTOTPenalty(store, orderId, orderNumber.toString(), rtoPenaltyAmount)
      }

      // First check if order status exists
      const { data: existingStatus } = await supabase
        .from('order_status')
        .select()
        .eq('shopify_order_id', orderId)
        .eq('store_url', store)
        .single()

      let dbError
      if (existingStatus) {
        // Update existing record
        const { error } = await supabase
          .from('order_status')
          .update({
            status: newStatus,
            updated_by: 'admin',
            updated_at: new Date().toISOString()
          })
          .eq('shopify_order_id', orderId)
          .eq('store_url', store)
        dbError = error
      } else {
        // Insert new record
        const { error } = await supabase
          .from('order_status')
          .insert({
            shopify_order_id: orderId,
            store_url: store,
            order_number: orderNumber.toString(),
            status: newStatus,
            updated_by: 'admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        dbError = error
      }

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`)
      }

      // Then update Shopify order status
      const response = await fetch(`/api/shopify-orders?shop=${store}&orderId=${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fulfillmentStatus: newStatus
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Shopify API error: ${errorData.error}`)
      }

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId && order.storeName === store
            ? { ...order, status: newStatus }
            : order
        )
      )

      toast({
        title: "Success",
        description: `Order status updated to ${newStatus}`,
      })

    } catch (error) {
      console.error('Error updating order status:', error)
      toast({
        title: "Error",
        description: `Failed to update order status: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setStatusUpdateLoading(null)
    }
  }
  const { toast } = useToast()
  const router = useRouter()

  // Helper function to render status badge
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'fulfilled':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Fulfilled</Badge>
      case 'partially_fulfilled':
      case 'partial':
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">Partially Fulfilled</Badge>
      case 'unfulfilled':
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>
      case 'cancelled':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">Cancelled</Badge>
      case 'rto':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">RTO</Badge>
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">In Progress</Badge>
      default:
        return <Badge variant="secondary" className="border">{status || 'Unknown'}</Badge>
    }
  }

  // Helper function to calculate total items in an order
  const calculateTotalItems = (lineItems: Array<{quantity: number}>) => {
    if (!lineItems || lineItems.length === 0) return 0
    return lineItems.reduce((total, item) => total + (item.quantity || 0), 0)
  }

  // Fetch tracking data for orders (same approach as delivery tab)
  const fetchTrackingData = async () => {
    try {
      console.log('🔍 Fetching all tracking data from database...')
      
      // Fetch all tracking data without store filter (admin sees all)
      const response = await fetch('/api/tracking')
      if (response.ok) {
        const data = await response.json()
        console.log('📦 All tracking data received:', data.tracking)
        
        const trackingMap = data.tracking.reduce((acc: any, track: any) => {
          acc[track.shopify_order_id] = track
          return acc
        }, {})
        
        console.log('🗺️ Tracking map created:', trackingMap)
        setTrackingData(trackingMap)
      } else {
        console.error('❌ Failed to fetch tracking data:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('❌ Error fetching tracking data:', error)
    }
  }

  // Add or update tracking information
  const handleTrackingSubmit = async () => {
    if (!selectedOrder || !trackingForm.trackingNumber) {
      toast({
        title: "Error",
        description: "Please fill in the tracking number.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopifyOrderId: selectedOrder.id,
          orderNumber: selectedOrder.orderNumber.toString(),
          storeUrl: selectedOrder.storeName,
          trackingNumber: trackingForm.trackingNumber,
          carrier: trackingForm.carrier,
          trackingUrl: trackingForm.trackingUrl,
          notes: trackingForm.notes
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Tracking information saved successfully.",
        })
        setTrackingDialogOpen(false)
        setTrackingForm({ trackingNumber: '', carrier: '', trackingUrl: '', notes: '' })
        fetchTrackingData() // Refresh tracking data
      } else {
        throw new Error('Failed to save tracking information')
      }
    } catch (error) {
      console.error('Error saving tracking:', error)
      toast({
        title: "Error",
        description: "Failed to save tracking information.",
        variant: "destructive",
      })
    }
  }

  const openTrackingDialog = (order: AdminOrder) => {
    setSelectedOrder(order)
    const existingTracking = trackingData[order.id]
    if (existingTracking) {
      setTrackingForm({
        trackingNumber: existingTracking.tracking_number || '',
        carrier: existingTracking.carrier || '',
        trackingUrl: existingTracking.tracking_url || '',
        notes: existingTracking.notes || ''
      })
    } else {
      setTrackingForm({ trackingNumber: '', carrier: '', trackingUrl: '', notes: '' })
    }
    setTrackingDialogOpen(true)
  }

  const formatAddress = (address: any) => {
    if (!address) return 'No address available'
    
    const parts = []
    if (address.address1) parts.push(address.address1)
    if (address.address2) parts.push(address.address2)
    if (address.city) parts.push(address.city)
    if (address.state || address.province) parts.push(address.state || address.province)
    if (address.zip) parts.push(address.zip)
    if (address.country) parts.push(address.country)
    
    return parts.length > 0 ? parts.join(', ') : 'No address available'
  }

  const formatFullAddress = (address: any) => {
    if (!address) return 'No address available'
    
    const lines = []
    if (address.address1) lines.push(address.address1)
    if (address.address2) lines.push(address.address2)
    
    const cityStateZip = []
    if (address.city) cityStateZip.push(address.city)
    if (address.state || address.province) cityStateZip.push(address.state || address.province)
    if (address.zip) cityStateZip.push(address.zip)
    if (cityStateZip.length > 0) lines.push(cityStateZip.join(', '))
    
    if (address.country) lines.push(address.country)
    
    return lines.length > 0 ? lines.join('\n') : 'No address available'
  }

  const getAddressType = (order: AdminOrder) => {
    if (order.shippingAddress) return 'Shipping Address'
    if (order.billingAddress) return 'Billing Address'
    return 'No Address'
  }

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllStoresAndOrders()
      fetchTrackingData()
    }
  }, [isAuthenticated])

  const checkAuthentication = () => {
    try {
      const adminUser = localStorage.getItem('adminUser')
      if (adminUser) {
        setIsAuthenticated(true)
      } else {
        router.push('/login/admin')
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/login/admin')
    } finally {
      setAuthLoading(false)
    }
  }



  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, productFilter, storeFilter])

  const fetchAllStoresAndOrders = async () => {
    try {
      setLoading(true)
      
      // Get all connected stores
      const connectedStores = await TokenManager.getAllStores()
      const storeNames = connectedStores.map(store => store.shop)
      setStores(storeNames)

      // Fetch orders from all stores
      const allOrders: AdminOrder[] = []
      
      for (const store of connectedStores) {
        try {
          // Try GraphQL first, fallback to REST if needed
          let response = await fetch(`/api/shopify-orders-graphql?shop=${store.shop}`)
          
          if (!response.ok) {
            console.log(`GraphQL failed for ${store.shop}, trying REST API...`)
            response = await fetch(`/api/shopify-orders?shop=${store.shop}`)
          }
          
          if (response.ok) {
            const data = await response.json()
            const storeOrders = data.orders?.map((order: any) => ({
              ...order,
              customerPhone: order.customerPhone || null,
              shippingAddress: order.shippingAddress || null,
              billingAddress: order.billingAddress || null,
              storeName: store.shop,
              margin: calculateMargin(order.amount), // Calculate margin based on order amount
            })) || []
            
            allOrders.push(...storeOrders)
          }
        } catch (error) {
          console.error(`Error fetching orders for ${store.shop}:`, error)
        }
      }

      // Sort orders by date (newest first)
      allOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Fetch order statuses from the database
      const orderIds = allOrders.map(order => order.id);
      const { data: orderStatuses, error: statusError } = await supabase
        .from('order_status')
        .select('shopify_order_id, status')
        .in('shopify_order_id', orderIds);

      if (statusError) {
        console.error('Error fetching order statuses:', statusError);
      }

      // Merge order statuses with order data
      const statusMap = new Map();
      if (orderStatuses) {
        orderStatuses.forEach(status => {
          statusMap.set(status.shopify_order_id, status.status);
        });
      }

      const ordersWithStatus = allOrders.map(order => ({
        ...order,
        // Use admin-controlled status if available, otherwise use Shopify status
        status: statusMap.get(order.id) || order.status
      }));

      setOrders(ordersWithStatus)
      
      // Extract unique products from all orders
      const allProducts = new Set<string>()
      allOrders.forEach(order => {
        order.lineItems?.forEach(item => {
          if (item.name) {
            allProducts.add(item.name)
          }
        })
      })
      setProducts(Array.from(allProducts).sort())
      
    } catch (error) {
      console.error('Error fetching stores and orders:', error)
      toast({
        title: "Error",
        description: "Failed to fetch orders from stores.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateMargin = (orderAmount: number): number => {
    // Simple margin calculation - 15% of order amount
    // In a real app, this would be based on actual product costs
    return orderAmount * 0.15
  }

  const filterOrders = () => {
    let filtered = orders

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber.toString().includes(searchTerm)
      )
    }

    // Filter by status
    if (productFilter !== "all") {
      filtered = filtered.filter(order => 
        order.lineItems?.some(item => 
          item.name?.toLowerCase().includes(productFilter.toLowerCase())
        )
      )
    }

    // Filter by store
    if (storeFilter !== "all") {
      filtered = filtered.filter(order => order.storeName === storeFilter)
    }

    setFilteredOrders(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fulfilled":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "partial":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount)
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

  const exportOrders = () => {
    const csvContent = [
      ["Order #", "Customer", "Status", "Amount", "Store", "Margin", "Date"].join(","),
      ...filteredOrders.map(order => [
        order.orderNumber,
        order.customerName,
        order.status,
        order.amount,
        order.storeName,
        order.margin.toFixed(2),
        order.date
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "admin_orders.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // If not authenticated, redirect will happen in useEffect
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Orders</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage orders from all connected stores
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchAllStoresAndOrders} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={fetchTrackingData} variant="outline" size="sm">
            <Package className="h-4 w-4 mr-2" />
            Refresh Tracking
          </Button>
          <Button onClick={exportOrders} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => router.push('/admin/rto-rates')} variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            RTO Rates
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredOrders.reduce((sum, order) => sum + order.amount, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(filteredOrders.reduce((sum, order) => sum + order.margin, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Connected Stores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product} value={product}>
                    {product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store} value={store}>
                    {store}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              setSearchTerm("")
              setProductFilter("all")
              setStoreFilter("all")
            }}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tracking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {order.lineItems && order.lineItems.length > 0 ? (
                          order.lineItems.slice(0, 2).map((item, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium text-gray-900">{item.name}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500">No items</div>
                        )}
                        {order.lineItems && order.lineItems.length > 2 && (
                          <div className="text-xs text-gray-400">
                            +{order.lineItems.length - 2} more items
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[300px]">
                        {order.shippingAddress || order.billingAddress ? (
                          <div className="flex items-start space-x-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-gray-900 font-medium leading-tight">
                                {(order.shippingAddress || order.billingAddress)?.address1}
                              </div>
                              {(order.shippingAddress || order.billingAddress)?.address2 && (
                                <div className="text-gray-600 text-xs leading-tight">
                                  {(order.shippingAddress || order.billingAddress)?.address2}
                                </div>
                              )}
                              <div className="text-gray-600 text-xs leading-tight">
                                {[
                                  (order.shippingAddress || order.billingAddress)?.city,
                                  (order.shippingAddress || order.billingAddress)?.state || (order.shippingAddress || order.billingAddress)?.province,
                                  (order.shippingAddress || order.billingAddress)?.zip
                                ].filter(Boolean).join(', ')}
                              </div>
                              <div className="text-gray-500 text-xs">
                                {(order.shippingAddress || order.billingAddress)?.country}
                              </div>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-shrink-0"
                                  onClick={() => setSelectedAddress(order.shippingAddress || order.billingAddress)}
                                >
                                  <MapPin className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    {getAddressType(order)}
                                  </DialogTitle>
                                  <DialogDescription>
                                    Complete address details for order #{order.orderNumber}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  {selectedAddress && (
                                    <div className="space-y-4">
                                      {/* Customer Name */}
                                      {(selectedAddress.firstName || selectedAddress.lastName) && (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                          <div className="font-medium text-sm text-gray-500 mb-1">Customer Name</div>
                                          <div className="text-sm font-medium">
                                            {`${selectedAddress.firstName || ''} ${selectedAddress.lastName || ''}`.trim()}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Phone Number */}
                                      {selectedAddress.phone && (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                          <div className="font-medium text-sm text-gray-500 mb-1">Phone Number</div>
                                          <div className="text-sm">{selectedAddress.phone}</div>
                                        </div>
                                      )}
                                      
                                      {/* Full Address */}
                                      <div className="bg-gray-50 p-3 rounded-lg">
                                        <div className="font-medium text-sm text-gray-500 mb-2">Complete Address</div>
                                        <div className="text-sm whitespace-pre-line leading-relaxed">
                                          {formatFullAddress(selectedAddress)}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ) : (
                          <span className="text-gray-400">No address</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(order.amount, order.currency)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Store className="h-4 w-4 mr-2 text-gray-400" />
                        {order.storeName}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(order.date)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {calculateTotalItems(order.lineItems)} item{calculateTotalItems(order.lineItems) !== 1 ? 's' : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(order.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, order.storeName, 'confirmed', order.orderNumber)}
                              disabled={statusUpdateLoading === order.id}
                              className="text-blue-500 focus:text-blue-500"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Confirmed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, order.storeName, 'delivered', order.orderNumber)}
                              disabled={statusUpdateLoading === order.id}
                              className="text-green-600 focus:text-green-600"
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Delivered
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, order.storeName, 'in_transit', order.orderNumber)}
                              disabled={statusUpdateLoading === order.id}
                              className="text-yellow-600 focus:text-yellow-600"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              In Transit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, order.storeName, 'cancelled', order.orderNumber)}
                              disabled={statusUpdateLoading === order.id}
                              className="text-red-600 focus:text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelled
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, order.storeName, 'pickup_initiated', order.orderNumber)}
                              disabled={statusUpdateLoading === order.id}
                              className="text-purple-600 focus:text-purple-600"
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Pickup Initiated
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, order.storeName, 'pickup_aligned', order.orderNumber)}
                              disabled={statusUpdateLoading === order.id}
                              className="text-indigo-600 focus:text-indigo-600"
                            >
                              <MapPin className="h-4 w-4 mr-2" />
                              Pickup Aligned
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, order.storeName, 'undelivered', order.orderNumber)}
                              disabled={statusUpdateLoading === order.id}
                              className="text-orange-600 focus:text-orange-600"
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Undelivered
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, order.storeName, 'rto', order.orderNumber)}
                              disabled={statusUpdateLoading === order.id}
                              className="text-gray-600 focus:text-gray-600"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              RTO
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {statusUpdateLoading === order.id && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        console.log('🔍 Admin - Checking tracking for order:', order.id, 'Available tracking data:', trackingData);
                        const tracking = trackingData[order.id];
                        console.log('📦 Admin - Tracking found for order', order.id, ':', tracking);
                        
                        return tracking ? (
                          <div className="flex items-center space-x-2">
                            <Badge variant="default" className="flex items-center space-x-1">
                              <Truck className="h-3 w-3" />
                              <span className="text-xs">{tracking.carrier || 'Tracked'}</span>
                            </Badge>
                            {tracking.tracking_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(tracking.tracking_url, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTrackingDialog(order)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTrackingDialog(order)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Tracking
                          </Button>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tracking Dialog */}
      <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Truck className="h-5 w-5 mr-2" />
              {trackingData[selectedOrder?.id || ''] ? 'Edit Tracking Information' : 'Add Tracking Information'}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder ? `Order #${selectedOrder.orderNumber} - ${selectedOrder.storeName}` : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tracking Number *</label>
                <Input
                  placeholder="Enter tracking number"
                  value={trackingForm.trackingNumber}
                  onChange={(e) => setTrackingForm({ ...trackingForm, trackingNumber: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Carrier</label>
                <Select 
                  value={trackingForm.carrier} 
                  onValueChange={(value) => setTrackingForm({ ...trackingForm, carrier: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select carrier (auto-detected)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blue Dart">Blue Dart</SelectItem>
                    <SelectItem value="DTDC">DTDC</SelectItem>
                    <SelectItem value="Ecom Express">Ecom Express</SelectItem>
                    <SelectItem value="Delhivery">Delhivery</SelectItem>
                    <SelectItem value="Xpressbees">Xpressbees</SelectItem>
                    <SelectItem value="Shadowfax">Shadowfax</SelectItem>
                    <SelectItem value="UPS">UPS</SelectItem>
                    <SelectItem value="FedEx">FedEx</SelectItem>
                    <SelectItem value="India Post">India Post</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tracking URL (Optional)</label>
              <Input
                placeholder="Auto-generated or custom tracking URL"
                value={trackingForm.trackingUrl}
                onChange={(e) => setTrackingForm({ ...trackingForm, trackingUrl: e.target.value })}
              />
              <p className="text-xs text-gray-500">Leave empty to auto-generate based on carrier</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Input
                placeholder="Additional tracking notes"
                value={trackingForm.notes}
                onChange={(e) => setTrackingForm({ ...trackingForm, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setTrackingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleTrackingSubmit}>
                {trackingData[selectedOrder?.id || ''] ? 'Update Tracking' : 'Add Tracking'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 