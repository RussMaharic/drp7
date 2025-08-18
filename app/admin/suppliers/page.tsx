"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { Search, User, RefreshCw, Package, Eye, Calendar } from "lucide-react"
import { ProductService } from "@/lib/product-service"
import { Product } from "@/lib/types/product"

interface SupplierInfo {
  supplier_id: string
  supplier_name: string
  totalProducts: number
  approvedProducts: number
  pendingProducts: number
  rejectedProducts: number
  firstProductDate: string
  lastProductDate: string
  products: Product[]
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<SupplierInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierInfo | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    filterSuppliers()
  }, [suppliers, searchTerm])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      
      // Get all products
      const allProducts = await ProductService.getAllProducts()
      
      // Group products by supplier
      const supplierMap = new Map<string, Product[]>()
      
      allProducts.forEach(product => {
        const supplierId = product.supplier_id
        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, [])
        }
        supplierMap.get(supplierId)!.push(product)
      })
      
      // Create supplier info objects
      const supplierList: SupplierInfo[] = Array.from(supplierMap.entries()).map(([supplierId, products]) => {
        const approvedProducts = products.filter(p => p.status === 'approved').length
        const pendingProducts = products.filter(p => p.status === 'pending').length
        const rejectedProducts = products.filter(p => p.status === 'rejected').length
        
        // Sort products by date to find first and last
        const sortedProducts = products.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        
        return {
          supplier_id: supplierId,
          supplier_name: products[0]?.supplier_name || supplierId,
          totalProducts: products.length,
          approvedProducts,
          pendingProducts,
          rejectedProducts,
          firstProductDate: sortedProducts[0]?.created_at || '',
          lastProductDate: sortedProducts[sortedProducts.length - 1]?.created_at || '',
          products: products
        }
      })
      
      // Sort suppliers by total products (descending)
      supplierList.sort((a, b) => b.totalProducts - a.totalProducts)
      
      setSuppliers(supplierList)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast({
        title: "Error",
        description: "Failed to fetch supplier information.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterSuppliers = () => {
    let filtered = suppliers

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.supplier_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredSuppliers(filtered)
  }

  const viewSupplierDetails = (supplier: SupplierInfo) => {
    setSelectedSupplier(supplier)
    setIsDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSupplierStatus = (supplier: SupplierInfo) => {
    if (supplier.pendingProducts > 0) {
      return { status: 'pending', color: 'bg-yellow-100 text-yellow-800' }
    } else if (supplier.approvedProducts > 0) {
      return { status: 'active', color: 'bg-green-100 text-green-800' }
    } else {
      return { status: 'inactive', color: 'bg-gray-100 text-gray-800' }
    }
  }

  const totalSuppliers = suppliers.length
  const activeSuppliers = suppliers.filter(s => s.approvedProducts > 0).length
  const totalProducts = suppliers.reduce((sum, s) => sum + s.totalProducts, 0)
  const pendingProducts = suppliers.reduce((sum, s) => sum + s.pendingProducts, 0)

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Suppliers</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage supplier accounts and their products
          </p>
        </div>
        <Button onClick={fetchSuppliers} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSuppliers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeSuppliers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingProducts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Products</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No suppliers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => {
                  const status = getSupplierStatus(supplier)
                  return (
                    <TableRow key={supplier.supplier_id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-purple-600" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">{supplier.supplier_name}</div>
                            <div className="text-sm text-gray-500 font-mono">
                              {supplier.supplier_id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          {status.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="font-medium">{supplier.totalProducts}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600 font-medium">{supplier.approvedProducts}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-yellow-600 font-medium">{supplier.pendingProducts}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-red-600 font-medium">{supplier.rejectedProducts}</span>
                      </TableCell>
                      <TableCell>{formatDate(supplier.firstProductDate)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewSupplierDetails(supplier)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Supplier Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Supplier Details</DialogTitle>
            <DialogDescription>
              Complete information about the supplier and their products
            </DialogDescription>
          </DialogHeader>
          
          {selectedSupplier && (
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-16 w-16 rounded-lg bg-purple-100 flex items-center justify-center">
                    <User className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{selectedSupplier.supplier_name}</h3>
                  <p className="text-gray-600 mt-1 font-mono text-sm">{selectedSupplier.supplier_id}</p>
                  <div className="flex items-center mt-2">
                    <Badge className={getSupplierStatus(selectedSupplier).color}>
                      {getSupplierStatus(selectedSupplier).status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-500">Total Products</span>
                    <p className="font-medium text-lg">{selectedSupplier.totalProducts}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Approved Products</span>
                    <p className="font-medium text-lg text-green-600">{selectedSupplier.approvedProducts}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">First Product</span>
                    <p className="font-medium">{formatDate(selectedSupplier.firstProductDate)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-500">Pending Products</span>
                    <p className="font-medium text-lg text-yellow-600">{selectedSupplier.pendingProducts}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Rejected Products</span>
                    <p className="font-medium text-lg text-red-600">{selectedSupplier.rejectedProducts}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Latest Product</span>
                    <p className="font-medium">{formatDate(selectedSupplier.lastProductDate)}</p>
                  </div>
                </div>
              </div>

              {/* Recent Products */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">Recent Products</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSupplier.products.slice(0, 5).map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.title}</TableCell>
                          <TableCell>
                            <Badge className={
                              product.status === 'approved' ? 'bg-green-100 text-green-800' :
                              product.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {product.status}
                            </Badge>
                          </TableCell>
                                                           <TableCell>₹{product.price}</TableCell>
                          <TableCell>{formatDate(product.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {selectedSupplier.products.length > 5 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Showing 5 of {selectedSupplier.products.length} products
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 