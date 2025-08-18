import { NextResponse } from "next/server";
import { TokenManager } from "@/lib/token-manager";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { product, shop } = await request.json();
    if (!product || !shop) {
      return NextResponse.json({ error: "Missing shop or product data" }, { status: 400 });
    }
    // Validate required fields
    if (!product.title || !product.variants || !Array.isArray(product.variants) || !product.variants[0]?.price) {
      return NextResponse.json({ error: "Product must have a title and at least one variant with a price" }, { status: 400 });
    }

    // Get supplier product ID and margin from headers
    const supplierProductId = request.headers.get('X-Supplier-Product-ID');
    const margin = request.headers.get('X-Product-Margin');
    console.log('Supplier Product ID from headers:', supplierProductId);
    console.log('Product margin from headers:', margin);

    let headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // First try to get direct API credentials
    const { data: storeConfig } = await supabase
      .from('store_configs')
      .select('*')
      .eq('store_url', shop)
      .eq('is_active', true)
      .single();

    if (storeConfig) {
      // Use direct API credentials
      if (storeConfig.access_token) {
        headers['X-Shopify-Access-Token'] = storeConfig.access_token;
      } else if (storeConfig.api_key && storeConfig.api_secret) {
        const credentials = Buffer.from(`${storeConfig.api_key}:${storeConfig.api_secret}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      } else {
        return NextResponse.json({ error: "No valid credentials found for direct API store" }, { status: 401 });
      }
    } else {
      // Fallback to OAuth token
      const accessToken = await TokenManager.getToken(shop);
      if (!accessToken) {
        return NextResponse.json({ error: "Missing access token. Please connect to Shopify first." }, { status: 401 });
      }
      headers['X-Shopify-Access-Token'] = accessToken;
    }

    // Log what we're sending to Shopify
    console.log(`Pushing product to ${shop}:`, JSON.stringify(product, null, 2));

    // Call Shopify API
    const response = await fetch(`https://${shop}/admin/api/2023-10/products.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({ product }),
    });
    const data = await response.json();
    
    console.log(`Push response status: ${response.status}`);
    console.log(`Shopify response:`, JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error("Shopify API error:", data);
      return NextResponse.json({ error: data.errors || data || "Shopify error" }, { status: response.status });
    }
    
    console.log(`Successfully pushed product: "${data.product?.title}" with ID: ${data.product?.id}`);
    
    // Store the product-margin mapping for future orders
    if (data.product && data.product.id && supplierProductId && margin) {
      try {
        const marginAmount = parseFloat(margin);
        
        console.log(`[Push to Shopify] Storing product mapping for future orders:`, {
          supplier_product_id: supplierProductId,
          shopify_product_id: data.product.id.toString(),
          shopify_store_url: shop,
          product_name: data.product.title || product.title || '',
          margin: marginAmount
        });
        
        // Store in both old and new systems for compatibility
        const { error: mappingError } = await supabase
          .from('product_margins')
          .upsert({
            shopify_product_id: data.product.id.toString(),
            shopify_store_url: shop,
            product_name: data.product.title || product.title || '',
            margin_per_unit: marginAmount,
            supplier_product_id: supplierProductId
          }, {
            onConflict: 'shopify_product_id,shopify_store_url'
          });
        
        // Also store in new wallet system
        const { error: newMappingError } = await supabase
          .from('store_product_margins')
          .upsert({
            shopify_product_id: data.product.id.toString(),
            product_name: data.product.title || product.title || '',
            margin_per_unit: marginAmount,
            store_url: shop,
            supplier_product_id: supplierProductId
          }, {
            onConflict: 'shopify_product_id,store_url'
          });
        
        if (mappingError) {
          console.error('[Push to Shopify] Error storing product mapping:', mappingError);
        } else {
          console.log(`[Push to Shopify] Product mapping stored successfully - margin ₹${marginAmount} will be used for future orders containing "${data.product.title}"`);
        }
      } catch (mappingError) {
        console.error('[Push to Shopify] Error in mapping storage:', mappingError);
      }
    } else {
      console.log('[Push to Shopify] No mapping stored - missing data:', {
        hasProduct: !!data.product,
        hasProductId: !!data.product?.id,
        hasSupplierProductId: !!supplierProductId,
        hasMargin: !!margin
      });
    }
    
    return NextResponse.json({ success: true, product: data.product });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error", details: error }, { status: 500 });
  }
}
