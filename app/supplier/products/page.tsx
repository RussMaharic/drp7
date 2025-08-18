"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Package, Search, Edit, Trash2, Eye, Calendar } from "lucide-react"
import { ProductService } from "@/lib/product-service"
import { Product } from "@/lib/types/product"
import { supabase } from "@/lib/supabase"

export default function MyProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const { toast } = useToast()

  useEffect(() => {
    // Debug: Check current user
    console.log('🔍 PRODUCTS PAGE - Checking current user...')
    checkCurrentUser()
    fetchProducts()
  }, [])

  const checkCurrentUser = async () => {
    try {
      console.log('🔍 PRODUCTS PAGE - Full localStorage debug:')
      console.log('💾 All localStorage keys:', Object.keys(localStorage))
      console.log('💾 localStorage supplierName:', localStorage.getItem('supplierName'))
      console.log('💾 localStorage supplierEmail:', localStorage.getItem('supplierEmail'))
      console.log('💾 localStorage lastUserEmail:', localStorage.getItem('lastUserEmail'))
      console.log('💾 localStorage supabase auth keys:', Object.keys(localStorage).filter(key => key.includes('supabase')))
      
      const { data: { user }, error } = await supabase.auth.getUser()
      console.log('🔐 Current authenticated user:', user?.email)
      console.log('📧 User metadata:', user?.user_metadata)
      console.log('❌ Auth error:', error?.message)
      
      if (user) {
        // Check supplier record in database
        const { data: supplierData, error: supplierError } = await supabase
          .from('suppliers')
          .select('username, name, email')
          .eq('email', user.email)
          .single()
        
        console.log('👤 Supplier record in DB:', { supplierData, error: supplierError })
      } else {
        console.log('🔄 No authenticated user, checking if localStorage has data...')
        const supplierName = localStorage.getItem('supplierName')
        if (supplierName) {
          console.log('✅ Found localStorage supplier, this should work for product fetching')
        } else {
          console.log('❌ No localStorage supplier data either')
        }
      }
    } catch (error) {
      console.error('❌ Error checking user:', error)
    }
  }

              const fetchProducts = async () => {
                try {
                  setLoading(true)
                  
                  // Get supplier name from localStorage for backwards compatibility
                  const supplierName = localStorage.getItem('supplierName')
                  console.log('Supplier name from localStorage:', supplierName)
                  
                  // Build URL with supplier name parameter for backwards compatibility
                  let url = '/api/products/supplier'
                  const params = new URLSearchParams()
                  
                  if (supplierName) {
                    params.append('supplierName', supplierName)
                  }
                  
                  if (params.toString()) {
                    url += `?${params.toString()}`
                  }
                  
                  console.log('Fetching products from:', url)
                  
                  const response = await fetch(url)
                  const data = await response.json()

                  console.log('API Response:', { status: response.status, data })

                  if (response.ok) {
                    setProducts(data.products || [])
                    console.log('Products set:', data.products)
                    if (data.products && data.products.length > 0) {
                      toast({
                        title: "Products Loaded",
                        description: `Found ${data.products.length} products`,
                      })
                    } else {
                      console.log('No products found')
                      toast({
                        title: "No Products Found",
                        description: "You haven't submitted any products yet.",
                      })
                    }
                  } else {
                    console.error('API Error:', data)
                    throw new Error(data.error || 'Failed to fetch products')
                  }
                } catch (error) {
                  console.error('Error fetching products:', error)
                  toast({
                    title: "Error",
                    description: `Failed to fetch products: ${error.message}`,
                    variant: "destructive",
                  })
                } finally {
                  setLoading(false)
                }
              }

              const handleDeleteProduct = async (productId: string) => {
                if (!confirm("Are you sure you want to delete this product?")) return

                try {
                  // Get supplier name from localStorage for backwards compatibility
                  const supplierName = localStorage.getItem('supplierName')
                  console.log('Supplier name from localStorage for delete:', supplierName)
                  
                  // Build URL with supplier name parameter for backwards compatibility
                  let url = `/api/products/supplier/${productId}`
                  const params = new URLSearchParams()
                  
                  if (supplierName) {
                    params.append('supplierName', supplierName)
                  }
                  
                  if (params.toString()) {
                    url += `?${params.toString()}`
                  }
                  
                  const response = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                    }
                  })
                  
                  const data = await response.json()

                  if (response.ok && data.success) {
                    toast({
                      title: "Product Deleted Successfully!",
                      description: "Product has been successfully deleted",
                    })
                    fetchProducts() // Refresh the list
                  } else {
                    throw new Error(data.error || "Failed to delete product")
                  }
                } catch (error) {
                  console.error('Error deleting product:', error)
                  toast({
                    title: "Delete Failed",
                    description: "Failed to delete product. Please try again.",
                    variant: "destructive",
                  })
                }
              }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Rejected</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === "all" || product.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const getStatusCounts = () => {
    return {
      all: products.length,
      pending: products.filter(p => p.status === 'pending').length,
      approved: products.filter(p => p.status === 'approved').length,
      rejected: products.filter(p => p.status === 'rejected').length,
    }
  }

  const statusCounts = getStatusCounts()

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Products</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your product listings</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Products</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your product listings</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Products</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{statusCounts.all}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 dark:text-yellow-300 text-sm font-bold">P</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.approved}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <span className="text-green-600 dark:text-green-300 text-sm font-bold">A</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{statusCounts.rejected}</p>
              </div>
              <div className="h-8 w-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <span className="text-red-600 dark:text-red-300 text-sm font-bold">R</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                onClick={() => setFilterStatus("all")}
                size="sm"
              >
                All ({statusCounts.all})
              </Button>
              <Button
                variant={filterStatus === "pending" ? "default" : "outline"}
                onClick={() => setFilterStatus("pending")}
                size="sm"
              >
                Pending ({statusCounts.pending})
              </Button>
              <Button
                variant={filterStatus === "approved" ? "default" : "outline"}
                onClick={() => setFilterStatus("approved")}
                size="sm"
              >
                Approved ({statusCounts.approved})
              </Button>
              <Button
                variant={filterStatus === "rejected" ? "default" : "outline"}
                onClick={() => setFilterStatus("rejected")}
                size="sm"
              >
                Rejected ({statusCounts.rejected})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No products found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || filterStatus !== "all" 
                ? "Try adjusting your search or filters"
                : "You haven't submitted any products yet. Start by listing your first product!"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              {/* Product Image */}
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                
                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(product.status)}
                </div>
              </div>

              <CardContent className="p-4">
                {/* Product Info */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                      {product.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                      {product.description}
                    </p>
                  </div>

                  {/* Price and Date */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      ₹{product.price.toFixed(2)}
                    </div>
                    <div className="flex items-center text-gray-500 dark:text-gray-400">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(product.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
} 