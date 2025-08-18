"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { Package, ExternalLink, CheckCircle, AlertCircle, X, Calculator, Store } from "lucide-react"
import Image from "next/image"
import DashboardLayout from "@/components/dashboard-layout"
import { ProductService } from "@/lib/product-service"
import { Product as SupplierProduct } from "@/lib/types/product"
import { useStore } from "@/contexts/store-context"

interface Product {
  id: string
  name: string
  price: number
  image: string
  images: string[] // Add full images array for Shopify push
  status: "pushed" | "not_pushed"
  description: string
}

export default function DashboardHome() {
  const { selectedStore, loading: layoutLoading, checkConnectionStatus } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pushing, setPushing] = useState<string[]>([])
  const { toast } = useToast()
  const [isConnected, setIsConnected] = useState(false)
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [sellingPrice, setSellingPrice] = useState("")
  const [margin, setMargin] = useState(0)

  // Calculate margin when selling price changes
  useEffect(() => {
    if (selectedProduct && sellingPrice) {
      const costPrice = selectedProduct.price
      const selling = parseFloat(sellingPrice)
      const calculatedMargin = Math.round(selling - costPrice)
      setMargin(calculatedMargin)
    }
  }, [sellingPrice, selectedProduct])

  const fetchProducts = useCallback(async () => {
    if (!selectedStore) return
    
    try {
      // Fetch approved products from the database
      const approvedProducts = await ProductService.getApprovedProducts()
      
      // Transform supplier products to match the Product interface
      const transformedProducts: Product[] = approvedProducts.map((supplierProduct: SupplierProduct) => ({
        id: supplierProduct.id,
        name: supplierProduct.title,
        price: supplierProduct.price,
        image: supplierProduct.images && supplierProduct.images.length > 0 
          ? supplierProduct.images[0] 
          : "/placeholder.svg?height=200&width=200",
        images: supplierProduct.images || [], // Add full images array
        status: "not_pushed" as const, // Will be updated based on Shopify sync
        description: supplierProduct.description || "No description available"
      }))

      // Check Shopify sync status using unified API
      try {
        // Try unified products API first
        let shopifyRes = await fetch(`/api/stores/products?storeUrl=${selectedStore}`)
        
        // If unified API fails, try the original API
        if (!shopifyRes.ok) {
          shopifyRes = await fetch(`/api/shopify-products?shop=${selectedStore}`)
        }
        
        if (shopifyRes.ok) {
          const shopifyData = await shopifyRes.json()
          const shopifyProductTitles = shopifyData.products.map((p: any) => p.title)
          
          console.log('Shopify product titles:', shopifyProductTitles)
          console.log('Local product names:', transformedProducts.map(p => p.name))
          
          const syncedProducts = transformedProducts.map(product => {
            const isSync = shopifyProductTitles.includes(product.name)
            console.log(`Product "${product.name}" sync status:`, isSync)
            return {
              ...product,
              status: isSync ? "pushed" as const : "not_pushed" as const
            }
          })
          
          setProducts(syncedProducts)
        } else {
          setProducts(transformedProducts)
        }
      } catch (error) {
        console.error('Error checking Shopify sync status:', error)
        setProducts(transformedProducts)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching products:', error)
      setLoading(false)
    }
  }, [selectedStore])

  useEffect(() => {
    if (selectedStore && !layoutLoading) {
      checkConnectionStatus(selectedStore).then(connected => {
        setIsConnected(connected)
        if (connected) {
          fetchProducts()
        } else {
          setLoading(false)
        }
      })
    } else if (!selectedStore && !layoutLoading) {
      setLoading(false)
      setIsConnected(false)
    }
  }, [selectedStore, layoutLoading, checkConnectionStatus, fetchProducts])

  const openPushModal = (product: Product) => {
    setSelectedProduct(product)
    setSellingPrice(Math.round(product.price * 1.5).toString()) // Default 50% markup
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedProduct(null)
    setSellingPrice("")
    setMargin(0)
  }

  const handlePushToShopify = async () => {
    if (!selectedProduct || !sellingPrice || !selectedStore) return
    
    setPushing((prev) => [...prev, selectedProduct.id])
    closeModal()
    
    const product = selectedProduct
    const shopifyProduct = {
      title: product.name,
      body_html: `<strong>${product.description}</strong>`,
      vendor: "Your App",
      product_type: "Widget",
      images: product.images.filter(img => img && !img.includes('placeholder')).map(img => ({ src: img })), // Add images for Shopify
      variants: [
        {
          price: sellingPrice,
        },
      ],
    }
    
    try {
      const res = await fetch("/api/push-to-shopify", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Supplier-Product-ID": product.id,
          "X-Product-Margin": margin.toString()
        },
        body: JSON.stringify({ product: shopifyProduct, shop: selectedStore }),
      })
      const data = await res.json()
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, status: "pushed" } : p)),
        )
        toast({
          title: "Success!",
          description: "Product pushed to Shopify successfully",
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to push product to Shopify",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to push product to Shopify",
        variant: "destructive",
      })
    } finally {
      setPushing((prev) => prev.filter((id) => id !== product.id))
    }
  }

  const handleBulkPush = async () => {
    if (selectedProducts.length === 0 || !selectedStore) return
    
    setPushing(selectedProducts)
    
    try {
      const productsToPush = products.filter(p => selectedProducts.includes(p.id))
      
      for (const product of productsToPush) {
        const shopifyProduct = {
          title: product.name,
          body_html: `<strong>${product.description}</strong>`,
          vendor: "Your App",
          product_type: "Widget",
          images: product.images.filter(img => img && !img.includes('placeholder')).map(img => ({ src: img })), // Add images for Shopify
          variants: [
            {
              price: Math.round(product.price * 1.5).toString(), // 50% markup
            },
          ],
        }
        
        const res = await fetch("/api/push-to-shopify", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Supplier-Product-ID": product.id
          },
          body: JSON.stringify({ product: shopifyProduct, shop: selectedStore }),
        })
        
        if (res.ok) {
          setProducts((prev) =>
            prev.map((p) => (p.id === product.id ? { ...p, status: "pushed" } : p)),
          )
        }
      }
      
      toast({
        title: "Success!",
        description: `${selectedProducts.length} products pushed to Shopify`,
      })
      
      setSelectedProducts([])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to push products to Shopify",
        variant: "destructive",
      })
    } finally {
      setPushing([])
    }
  }

  const handleConnectToShopify = async () => {
    window.location.href = "/connect-store"
  }

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const selectAll = () => {
    setSelectedProducts(products.map(p => p.id))
  }

  const clearSelection = () => {
    setSelectedProducts([])
  }

  // Show loading state while layout is loading
  if (layoutLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Checking store connections...</p>
        </div>
      </DashboardLayout>
    )
  }

  // Only show "No Store Connected" if no store is selected
  if (!selectedStore) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Store className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Store Connected</h2>
          <p className="text-gray-600 mb-6 max-w-md">
            You don't have any Shopify stores connected yet. Connect a store to start managing products.
          </p>
          <Button onClick={handleConnectToShopify} className="bg-blue-600 hover:bg-blue-700">
            <Store className="mr-2 h-4 w-4" />
            Connect a Store
          </Button>
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
            <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
            <p className="text-gray-600 mt-1">
              Manage and sync products to your Shopify store
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isConnected ? (
              <Button onClick={handleConnectToShopify} className="bg-blue-600 hover:bg-blue-700">
                <Store className="mr-2 h-4 w-4" />
                Connect to Shopify
              </Button>
            ) : (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="mr-1 h-3 w-3" />
                Connected to {selectedStore}
              </Badge>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedProducts.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    onClick={handleBulkPush}
                    disabled={pushing.length > 0 || !isConnected}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {pushing.length > 0 ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Pushing...
                      </>
                    ) : (
                      <>
                        <Package className="mr-2 h-4 w-4" />
                        Push to Shopify
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-t-lg" />
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Available</h3>
              <p className="text-gray-600 mb-4">
                No approved products are available to sync to your Shopify store.
              </p>
              <Button variant="outline" onClick={() => window.location.href = '/supplier'}>
                <Package className="mr-2 h-4 w-4" />
                View Supplier Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="group hover:shadow-lg transition-shadow">
                <div className="relative">
                  <div className="aspect-square overflow-hidden rounded-t-lg">
                    <Image
                      src={product.image}
                      alt={product.name}
                      width={300}
                      height={300}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={() => toggleProductSelection(product.id)}
                      className="bg-white/90"
                    />
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant={product.status === "pushed" ? "secondary" : "outline"}
                      className={product.status === "pushed" ? "bg-green-100 text-green-800" : ""}
                    >
                      {product.status === "pushed" ? (
                        <>
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Synced
                        </>
                      ) : (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Not Synced
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">₹{product.price}</span>
                    <div className="flex items-center gap-1">
                      {product.status !== "pushed" && (
                        <Button
                          onClick={() => openPushModal(product)}
                          disabled={pushing.includes(product.id) || !isConnected}
                          size="sm"
                          className="h-8 px-2 bg-blue-600 hover:bg-blue-700"
                        >
                          {pushing.includes(product.id) ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                          ) : (
                            <>
                              <Package className="h-3 w-3 mr-1" />
                              Push
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}


      </div>

      {/* Push to Shopify Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Push to Shopify
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden">
                  <Image
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedProduct.name}</h3>
                  <p className="text-sm text-gray-600">Cost Price: ₹{selectedProduct.price}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Selling Price</label>
                  <Input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="Enter selling price"
                    className="mt-1"
                  />
                </div>
                
                {margin !== 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Profit Margin:</span>
                      <span className={`font-semibold ${margin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{margin}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handlePushToShopify}
                  disabled={!sellingPrice || parseFloat(sellingPrice) <= 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Push to Shopify
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
