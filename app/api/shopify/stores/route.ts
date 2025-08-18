import { NextResponse } from "next/server"
import { TokenManager } from "@/lib/token-manager"
import { AuthService } from '@/lib/auth-service'

export async function GET(request: Request) {
  try {
    // Get session token from cookies
    const cookies = request.headers.get('cookie')
    const sessionToken = cookies?.split('; ')
      .find(row => row.startsWith('session_token='))?.split('=')[1];

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify session and get user info
    const sessionResult = await AuthService.verifySession(sessionToken);
    if (!sessionResult.success || !sessionResult.user || sessionResult.user.userType !== 'seller') {
      return NextResponse.json({ error: 'Seller authentication required' }, { status: 401 });
    }

    // Get stores for this user only
    const stores = await TokenManager.getUserStores(sessionResult.user.username)
    
    // Validate each store's token by making a simple API call
    const validatedStores = []
    
    for (const store of stores) {
      try {
        const token = await TokenManager.getToken(store.shop)
        if (token) {
          // Test the token with a simple API call
          const testResponse = await fetch(`https://${store.shop}/admin/api/2023-10/shop.json`, {
            headers: {
              'X-Shopify-Access-Token': token,
              'Content-Type': 'application/json'
            }
          })
          
          if (testResponse.ok) {
            validatedStores.push({
              shop: store.shop,
              connectedAt: store.created_at,
              lastUpdated: store.updated_at,
              isValid: true
            })
          } else {
            console.warn(`Token invalid for ${store.shop}, status: ${testResponse.status}`)
            // Keep the store but mark as invalid
            validatedStores.push({
              shop: store.shop,
              connectedAt: store.created_at,
              lastUpdated: store.updated_at,
              isValid: false
            })
          }
        } else {
          console.warn(`No token found for ${store.shop}`)
          validatedStores.push({
            shop: store.shop,
            connectedAt: store.created_at,
            lastUpdated: store.updated_at,
            isValid: false
          })
        }
      } catch (error) {
        console.error(`Error validating ${store.shop}:`, error)
        validatedStores.push({
          shop: store.shop,
          connectedAt: store.created_at,
          lastUpdated: store.updated_at,
          isValid: false
        })
      }
    }
    
    return NextResponse.json({ 
      stores: validatedStores
    })
  } catch (error) {
    console.error('Failed to fetch stores:', error)
    return NextResponse.json({ 
      error: "Failed to fetch connected stores",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const shop = searchParams.get('shop')
    
    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 })
    }

    const success = await TokenManager.removeToken(shop)
    
    if (!success) {
      return NextResponse.json({ error: "Failed to disconnect store" }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Store ${shop} disconnected successfully`
    })
  } catch (error) {
    console.error('Failed to disconnect store:', error)
    return NextResponse.json({ 
      error: "Failed to disconnect store",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 