export interface Product {
  id: string
  title: string
  description: string | null
  price: number
  images: string[]
  supplier_id: string
  supplier_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface CreateProductData {
  title: string
  description: string
  price: number
  images?: string[]
}

export interface UpdateProductData {
  title?: string
  description?: string
  price?: number
  images?: string[]
  status?: 'pending' | 'approved' | 'rejected'
} 