import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Supplier product deletion API called for product:', params.id)
    
    // Get the supplier name from query parameters for backwards compatibility
    const { searchParams } = new URL(request.url)
    const supplierName = searchParams.get('supplierName')
    
    let supplierId: string
    
    // Try Supabase authentication first
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('User check for product deletion:', { user: user?.email, error: userError })
    
    if (userError || !user) {
      console.log('No Supabase user found for product deletion, checking supplier name parameter')
      
      if (supplierName) {
        // Use the supplier name from the request parameter (localStorage fallback)
        supplierId = supplierName
        console.log('Using supplier name from parameter for product deletion:', supplierId)
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

      console.log('Supplier data query for product deletion:', { supplierData, error: supplierError, email: user.email })

      if (supplierError || !supplierData) {
        console.log('Supplier not found in database for product deletion, checking supplier name parameter')
        
        if (supplierName) {
          // Fallback to supplier name from parameter
          supplierId = supplierName
          console.log('Using supplier name from parameter as fallback for product deletion:', supplierId)
        } else {
          return NextResponse.json({ error: `Supplier not found for email: ${user.email}` }, { status: 404 })
        }
      } else {
        // Use the actual username from suppliers table
        supplierId = supplierData.username
        console.log('Found supplier ID from database for product deletion:', supplierId)
      }
    }

    console.log('Deleting product with supplier_id:', supplierId, 'product_id:', params.id)
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', params.id)
      .eq('supplier_id', supplierId) // Ensure supplier owns the product

    if (error) {
      console.error('Error deleting product:', error)
      return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
    }

    console.log('✅ Product deleted successfully:', params.id)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in supplier product deletion API:', error)
    return NextResponse.json({ 
      error: "Failed to delete product" 
    }, { status: 500 })
  }
} 