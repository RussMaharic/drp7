"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Package, Plus, List, CheckSquare, User, Bell, Settings, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { LogoutButton } from "@/components/logout-button"

interface SupplierLayoutProps {
  children: React.ReactNode
}

export default function SupplierLayout({ children }: SupplierLayoutProps) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const { toast } = useToast()

  useEffect(() => {
    // Don't check user if we're on the login page
    if (pathname === '/login/supplier') {
      setLoading(false)
      return
    }
    checkUser()
  }, [pathname])

  const checkUser = async () => {
    try {
      console.log('🔍 LAYOUT - Checking user authentication...')
      
      // Method 1: Check if we have a session token from the full auth system
      const sessionToken = document.cookie.split('; ').find(row => row.startsWith('session_token='))?.split('=')[1]
      
      if (sessionToken) {
        console.log('🔐 LAYOUT - Found session token, verifying...')
        try {
          const response = await fetch('/api/auth/verify-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionToken })
          })
          
          const data = await response.json()
          
          if (data.success && data.user) {
            console.log('✅ LAYOUT - Valid session found:', data.user.username)
            // Store supplier name in localStorage for dashboard integration
            localStorage.setItem('supplierName', data.user.username)
            setUser({ 
              user_metadata: { 
                full_name: data.user.name || data.user.username, 
                username: data.user.username 
              }, 
              email: data.user.email 
            })
            setLoading(false)
            return
          } else {
            console.log('❌ LAYOUT - Session verification failed:', data.error)
          }
        } catch (error) {
          console.log('❌ LAYOUT - Session verification request failed:', error)
        }
      }
      
      // Method 2: Try to get user from Supabase auth as fallback
      let user = null
      let error = null
      
      try {
        const authResult = await supabase.auth.getUser()
        user = authResult.data.user
        error = authResult.error
        console.log('🔐 LAYOUT - Supabase auth check:', { hasUser: !!user, email: user?.email, error: error?.message })
      } catch (authError) {
        console.log('⚠️ LAYOUT - Supabase auth failed, trying session refresh...')
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshData.user) {
            user = refreshData.user
            error = null
            console.log('✅ LAYOUT - Session refreshed successfully:', user.email)
          } else {
            error = refreshError
            console.log('❌ LAYOUT - Session refresh failed:', refreshError?.message)
          }
        } catch (refreshErr) {
          console.log('❌ LAYOUT - Session refresh error:', refreshErr)
          error = refreshErr
        }
      }
      
      if (error || !user) {
        console.log('🔄 LAYOUT - No valid session, checking localStorage fallback...')
        // If no proper authentication, fallback to simple localStorage check for backwards compatibility
        const supplierName = localStorage.getItem('supplierName')
        console.log('💾 LAYOUT - localStorage supplierName:', supplierName)
        
        if (!supplierName) {
          console.log('❌ LAYOUT - No localStorage fallback, redirecting to login...')
          setTimeout(() => {
            window.location.href = '/auth/supplier/login'
          }, 100)
          return
        }
        console.log('📦 LAYOUT - Using localStorage authentication')
        setUser({ user_metadata: { full_name: supplierName, username: supplierName }, email: 'demo@supplier.com' })
      } else {
        console.log('✅ LAYOUT - Valid Supabase authentication found:', user.email)
        // Get supplier data from suppliers table using user email
        const { data: supplierData, error: supplierError } = await supabase
          .from('suppliers')
          .select('username, name')
          .eq('email', user.email)
          .single()

        let username: string
        let fullName: string
        if (supplierError || !supplierData) {
          // Fallback to localStorage for backwards compatibility
          username = localStorage.getItem('supplierName') || 'Unknown User'
          fullName = localStorage.getItem('supplierName') || 'Unknown User'
        } else {
          // Use the actual data from suppliers table
          username = supplierData.username
          fullName = supplierData.name || supplierData.username
          // Store supplier name in localStorage for dashboard integration
          localStorage.setItem('supplierName', username)
        }

        setUser({ 
          ...user,
          user_metadata: { 
            ...user.user_metadata,
            full_name: fullName,
            username: username
          }
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Error checking user:', error)
      // Fallback to localStorage check
      const supplierName = localStorage.getItem('supplierName')
      if (!supplierName) {
        setTimeout(() => {
          window.location.href = '/auth/supplier/login'
        }, 100)
      } else {
        setUser({ user_metadata: { full_name: supplierName, username: supplierName }, email: 'demo@supplier.com' })
      }
      setLoading(false)
    }
  }

  // Remove old sign out handler - using LogoutButton component instead

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const navigation = [
    {
      name: "List Product",
      href: "/supplier",
      icon: Plus,
      current: pathname === "/supplier"
    },
    {
      name: "My Products",
      href: "/supplier/products",
      icon: List,
      current: pathname === "/supplier/products"
    },
    {
      name: "Orders",
      href: "/supplier/orders",
      icon: ShoppingCart,
      current: pathname === "/supplier/orders"
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
                                    <div className="flex items-center">
                          <img src="/Drpshippr.png" alt="Drpshippr" className="h-11 w-11 mr-0 mt-1" />
                          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            Supplier Dashboard
                          </h1>
                          <div className="ml-3 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            LIVE
                          </div>
                        </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-5 w-5" />
              </Button>
              <LogoutButton userType="supplier" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 min-h-screen">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Supplier Dashboard
            </h2>
            
            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      item.current
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-l-4 border-blue-600"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* User Info */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.user_metadata?.full_name || user?.email || 'Supplier'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Supplier Account
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
} 