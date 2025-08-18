import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Store, Users, ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src="/Drpshippr.png" alt="Drpshippr" className="h-11 w-11 mr-0 mt-1" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Drpshippr
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            <span className="text-blue-600 dark:text-blue-400">India’s First AI-Powered Dropshipping Engine</span>
            <br />Built to Automate Your Entire E-commerce Journey
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          From product research to ad creation, call confirmation to product syncing let AI run the store while you scale the brand.
          </p>
        </div>

        {/* Dashboard Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Seller Dashboard */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-200 dark:hover:border-blue-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Store className="h-8 w-8 text-blue-600" />
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <CardTitle className="text-2xl">Seller Dashboard</CardTitle>
              <CardDescription>
                Manage your Shopify store, browse approved products, and streamline your e-commerce operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
                <li>• Browse approved supplier products</li>
                <li>• Push products to your Shopify store</li>
                <li>• Manage orders and analytics</li>
                <li>• Track product performance</li>
              </ul>
              <Link href="/auth/seller/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Access Seller Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Supplier Dashboard */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-green-200 dark:hover:border-green-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-green-600" />
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-600 transition-colors" />
              </div>
              <CardTitle className="text-2xl">Supplier Dashboard</CardTitle>
              <CardDescription>
                List your products, manage inventory, and reach more sellers through our platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
                <li>• Submit products for approval</li>
                <li>• Manage your product catalog</li>
                <li>• Track approval status</li>
                <li>• Upload product images</li>
              </ul>
              <Link href="/auth/supplier/login">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Access Supplier Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

                {/* Features Section */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Platform Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Product Management
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Comprehensive product catalog with approval workflow and image management.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Shopify Integration
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Seamless integration with Shopify for easy product synchronization.
              </p>
            </div>
                        <div className="text-center">
              <div className="bg-purple-100 dark:bg-purple-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Multi-User Support
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Separate dashboards for suppliers and sellers with role-based access.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
