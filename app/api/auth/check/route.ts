import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/auth-service'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Auth check API called')
    
    const results = {
      supabase: { hasUser: false, email: null, error: null },
      session: { hasSession: false, user: null, error: null },
      localStorage: { supplierName: null }
    }
    
    // Check Supabase auth
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      results.supabase = {
        hasUser: !!user,
        email: user?.email || null,
        error: error?.message || null
      }
    } catch (error) {
      results.supabase.error = error.message
    }
    
    // Check session token
    try {
      const sessionToken = request.cookies.get('session_token')?.value
      if (sessionToken) {
        const result = await AuthService.verifySession(sessionToken)
        results.session = {
          hasSession: result.success,
          user: result.user || null,
          error: result.error || null
        }
      }
    } catch (error) {
      results.session.error = error.message
    }
    
    // Check localStorage (this will be done on client side)
    results.localStorage = {
      supplierName: 'Check browser console for localStorage data'
    }
    
    console.log('🔍 Auth check results:', results)
    
    return NextResponse.json({
      success: true,
      auth: results
    })
  } catch (error) {
    console.error('Auth check API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
} 