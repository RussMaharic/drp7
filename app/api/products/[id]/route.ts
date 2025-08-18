import { NextResponse } from "next/server"
import { ProductService } from "@/lib/product-service"
import { UpdateProductData } from "@/lib/types/product"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const product = await ProductService.getProductById(params.id)
    
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const updateData: UpdateProductData = body

    const product = await ProductService.updateProduct(params.id, updateData)
    
    if (!product) {
      return NextResponse.json(
        { error: "Product not found or update failed" },
        { status: 404 }
      )
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const success = await ProductService.deleteProduct(params.id)
    
    if (!success) {
      return NextResponse.json(
        { error: "Product not found or delete failed" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    )
  }
} 