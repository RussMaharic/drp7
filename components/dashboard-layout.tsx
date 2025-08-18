"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Home, Package, Truck, BarChart3, Menu, X, Bell, User, Settings, LogOut, Store, Plus, Trash2, RefreshCw, Wallet } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useStore } from "@/contexts/store-context"
import { LogoutButton } from "@/components/logout-button"

const navigation = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "My Stores", href: "/dashboard/stores", icon: Store },
  { name: "Manage Orders", href: "/dashboard/orders", icon: Package },
  { name: "Manage Delivery", href: "/dashboard/delivery", icon: Truck },
  { name: "Wallet", href: "/dashboard/wallet-new", icon: Wallet },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { selectedStore, connectedStores, loading, setSelectedStore, refreshStores, disconnectStore } = useStore()
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    const fetchUserSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        if (data.success && data.user) {
          setUser(data.user)
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error)
      } finally {
        setLoadingUser(false)
      }
    }
    fetchUserSession()
  }, [])


  // Remove old logout handler - using LogoutButton component instead

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src="/Drpshippr.png" alt="Drpshippr" className="h-11 w-11 mr-0 mt-1" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Seller Dashboard
              </h1>
              {selectedStore && (
                <div className="ml-3 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {selectedStore}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-5 w-5" />
              </Button>
              <LogoutButton userType="seller" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 min-h-screen">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Seller Dashboard
              </h2>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="space-y-2 mb-6">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-l-4 border-blue-600"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Store Management */}
            <div className="space-y-3 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Connected Stores</h3>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0" 
                    onClick={refreshStores}
                    title="Refresh stores"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Link href="/connect-store">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Add store">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              
              {loading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading stores...</div>
              ) : connectedStores.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  No stores connected
                  <Link href="/connect-store" className="text-blue-600 hover:underline ml-1">
                    Connect one
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    {connectedStores.map((store) => (
                      <div 
                        key={store.shop} 
                        className={`p-2 rounded border cursor-pointer transition-colors ${
                          selectedStore === store.shop 
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700' 
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600'
                        } ${store.isValid === false ? 'opacity-50' : ''}`}
                        onClick={() => store.isValid !== false && setSelectedStore(store.shop)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-sm">{store.shop}</span>
                              {store.isValid === false && (
                                <Badge variant="destructive" className="text-xs px-1 py-0">Invalid</Badge>
                              )}
                              {store.isValid === true && (
                                <Badge variant="secondary" className="text-xs px-1 py-0 bg-green-100 text-green-800">Active</Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              Connected {new Date(store.connectedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Are you sure you want to remove ${store.shop}?`)) {
                                disconnectStore(store.shop)
                              }
                            }}
                            title="Remove this store"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedStore && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <strong>Active:</strong> {selectedStore}
                      {connectedStores.find(s => s.shop === selectedStore)?.isValid === true && (
                        <span className="text-green-600 ml-1">✓</span>
                      )}
                    </div>
                  )}
                  {connectedStores.some(s => s.isValid === false) && (
                    <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900 p-2 rounded border border-amber-200 dark:border-amber-700">
                      <strong>Warning:</strong> Some stores have invalid tokens. 
                      <Link href="/connect-store" className="underline hover:no-underline">
                        Reconnect them
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Info - Similar to supplier dashboard */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {loadingUser ? 'Loading...' : user ? user.name || user.username : 'Seller Account'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Store Manager
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
