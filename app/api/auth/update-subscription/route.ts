import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, subscriptionAmount, paymentStatus, paymentOrderId } = body

    // Validate required fields
    if (!accountId || !subscriptionAmount) {
      return NextResponse.json(
        { success: false, error: 'Account ID and subscription amount are required' },
        { status: 400 }
      )
    }

    // Validate amount
    const allowedAmounts = [25000, 50000, 75000]
    if (!allowedAmounts.includes(Number(subscriptionAmount))) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription amount' },
        { status: 400 }
      )
    }

    // Update seller account with subscription details
    const updateData = {
      subscription_amount: Number(subscriptionAmount),
      payment_status: paymentStatus || 'pending',
      payment_date: new Date().toISOString(),
      ...(paymentOrderId && { payment_order_id: paymentOrderId })
    }

    const { data: updatedSeller, error: updateError } = await supabase
      .from('sellers')
      .update(updateData)
      .eq('id', accountId)
      .select()

    if (updateError) {
      console.error('Error updating seller subscription:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update subscription' },
        { status: 500 }
      )
    }

    if (!updatedSeller || updatedSeller.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Seller account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully',
      seller: updatedSeller[0]
    })

  } catch (error) {
    console.error('Update subscription API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
