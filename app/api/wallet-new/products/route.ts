import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch all products with margins for a store
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeUrl = searchParams.get('store')
    
    if (!storeUrl) {
      return NextResponse.json({
        success: false,
        error: 'Store URL is required'
      }, { status: 400 })
    }

    // Fetch all products with margins from the new table
    const { data: products, error } = await supabase
      .from('store_product_margins')
      .select('*')
      .eq('store_url', storeUrl)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: products || []
    })

  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update product margin
export async function PUT(request: Request) {
  try {
    const { productId, margin, storeUrl } = await request.json()

    if (!productId || margin === undefined || !storeUrl) {
      return NextResponse.json({
        success: false,
        error: 'Product ID, margin, and store URL are required'
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('store_product_margins')
      .update({ 
        margin_per_unit: margin,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .eq('store_url', storeUrl)

    if (error) {
      throw new Error(`Failed to update margin: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Margin updated successfully'
    })

  } catch (error) {
    console.error('Error updating margin:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Add a new product margin (for when products are pushed to store)
export async function POST(request: Request) {
  try {
    const { shopifyProductId, productName, margin, storeUrl, supplierProductId } = await request.json()

    if (!shopifyProductId || !productName || margin === undefined || !storeUrl) {
      return NextResponse.json({
        success: false,
        error: 'All fields are required'
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('store_product_margins')
      .upsert({
        shopify_product_id: shopifyProductId,
        product_name: productName,
        margin_per_unit: margin,
        store_url: storeUrl,
        supplier_product_id: supplierProductId
      }, {
        onConflict: 'shopify_product_id,store_url'
      })

    if (error) {
      throw new Error(`Failed to add product margin: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Product margin added successfully'
    })

  } catch (error) {
    console.error('Error adding product margin:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
