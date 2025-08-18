"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useStore } from '@/contexts/store-context'
import { WalletService, WalletTransaction } from '@/lib/services/wallet-service'
import { Wallet, TrendingUp, TrendingDown, DollarSign, Package, RefreshCw, Eye } from 'lucide-react'
import DashboardLayout from '@/components/dashboard-layout'

interface WalletOrder {
  id: string
  orderNumber: string
  status: string
  storeUrl: string
  updatedAt: string
  tracking?: {
    trackingNumber: string
    carrier: string
    trackingUrl?: string
  } | null
  marginAmount: number
  penaltyAmount: number
}

interface WalletSummary {
  totalOrders: number
  confirmedOrders: number
  rtoOrders: number
  totalMargin: number
  totalPenalties: number
}

export default function WalletPage() {
  const { selectedStore } = useStore()
  const [balance, setBalance] = useState<number>(0)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [orders, setOrders] = useState<WalletOrder[]>([])
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (selectedStore) {
      loadWalletData()
    }
  }, [selectedStore])

  const loadWalletData = async () => {
    if (!selectedStore) return
    
    try {
      setLoading(true)
      
      // Fetch wallet data from the new API endpoint
      const response = await fetch(`/api/wallet/orders?store=${selectedStore}`)
      const data = await response.json()
      
      if (data.success) {
        const incomingSummary = data.data.summary
        const netEarnings = incomingSummary
          ? incomingSummary.totalMargin - incomingSummary.totalPenalties
          : data.data.walletBalance
        // Keep wallet balance same as net earnings
        setBalance(netEarnings)
        setTransactions(data.data.transactionHistory)
        setOrders(data.data.orders)
        setSummary(incomingSummary)
      } else {
        console.error('Failed to load wallet data:', data.error)
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'margin_earned':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'rto_penalty':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'withdrawal':
        return <DollarSign className="h-4 w-4 text-blue-600" />
      default:
        return <Wallet className="h-4 w-4 text-gray-600" />
    }
  }

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'margin_earned':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Margin Earned</Badge>
      case 'rto_penalty':
        return <Badge variant="destructive">RTO Penalty</Badge>
      case 'withdrawal':
        return <Badge variant="outline">Withdrawal</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
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
        {/* Header with Refresh Button */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage your wallet balance and view transaction history for {selectedStore}
            </p>
          </div>
          <Button onClick={loadWalletData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <p className="text-sm font-medium text-gray-600">Confirmed Orders</p>
                    <p className="text-2xl font-bold text-green-600">{summary.confirmedOrders}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">RTO Orders</p>
                    <p className="text-2xl font-bold text-red-600">{summary.rtoOrders}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Net Earnings</p>
                    <p className="text-2xl font-bold text-green-600">
                      ₹{(summary.totalMargin - summary.totalPenalties).toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
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
            <CardDescription>
              Real-time balance for {selectedStore}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ₹{balance.toFixed(2)}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date().toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Orders with Wallet Impact */}
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
                        {order.tracking && (
                          <div className="text-xs text-gray-500">
                            {order.tracking.carrier}: {order.tracking.trackingNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getOrderStatusBadge(order.status)}
                      </TableCell>
                      <TableCell>
                        {order.status === 'confirmed' ? (
                          <span className="text-green-600 font-medium">
                            +₹{order.marginAmount.toFixed(2)}
                          </span>
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


      </div>
    </DashboardLayout>
  )
}
