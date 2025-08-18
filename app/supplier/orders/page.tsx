"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Search, Filter, Download, ShoppingCart, User, Calendar, DollarSign, RefreshCw, Package, Eye, MapPin } from "lucide-react"

interface SupplierOrder {
  id: string
  orderNumber: number
  customerName: string
  customerEmail: string
  customerPhone?: string
  shippingAddress?: {
    address1?: string
    address2?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  billingAddress?: {
    address1?: string
    address2?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  status: string
  financialStatus: string
  amount: number
  currency: string
  date: string
  supplierProducts: {
    id: string
    name: string
    quantity: number
    price: number
    productId: string
    variantId: string
  }[]
}

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<SupplierOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAddress, setSelectedAddress] = useState<any>(null)

  const [dateFilter, setDateFilter] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    fetchSupplierOrders()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, dateFilter])

  const fetchSupplierOrders = async (forceSync = false) => {
    try {
      setLoading(true)
      console.log('Fetching supplier orders...')
      
      // Get supplier name from localStorage for backwards compatibility
      const supplierName = localStorage.getItem('supplierName')
      console.log('Supplier name from localStorage:', supplierName)
      
      // Build URL with supplier name parameter for backwards compatibility
      let url = '/api/supplier/orders'
      const params = new URLSearchParams()
      
      if (supplierName) {
        params.append('supplierName', supplierName)
      }
      
      if (forceSync) {
        params.append('sync', 'true')
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      // Fetch orders from Supabase (much faster than Shopify API)
      const response = await fetch(url)
      const data = await response.json()

      console.log('API Response:', { status: response.status, data })

      if (response.ok) {
        setOrders(data.orders || [])
        console.log('Orders set:', data.orders)
        if (data.orders && data.orders.length > 0) {
          toast({
            title: data.synced ? "Orders Synced & Loaded" : "Orders Loaded",
            description: `Found ${data.orders.length} orders containing your products`,
          })
        } else {
          console.log('No orders found containing supplier products')
          if (!forceSync) {
            // Automatically try to sync if no orders found
            console.log('No orders found, trying to sync...')
            await fetchSupplierOrders(true)
            return
          }
        }
      } else {
        console.error('API Error:', data)
        throw new Error(data.error || 'Failed to fetch orders')
      }
    } catch (error) {
      console.error('Error fetching supplier orders:', error)
      toast({
        title: "Error",
        description: `Failed to fetch orders: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterOrders = () => {
    let filtered = orders

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toString().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.supplierProducts.some(product => 
          product.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    // Filter by date
    if (dateFilter !== "all") {
      const now = new Date()
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.date)
        switch (dateFilter) {
          case "today":
            return orderDate.toDateString() === now.toDateString()
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return orderDate >= weekAgo
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return orderDate >= monthAgo
          default:
            return true
        }
      })
    }

    setFilteredOrders(filtered)
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'INR') {
      return `₹${amount.toLocaleString('en-IN')}`
    }
    return `${currency} ${amount.toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getFinancialStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { variant: "default" as const, label: "Paid" },
      pending: { variant: "secondary" as const, label: "Pending" },
      authorized: { variant: "secondary" as const, label: "Authorized" },
      partially_paid: { variant: "secondary" as const, label: "Partially Paid" },
      refunded: { variant: "destructive" as const, label: "Refunded" },
      voided: { variant: "destructive" as const, label: "Voided" },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "secondary" as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const calculateTotalRevenue = () => {
    return filteredOrders.reduce((total, order) => {
      const orderTotal = order.supplierProducts.reduce((productTotal, product) => {
        return productTotal + (product.price * product.quantity)
      }, 0)
      return total + orderTotal
    }, 0)
  }

  const getTotalItems = () => {
    return filteredOrders.reduce((total, order) => {
      return total + order.supplierProducts.reduce((productTotal, product) => {
        return productTotal + product.quantity
      }, 0)
    }, 0)
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

  const getAddressType = (order: SupplierOrder) => {
    if (order.shippingAddress) return 'Shipping Address'
    if (order.billingAddress) return 'Billing Address'
    return 'No Address'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Orders containing your products
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => fetchSupplierOrders(false)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchSupplierOrders(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Orders
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{getTotalItems()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(calculateTotalRevenue(), 'INR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredOrders.filter(order => {
                    const orderDate = new Date(order.date)
                    const now = new Date()
                    return orderDate.getMonth() === now.getMonth() && 
                           orderDate.getFullYear() === now.getFullYear()
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search orders, customers, or products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({filteredOrders.length})</CardTitle>
          <CardDescription>
            Recent orders containing your products
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {orders.length === 0 
                  ? "You don't have any orders yet." 
                  : "No orders match your current filters."
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Your Products</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const orderRevenue = order.supplierProducts.reduce((total, product) => {
                    return total + (product.price * product.quantity)
                  }, 0)
                  
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium">#{order.orderNumber}</div>
                        <div className="text-sm text-gray-500">{order.id.slice(0, 8)}...</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-sm text-gray-500">{order.customerEmail}</div>
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
                                         
                                         {/* Individual Fields */}
                                         <div className="grid grid-cols-2 gap-3">
                                           {selectedAddress.address1 && (
                                             <div>
                                               <div className="font-medium text-xs text-gray-500">Address Line 1</div>
                                               <div className="text-sm">{selectedAddress.address1}</div>
                                             </div>
                                           )}
                                           {selectedAddress.address2 && (
                                             <div>
                                               <div className="font-medium text-xs text-gray-500">Address Line 2</div>
                                               <div className="text-sm">{selectedAddress.address2}</div>
                                             </div>
                                           )}
                                           {selectedAddress.city && (
                                             <div>
                                               <div className="font-medium text-xs text-gray-500">City</div>
                                               <div className="text-sm">{selectedAddress.city}</div>
                                             </div>
                                           )}
                                           {(selectedAddress.state || selectedAddress.province) && (
                                             <div>
                                               <div className="font-medium text-xs text-gray-500">State/Province</div>
                                               <div className="text-sm">{selectedAddress.state || selectedAddress.province}</div>
                                             </div>
                                           )}
                                           {selectedAddress.zip && (
                                             <div>
                                               <div className="font-medium text-xs text-gray-500">ZIP/Postal Code</div>
                                               <div className="text-sm">{selectedAddress.zip}</div>
                                             </div>
                                           )}
                                           {selectedAddress.country && (
                                             <div>
                                               <div className="font-medium text-xs text-gray-500">Country</div>
                                               <div className="text-sm">{selectedAddress.country}</div>
                                             </div>
                                           )}
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
                      <TableCell>
                        {getFinancialStatusBadge(order.financialStatus)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {order.supplierProducts.slice(0, 2).map((product, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium text-gray-900">{product.name}</div>
                            </div>
                          ))}
                          {order.supplierProducts.length > 2 && (
                            <div className="text-xs text-gray-400">
                              +{order.supplierProducts.length - 2} more products
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {order.supplierProducts.slice(0, 2).map((product, index) => (
                            <div key={index} className="text-sm font-medium">
                              {product.quantity}x
                            </div>
                          ))}
                          {order.supplierProducts.length > 2 && (
                            <div className="text-xs text-gray-400">
                              {order.supplierProducts.slice(2).reduce((sum, product) => sum + product.quantity, 0)}x more
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(orderRevenue, order.currency)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(order.date)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}