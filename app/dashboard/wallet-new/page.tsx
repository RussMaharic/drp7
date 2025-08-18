"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStore } from '@/contexts/store-context'
import { Wallet, TrendingUp, TrendingDown, DollarSign, Package, RefreshCw, Settings, Plus, Edit2, Trash2 } from 'lucide-react'
import DashboardLayout from '@/components/dashboard-layout'

interface Product {
  id: string
  shopify_product_id: string
  product_name: string
  margin_per_unit: number
  store_url: string
  created_at: string
}

interface WalletOrder {
  id: string
  orderNumber: string
  status: string
  storeUrl: string
  updatedAt: string
  marginAmount: number
  penaltyAmount: number
  productDetails?: any
}

interface WalletTransaction {
  id: number
  order_id?: string
  order_number?: string
  transaction_type: string
  amount: number
  description: string
  created_at: string
}

export default function WalletNewPage() {
  const { selectedStore } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<WalletOrder[]>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [newMargin, setNewMargin] = useState<string>('')

  useEffect(() => {
    if (selectedStore) {
      loadWalletData()
    }
  }, [selectedStore])

  const loadWalletData = async () => {
    if (!selectedStore) return
    
    try {
      setLoading(true)
      
      // Load products with margins
      const productsResponse = await fetch(`/api/wallet-new/products?store=${selectedStore}`)
      const productsData = await productsResponse.json()
      if (productsData.success) {
        setProducts(productsData.data)
      }

      // Load orders and wallet data
      const ordersResponse = await fetch(`/api/wallet-new/orders?store=${selectedStore}`)
      const ordersData = await ordersResponse.json()
      if (ordersData.success) {
        setOrders(ordersData.data.orders)
        setTransactions(ordersData.data.transactions)
        setBalance(ordersData.data.balance)
        setSummary(ordersData.data.summary)
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProductMargin = async (productId: string, newMarginValue: number) => {
    try {
      const response = await fetch('/api/wallet-new/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          margin: newMarginValue,
          storeUrl: selectedStore
        })
      })

      if (response.ok) {
        await loadWalletData()
        setEditingProduct(null)
        setNewMargin('')
      }
    } catch (error) {
      console.error('Failed to update margin:', error)
    }
  }

  const handleMarginEdit = (productId: string, currentMargin: number) => {
    setEditingProduct(productId)
    setNewMargin(currentMargin.toString())
  }

  const handleMarginSave = (productId: string) => {
    const marginValue = parseFloat(newMargin)
    if (!isNaN(marginValue)) {
      updateProductMargin(productId, marginValue)
    }
  }

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>
      case 'rto':
        return <Badge variant="destructive">RTO</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'margin_earned':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'rto_penalty':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Wallet className="h-4 w-4 text-gray-600" />
    }
  }

  if (!selectedStore) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">Please select a store to view wallet information.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Wallet System</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage product margins and wallet balance for {selectedStore}
            </p>
          </div>
          <Button onClick={loadWalletData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold">{summary.totalOrders}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Confirmed</p>
                    <p className="text-2xl font-bold text-green-600">₹{summary.totalMargins.toFixed(2)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">RTO</p>
                    <p className="text-2xl font-bold text-red-600">₹{summary.totalPenalties.toFixed(2)}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Net Balance</p>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{balance.toFixed(2)}
                    </p>
                  </div>
                  <Wallet className={`h-8 w-8 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Wallet Balance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Current Wallet Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{balance.toFixed(2)}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date().toLocaleString()}
            </p>
            {summary && (
              <div className="mt-3 text-sm text-gray-600">
                <div>Total Margins: ₹{summary.totalMargins.toFixed(2)}</div>
                <div>Total Penalties: ₹{summary.totalPenalties.toFixed(2)}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products">Product Margins</TabsTrigger>
            <TabsTrigger value="orders">Orders & Impact</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Product Margins Management
                </CardTitle>
                <CardDescription>
                  Set individual margins for each product in your store
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading products...</div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No products found. Push some products to your store first.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Margin per Unit</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            {product.product_name}
                          </TableCell>
                          <TableCell>{product.shopify_product_id}</TableCell>
                          <TableCell>
                            {editingProduct === product.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={newMargin}
                                  onChange={(e) => setNewMargin(e.target.value)}
                                  className="w-24"
                                  placeholder="0.00"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleMarginSave(product.id)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingProduct(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <span className="text-green-600 font-medium">
                                ₹{product.margin_per_unit.toFixed(2)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingProduct !== product.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarginEdit(product.id, product.margin_per_unit)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Orders & Wallet Impact</CardTitle>
                <CardDescription>
                  Orders that affect your wallet balance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading orders...</div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No orders found.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Wallet Impact</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="font-medium">#{order.orderNumber}</div>
                          </TableCell>
                          <TableCell>
                            {getOrderStatusBadge(order.status)}
                          </TableCell>
                          <TableCell>
                            {order.status === 'confirmed' ? (
                              order.marginAmount === -1 ? (
                                <span className="text-gray-500 font-medium">NA</span>
                              ) : (
                                <span className="text-green-600 font-medium">
                                  +₹{order.marginAmount.toFixed(2)}
                                </span>
                              )
                            ) : order.status === 'rto' ? (
                              <span className="text-red-600 font-medium">
                                -₹{order.penaltyAmount.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-500">No impact</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(order.updatedAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>
      </div>
    </DashboardLayout>
  )
}
