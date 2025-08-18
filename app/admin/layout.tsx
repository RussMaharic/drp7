"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Shield, ShoppingCart, Package, Store, Users, Bell, Settings, User, DollarSign } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const { toast } = useToast()

  useEffect(() => {
    // Don't check user if we're on the login page
    if (pathname === '/login/admin') {
      setLoading(false)
      return
    }
    checkUser()
  }, [pathname])

  const checkUser = async () => {
    try {
      // Simple admin check from localStorage for demo
      const adminUser = localStorage.getItem('adminUser')
      if (!adminUser) {
        setTimeout(() => {
          window.location.href = '/login/admin'
        }, 100)
        return
      }
      setUser({ user_metadata: { full_name: adminUser }, email: 'admin@company.com' })
      setLoading(false)
    } catch (error) {
      console.error('Error checking admin user:', error)
      if (!localStorage.getItem('adminUser')) {
        setTimeout(() => {
          window.location.href = '/login/admin'
        }, 100)
      }
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('adminUser')
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const navigation = [
    {
      name: "All Orders",
      href: "/admin",
      icon: ShoppingCart,
      current: pathname === "/admin"
    },
    {
      name: "New Products",
      href: "/admin/products",
      icon: Package,
      current: pathname === "/admin/products"
    },
    {
      name: "All Suppliers",
      href: "/admin/suppliers",
      icon: Users,
      current: pathname === "/admin/suppliers"
    },
    {
      name: "RTO Rates",
      href: "/admin/rto-rates",
      icon: DollarSign,
      current: pathname === "/admin/rto-rates"
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
                Admin Dashboard
              </h1>
              <div className="ml-3 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                ADMIN
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 min-h-screen">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Admin Panel
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
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-l-4 border-purple-600"
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
                  <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.user_metadata?.full_name || 'Admin'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Administrator
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