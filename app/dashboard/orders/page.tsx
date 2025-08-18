'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/contexts/store-context';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Search, Filter, Download, Package, User, Calendar, DollarSign, RefreshCw, Store, ShoppingCart, MapPin, X, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Order {
  id: string;
  name: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    province?: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    province?: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  status: string;
  financialStatus: string;
  amount: number;
  currency: string;
  date: string;
  lineItems: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    sku: string | null;
  }[];
  // Enhanced status fields
  displayFulfillmentStatus?: string;
  displayFinancialStatus?: string;
  cancelled?: boolean;
  cancelledAt?: string;
  cancelReason?: string;
  confirmed?: boolean;
  fullyPaid?: boolean;
}

export default function OrdersPage() {
  const router = useRouter();
  const { selectedStore, connectedStores, loading: layoutLoading } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [orderStatuses, setOrderStatuses] = useState<Record<string, any>>({});
  const [loadingStatuses, setLoadingStatuses] = useState<Record<string, boolean>>({});
  const [cancellingOrders, setCancellingOrders] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Get current store info
  const currentStore = connectedStores.find(store => store.shop === selectedStore);

  useEffect(() => {
    if (!layoutLoading && selectedStore) {
      fetchOrders();
    } else if (!layoutLoading && !selectedStore) {
      router.push('/connect-store');
    }
  }, [selectedStore, layoutLoading]);

  // Removed auto-fetch - users will manually refresh status as needed

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, productFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedStore) {
        throw new Error('No store selected');
      }

      // Try the unified orders API first
      let response = await fetch(`/api/stores/orders?storeUrl=${selectedStore}`);
      let data;

      if (response.ok) {
        data = await response.json();
      } else {
        // If unified API fails, try the GraphQL API directly
        console.log('Unified API failed, trying GraphQL...');
        response = await fetch(`/api/shopify-orders-graphql?shop=${selectedStore}`);
        
        if (response.ok) {
          data = await response.json();
        } else {
          // Finally try the REST API
          console.log('GraphQL failed, trying REST...');
          response = await fetch(`/api/shopify-orders?shop=${selectedStore}`);
          
          if (response.ok) {
            data = await response.json();
          } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch orders from all APIs');
          }
        }
      }

      // Normalize the order data to handle different API formats
      const normalizedOrders = (data.orders || []).map((order: any) => {
        console.log(`📦 Processing order ID: ${order.id}, Order Number: ${order.orderNumber || order.order_number || order.name}`);
        return {
          id: order.id,
          orderNumber: order.orderNumber || order.order_number || order.name,
          name: order.name,
          customerName: order.customerName || 'Guest',
          customerEmail: order.customerEmail || 'No email',
          customerPhone: order.customerPhone || null,
          shippingAddress: order.shippingAddress || null,
          billingAddress: order.billingAddress || null,
          status: order.status || 'pending',
          financialStatus: order.financialStatus || order.financial_status || 'pending',
          amount: order.amount || 0,
          currency: order.currency || 'INR',
          date: order.date || order.created_at,
          lineItems: order.lineItems || [],
          // Enhanced status fields for better tracking
          cancelled: order.cancelled,
          confirmed: order.confirmed
        };
      });

      setOrders(normalizedOrders);
      
      // Extract unique products from orders
      const allProducts = new Set<string>();
      normalizedOrders.forEach((order: Order) => {
        order.lineItems?.forEach((item: any) => {
          if (item.name) {
            allProducts.add(item.name);
          }
        });
      });
      setProducts(Array.from(allProducts).sort());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      toast({
        title: "Error",
        description: "Failed to fetch orders from store",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber.toString().includes(searchTerm)
      );
    }

    // Filter by status
    if (productFilter !== "all") {
      filtered = filtered.filter(order => 
        order.lineItems?.some((item: any) => 
          item.name?.toLowerCase().includes(productFilter.toLowerCase())
        )
      );
    }

    setFilteredOrders(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fulfilled":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "partial":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotalItems = (lineItems: Array<{quantity: number}>) => {
    if (!lineItems || lineItems.length === 0) return 0;
    return lineItems.reduce((total, item) => total + (item.quantity || 0), 0);
  };

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

  const getAddressType = (order: Order) => {
    if (order.shippingAddress) return 'Shipping Address'
    if (order.billingAddress) return 'Billing Address'
    return 'No Address'
  }

  const exportOrders = () => {
    const csvContent = [
      ["Order #", "Customer", "Status", "Amount", "Date", "Items"].join(","),
      ...filteredOrders.map(order => [
        order.orderNumber,
        order.customerName,
        order.status,
        order.amount,
        order.date,
        calculateTotalItems(order.lineItems)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${selectedStore}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    // Clear cached statuses when refreshing orders
    setOrderStatuses({});
    fetchOrders();
  };

  const clearFilters = () => {
    setSearchTerm("");
    setProductFilter("all");
  };

  // Fetch individual order status
  const fetchOrderStatus = async (orderId: string) => {
    if (!selectedStore) return;

    console.log(`🔍 Fetching status for order ID: ${orderId} from store: ${selectedStore}`);
    setLoadingStatuses(prev => ({ ...prev, [orderId]: true }));

    try {
      const response = await fetch(`/api/orders/${orderId}?shop=${selectedStore}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Successfully fetched status for order ${orderId}:`, data.order);
        setOrderStatuses(prev => ({ ...prev, [orderId]: data.order }));
        toast({
          title: "Success",
          description: `Status updated for order #${orderId}`,
        });
      } else {
        const errorData = await response.json();
        console.error(`❌ Failed to fetch status for order ${orderId}:`, errorData);
        toast({
          title: "Error",
          description: errorData.error || "Failed to fetch order status",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Error fetching order status:', error);
      toast({
        title: "Error",
        description: "Failed to fetch order status",
        variant: "destructive",
      });
    } finally {
      setLoadingStatuses(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Cancel order function
  const cancelOrder = async (orderId: string, reason: string = 'other') => {
    if (!selectedStore) return;

    setCancellingOrders(prev => ({ ...prev, [orderId]: true }));

    try {
      const response = await fetch(`/api/orders/${orderId}/cancel?shop=${selectedStore}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          restock: true,
          notifyCustomer: true
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update local order state
        setOrders(prev => prev.map(order => 
          order.id === orderId 
            ? { ...order, status: 'cancelled', cancelled: true, cancelledAt: new Date().toISOString() }
            : order
        ));

        // Update order status cache
        setOrderStatuses(prev => ({ 
          ...prev, 
          [orderId]: { 
            ...prev[orderId], 
            cancelled: true, 
            cancelledAt: new Date().toISOString(),
            displayFulfillmentStatus: 'Cancelled'
          }
        }));

        toast({
          title: "Success",
          description: "Order cancelled successfully",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to cancel order",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error canceling order:', error);
      toast({
        title: "Error",
        description: "Failed to cancel order",
        variant: "destructive",
      });
    } finally {
      setCancellingOrders(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Get status badge for fulfillment status with enhanced confirmed/cancelled logic
  const getFulfillmentStatusBadge = (order: Order, detailedStatus?: any) => {
    // If we have detailed status from API, use it
    if (detailedStatus) {
      const status = detailedStatus.fulfillmentStatus;
      const displayStatus = detailedStatus.displayFulfillmentStatus;
      const cancelled = detailedStatus.cancelled;
      const confirmed = detailedStatus.confirmed;

      // Priority: cancelled > confirmed > fulfillment status
      if (cancelled) {
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">Cancelled</Badge>;
      }

      if (confirmed) {
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Confirmed</Badge>;
      }

      // Use display status if available, otherwise fallback to status
      const finalStatus = displayStatus || status;

      switch (finalStatus?.toLowerCase()) {
        case 'confirmed':
        case 'confirmed_fulfilled':
        case 'confirmed & fulfilled':
          return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Confirmed</Badge>;
        case 'confirmed_partial':
          return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">Confirmed (Partial)</Badge>;
        case 'fulfilled':
          return <Badge className="bg-green-100 text-green-800 border-green-300">Fulfilled</Badge>;
        case 'partially_fulfilled':
        case 'partial':
          return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">Partially Fulfilled</Badge>;
        case 'unfulfilled':
        case 'pending':
          return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Unfulfilled</Badge>;
        case 'cancelled':
          return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">Cancelled</Badge>;
        case 'restocked':
          return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Restocked</Badge>;
        default:
          return <Badge variant="secondary" className="border">{finalStatus || 'Unknown'}</Badge>;
      }
    }

    // Default state - show "Refresh" badge to prompt user to check status
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => fetchOrderStatus(order.id)}
        disabled={loadingStatuses[order.id]}
        className="h-6 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
      >
        {loadingStatuses[order.id] ? (
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
        ) : (
          <RefreshCw className="h-3 w-3 mr-1" />
        )}
        {loadingStatuses[order.id] ? 'Loading...' : 'Refresh'}
      </Button>
    );
  };

  // Get status badge for financial status
  const getFinancialStatusBadge = (order: Order, detailedStatus?: any) => {
    const status = detailedStatus?.displayFinancialStatus || detailedStatus?.financialStatus || order.financialStatus;

    switch (status?.toLowerCase()) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'partially_paid':
        return <Badge className="bg-blue-100 text-blue-800">Partially Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'refunded':
        return <Badge className="bg-purple-100 text-purple-800">Refunded</Badge>;
      case 'partially_refunded':
        return <Badge className="bg-purple-100 text-purple-800">Partially Refunded</Badge>;
      case 'voided':
        return <Badge variant="destructive">Voided</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  if (layoutLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!selectedStore) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Store className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Store Selected</h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Please select a store from the sidebar to view orders.
          </p>
          <Button onClick={() => router.push('/connect-store')} className="bg-blue-600 hover:bg-blue-700">
            <Store className="mr-2 h-4 w-4" />
            Connect a Store
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store Orders</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage orders from {currentStore?.name || selectedStore}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportOrders} variant="outline" size="sm" disabled={filteredOrders.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
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
              <CardTitle className="text-sm font-medium text-gray-500">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredOrders.reduce((sum, order) => sum + calculateTotalItems(order.lineItems), 0)}
                </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Top Product</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium text-gray-900">
                {(() => {
                  const productCounts: Record<string, number> = {};
                  filteredOrders.forEach((order: Order) => {
                    order.lineItems?.forEach((item: any) => {
                      if (item.name) {
                        productCounts[item.name] = (productCounts[item.name] || 0) + (item.quantity || 1);
                      }
                    });
                  });
                  const topProduct = Object.entries(productCounts).sort(([,a], [,b]) => (b as number) - (a as number))[0];
                  return topProduct ? `${topProduct[0]} (${topProduct[1]}x)` : 'No products';
                })()}
              </div>
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
              <div></div>
              <Button variant="outline" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="text-red-600">{error}</div>
            </CardContent>
          </Card>
        )}

        {/* Orders Table */}
          <Card>
          <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Quantities</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Fulfillment Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Cancel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                        Loading orders...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      {orders.length === 0 ? 'No orders found for this store' : 'No orders match your filters'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">#{order.orderNumber || order.name}</TableCell>
                      <TableCell>
                          <div className="space-y-1">
                            {order.lineItems && order.lineItems.length > 0 ? (
                              order.lineItems.slice(0, 2).map((item: any, index: number) => (
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
                        <TableCell>
                          <div className="space-y-1">
                            {order.lineItems && order.lineItems.length > 0 ? (
                              order.lineItems.slice(0, 2).map((item: any, index: number) => (
                                <div key={index} className="text-sm font-medium">
                                  {item.quantity}x
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500">-</div>
                            )}
                            {order.lineItems && order.lineItems.length > 2 && (
                              <div className="text-xs text-gray-400">
                                {order.lineItems.slice(2).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)}x more
                          </div>
                            )}
                          </div>
                        </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.amount, order.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getFulfillmentStatusBadge(order, orderStatuses[order.id])}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchOrderStatus(order.id)}
                            disabled={loadingStatuses[order.id]}
                            className="h-6 w-6 p-0"
                          >
                            <RefreshCw className={`h-3 w-3 ${loadingStatuses[order.id] ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(order.date)}
                      </TableCell>
                      <TableCell>
                        {/* Cancel Order Button or Cancelled Indicator */}
                        {!order.cancelled && !orderStatuses[order.id]?.cancelled ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                disabled={cancellingOrders[order.id]}
                              >
                                {cancellingOrders[order.id] ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center">
                                  <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                                  Cancel Order #{order.orderNumber || order.name}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action will cancel the order and restock the items. The customer will be notified by email. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Don't Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelOrder(order.id, 'other')}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Cancel Order
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <div className="flex items-center justify-center">
                            <div className="flex items-center space-x-1 text-gray-500">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-xs font-medium">Cancelled</span>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      </div>
    </DashboardLayout>
  );
}