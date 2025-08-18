import { supabase } from './supabase'
import { Product, CreateProductData, UpdateProductData } from './types/product'

export class ProductService {
  // Get all approved products (for sellers)
  static async getApprovedProducts(): Promise<Product[]> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching approved products:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getApprovedProducts:', error)
      return []
    }
  }

  // Get all pending products (for admin approval)
  static async getPendingProducts(): Promise<Product[]> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching pending products:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getPendingProducts:', error)
      return []
    }
  }

  // Get all products (for admin)
  static async getAllProducts(): Promise<Product[]> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching all products:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getAllProducts:', error)
      return []
    }
  }

  // Get products for current supplier
  static async getSupplierProducts(): Promise<Product[]> {
    try {
      console.log('🔍 PRODUCT SERVICE - Getting supplier products...')
      
      // Try to get supplier ID with multiple fallbacks
      let supplierId: string | null = null
      
      // Method 1: Try Supabase auth first
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (!userError && user) {
          console.log('✅ PRODUCT SERVICE - Found authenticated user:', user.email)
          
          // Get supplier data from suppliers table using user email
          const { data: supplierData, error: supplierError } = await supabase
            .from('suppliers')
            .select('username')
            .eq('email', user.email)
            .single()

          if (!supplierError && supplierData) {
            supplierId = supplierData.username
            console.log('✅ PRODUCT SERVICE - Found supplier ID from DB:', supplierId)
          }
        }
      } catch (error) {
        console.log('⚠️ PRODUCT SERVICE - Supabase auth failed, trying session refresh...')
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshData.user) {
            console.log('✅ PRODUCT SERVICE - Session refreshed successfully')
            
            // Get supplier data from suppliers table using user email
            const { data: supplierData, error: supplierError } = await supabase
              .from('suppliers')
              .select('username')
              .eq('email', refreshData.user.email)
              .single()

            if (!supplierError && supplierData) {
              supplierId = supplierData.username
              console.log('✅ PRODUCT SERVICE - Found supplier ID after refresh:', supplierId)
            }
          }
        } catch (refreshErr) {
          console.log('❌ PRODUCT SERVICE - Session refresh also failed')
        }
      }
      
      // Method 2: Fallback to localStorage
      if (!supplierId) {
        const supplierName = localStorage.getItem('supplierName')
        if (supplierName) {
          supplierId = supplierName
          console.log('📦 PRODUCT SERVICE - Using localStorage fallback:', supplierId)
        }
      }
      
      // Method 3: Try to get from session token
      if (!supplierId) {
        try {
          const sessionToken = document.cookie.split('; ').find(row => row.startsWith('session_token='))?.split('=')[1]
          if (sessionToken) {
            const response = await fetch('/api/auth/verify-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionToken })
            })
            
            if (response.ok) {
              const data = await response.json()
              if (data.success && data.user) {
                supplierId = data.user.username
                console.log('🔐 PRODUCT SERVICE - Found supplier ID from session:', supplierId)
              }
            }
          }
        } catch (error) {
          console.log('❌ PRODUCT SERVICE - Session verification failed')
        }
      }
      
      if (!supplierId) {
        console.log('❌ PRODUCT SERVICE - No supplier ID found, returning empty array')
        return []
      }

      console.log('📦 PRODUCT SERVICE - Querying products for supplier_id:', supplierId)
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })

      console.log('📊 PRODUCT SERVICE - Query result:', { 
        error: error?.message,
        productCount: data?.length || 0,
        products: data?.map(p => ({ id: p.id, title: p.title, supplier_id: p.supplier_id, status: p.status })) || []
      })

      if (error) {
        console.error('❌ Error fetching supplier products:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getSupplierProducts:', error)
      return []
    }
  }

  // Create a new product (now defaults to pending status)
  static async createProduct(productData: CreateProductData): Promise<Product | null> {
    try {
      // Get supplier ID with multiple fallbacks
      let supplierId: string | null = null
      let supplierName: string | null = null
      
      // Method 1: Try Supabase auth first
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (!userError && user) {
          console.log('✅ PRODUCT SERVICE - Creating product with authenticated user:', user.email)
          
          // Get supplier data from suppliers table using user email
          const { data: supplierData, error: supplierError } = await supabase
            .from('suppliers')
            .select('username, name')
            .eq('email', user.email)
            .single()

          if (!supplierError && supplierData) {
            supplierId = supplierData.username
            supplierName = supplierData.name || supplierData.username
            console.log('✅ PRODUCT SERVICE - Found supplier data from DB:', { supplierId, supplierName })
          }
        }
      } catch (error) {
        console.log('⚠️ PRODUCT SERVICE - Supabase auth failed during product creation')
      }
      
      // Method 2: Fallback to localStorage
      if (!supplierId) {
        const supplierNameFromStorage = localStorage.getItem('supplierName')
        if (supplierNameFromStorage) {
          supplierId = supplierNameFromStorage
          supplierName = supplierNameFromStorage
          console.log('📦 PRODUCT SERVICE - Using localStorage fallback for product creation:', supplierId)
        }
      }
      
      // Method 3: Try session token
      if (!supplierId) {
        try {
          const sessionToken = document.cookie.split('; ').find(row => row.startsWith('session_token='))?.split('=')[1]
          if (sessionToken) {
            const response = await fetch('/api/auth/verify-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionToken })
            })
            
            if (response.ok) {
              const data = await response.json()
              if (data.success && data.user) {
                supplierId = data.user.username
                supplierName = data.user.name || data.user.username
                console.log('🔐 PRODUCT SERVICE - Found supplier from session for product creation:', supplierId)
              }
            }
          }
        } catch (error) {
          console.log('❌ PRODUCT SERVICE - Session verification failed during product creation')
        }
      }
      
      if (!supplierId) {
        console.error('❌ PRODUCT SERVICE - No supplier ID found for product creation')
        return null
      }

      console.log('📦 PRODUCT SERVICE - Creating product with supplier_id:', supplierId)
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...productData,
          supplier_id: supplierId,
          supplier_name: supplierName,
          status: 'pending', // Changed from 'approved' to 'pending'
          images: productData.images || []
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating product:', error)
        return null
      }

      console.log('✅ PRODUCT SERVICE - Product created successfully:', data.id)
      return data
    } catch (error) {
      console.error('Error in createProduct:', error)
      return null
    }
  }

  // Approve a product (admin only)
  static async approveProduct(productId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)

      if (error) {
        console.error('Error approving product:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in approveProduct:', error)
      return false
    }
  }

  // Reject a product (admin only)
  static async rejectProduct(productId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)

      if (error) {
        console.error('Error rejecting product:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in rejectProduct:', error)
      return false
    }
  }

  // Update a product
  static async updateProduct(productId: string, updateData: UpdateProductData): Promise<Product | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .eq('supplier_id', user.id) // Ensure user owns the product
        .select()
        .single()

      if (error) {
        console.error('Error updating product:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in updateProduct:', error)
      return null
    }
  }

  // Delete a product
  static async deleteProduct(productId: string): Promise<boolean> {
    try {
      const supplierName = localStorage.getItem('supplierName') || 'Unknown Supplier'
      const supplierId = supplierName // Use name as ID for simplicity

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('supplier_id', supplierId) // Ensure supplier owns the product

      if (error) {
        console.error('Error deleting product:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in deleteProduct:', error)
      return false
    }
  }

  // Get a single product by ID
  static async getProductById(productId: string): Promise<Product | null> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error) {
        console.error('Error fetching product:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getProductById:', error)
      return null
    }
  }

  // Upload image to Supabase Storage
  static async uploadImage(file: File): Promise<string | null> {
    try {
      // Get supplier name with fallback
      let supplierName = 'unknown'
      
      // Try to get from localStorage first (most reliable fallback)
      const supplierNameFromStorage = localStorage.getItem('supplierName')
      if (supplierNameFromStorage) {
        supplierName = supplierNameFromStorage
      } else {
        // Try Supabase auth as fallback
        try {
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          if (!userError && user) {
            const { data: supplierData, error: supplierError } = await supabase
              .from('suppliers')
              .select('username')
              .eq('email', user.email)
              .single()
            
            if (!supplierError && supplierData) {
              supplierName = supplierData.username
            }
          }
        } catch (error) {
          console.log('⚠️ Upload image - Supabase auth failed, using default supplier name')
        }
      }
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${supplierName}/${Date.now()}.${fileExt}`

      console.log('📤 Uploading image:', fileName)

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file)

      if (error) {
        console.error('Error uploading image:', error)
        return null
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      console.log('✅ Image uploaded successfully:', urlData.publicUrl)
      return urlData.publicUrl
    } catch (error) {
      console.error('Error in uploadImage:', error)
      return null
    }
  }
} 