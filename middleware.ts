import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isTestMode } from '@/lib/test-mode'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Define protected routes
  const protectedRoutes = {
    '/dashboard': 'seller',
    '/supplier': 'supplier',
  }
  
  // Check if current path needs protection
  const requiredUserType = Object.entries(protectedRoutes).find(([route]) => 
    pathname.startsWith(route)
  )?.[1]
  
  if (!requiredUserType) {
    return NextResponse.next()
  }
  
  // Get session token from cookies
  const sessionToken = request.cookies.get('session_token')?.value
  
  if (!sessionToken) {
    // In test mode, bypass redirect to allow pages to load
    if (isTestMode()) {
      return NextResponse.next()
    }
    // Redirect to appropriate login page
    const loginUrl = new URL(`/auth/${requiredUserType}/login`, request.url)
    return NextResponse.redirect(loginUrl)
  }
  
  // For Edge Runtime compatibility, we'll do basic token presence check
  // The actual session validation will happen in the layout components
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth (auth pages)
     * - login (login pages)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth|login|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)',
  ],
}