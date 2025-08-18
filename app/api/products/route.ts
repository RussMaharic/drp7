import { NextResponse } from "next/server"
import { ProductService } from "@/lib/product-service"
import { CreateProductData } from "@/lib/types/product"

export async function GET() {
  try {
    const products = await ProductService.getApprovedProducts()
    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const productData: CreateProductData = body

    // Validate required fields
    if (!productData.title || !productData.description || !productData.price) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const product = await ProductService.createProduct(productData)
    
    if (!product) {
      return NextResponse.json(
        { error: "Failed to create product" },
        { status: 500 }
      )
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    )
  }
}
