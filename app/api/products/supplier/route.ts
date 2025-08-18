import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { CreateProductData } from "@/lib/types/product"

export async function GET(request: Request) {
  try {
    console.log('Supplier products API called')
    
    // Get the supplier name from query parameters for backwards compatibility
    const { searchParams } = new URL(request.url)
    const supplierName = searchParams.get('supplierName')
    
    let supplierId: string
    
    // Try Supabase authentication first
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('User check:', { user: user?.email, error: userError })
    
    if (userError || !user) {
      console.log('No Supabase user found, checking supplier name parameter')
      
      if (supplierName) {
        // Use the supplier name from the request parameter (localStorage fallback)
        supplierId = supplierName
        console.log('Using supplier name from parameter:', supplierId)
      } else {
        return NextResponse.json({ error: "Authentication required - no user or supplier name provided" }, { status: 401 })
      }
    } else {
      // Get supplier data from suppliers table using user email
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('username')
        .eq('email', user.email)
        .single()

      console.log('Supplier data query:', { supplierData, error: supplierError, email: user.email })

      if (supplierError || !supplierData) {
        console.log('Supplier not found in database, checking supplier name parameter')
        
        if (supplierName) {
          // Fallback to supplier name from parameter
          supplierId = supplierName
          console.log('Using supplier name from parameter as fallback:', supplierId)
        } else {
          return NextResponse.json({ error: `Supplier not found for email: ${user.email}` }, { status: 404 })
        }
      } else {
        // Use the actual username from suppliers table
        supplierId = supplierData.username
        console.log('Found supplier ID from database:', supplierId)
      }
    }

    // Get products from Supabase
    console.log(`Fetching products for supplier: ${supplierId}`)
    
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })

    if (productsError) {
      console.error('Error fetching supplier products from Supabase:', productsError)
      return NextResponse.json({ error: "Failed to fetch supplier products" }, { status: 500 })
    }

    console.log(`Found ${products?.length || 0} products for supplier ${supplierId}`)

    return NextResponse.json({ products: products || [] })

  } catch (error) {
    console.error('Error in supplier products API:', error)
    return NextResponse.json({ 
      error: "Failed to fetch supplier products" 
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    console.log('Supplier product creation API called')
    
    const body = await request.json()
    const productData: CreateProductData = body

    // Validate required fields
    if (!productData.title || !productData.description || !productData.price) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Get the supplier name from query parameters for backwards compatibility
    const { searchParams } = new URL(request.url)
    const supplierName = searchParams.get('supplierName')
    
    let supplierId: string
    let supplierNameForProduct: string
    
    // Try Supabase authentication first
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('User check for product creation:', { user: user?.email, error: userError })
    
    if (userError || !user) {
      console.log('No Supabase user found for product creation, checking supplier name parameter')
      
      if (supplierName) {
        // Use the supplier name from the request parameter (localStorage fallback)
        supplierId = supplierName
        supplierNameForProduct = supplierName
        console.log('Using supplier name from parameter for product creation:', supplierId)
      } else {
        return NextResponse.json({ error: "Authentication required - no user or supplier name provided" }, { status: 401 })
      }
    } else {
      // Get supplier data from suppliers table using user email
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('username, name')
        .eq('email', user.email)
        .single()

      console.log('Supplier data query for product creation:', { supplierData, error: supplierError, email: user.email })

      if (supplierError || !supplierData) {
        console.log('Supplier not found in database for product creation, checking supplier name parameter')
        
        if (supplierName) {
          // Fallback to supplier name from parameter
          supplierId = supplierName
          supplierNameForProduct = supplierName
          console.log('Using supplier name from parameter as fallback for product creation:', supplierId)
        } else {
          return NextResponse.json({ error: `Supplier not found for email: ${user.email}` }, { status: 404 })
        }
      } else {
        // Use the actual data from suppliers table
        supplierId = supplierData.username
        supplierNameForProduct = supplierData.name || supplierData.username
        console.log('Found supplier data from database for product creation:', { supplierId, supplierNameForProduct })
      }
    }

    console.log('Creating product with supplier_id:', supplierId)
    
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...productData,
        supplier_id: supplierId,
        supplier_name: supplierNameForProduct,
        status: 'pending', // Changed from 'approved' to 'pending'
        images: productData.images || []
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating product:', error)
      return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
    }

    console.log('✅ Product created successfully:', data.id)
    return NextResponse.json({ product: data })

  } catch (error) {
    console.error('Error in supplier product creation API:', error)
    return NextResponse.json({ 
      error: "Failed to create product" 
    }, { status: 500 })
  }
} 