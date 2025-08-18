import { NextRequest, NextResponse } from 'next/server'
import { isTestMode } from '@/lib/test-mode'

// Lightweight debug endpoint used by tests to validate availability
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku') || 'TEST-SKU-001'
    const store = searchParams.get('store') || 'teast32123.myshopify.com'

    // In real systems we would query inventory table. For tests, return static data
    const quantity = isTestMode() ? 42 : 0

    return NextResponse.json({
      sku,
      store,
      quantity,
      lastUpdated: new Date().toISOString(),
      source: isTestMode() ? 'test-stub' : 'database',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

 