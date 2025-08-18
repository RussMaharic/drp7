"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, ArrowRight, Store, Package, TrendingUp } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"

export default function ConnectShopifyPage() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [shopDomain, setShopDomain] = useState("")
  const [isButtonDisabled, setIsButtonDisabled] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    setIsButtonDisabled(!shopDomain || isConnecting)
  }, [shopDomain, isConnecting])

  const handleConnect = async () => {
    if (!shopDomain) {
      toast({
        title: "Shopify Domain Required",
        description: "Please enter your Shopify store domain to connect.",
        variant: "destructive",
      })
      return
    }
    setIsConnecting(true)
    try {
      // TODO: Replace with your test store domain
      window.location.href = `/api/auth/shopify?shop=${shopDomain}`
    } finally {
      setIsConnecting(false)
    }
  }

  const benefits = [
    { icon: Package, text: "Sync your products automatically" },
    { icon: Store, text: "Manage orders from one dashboard" },
    { icon: TrendingUp, text: "Track deliveries and analytics" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4">
            Shopify Integration
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Connect Your Shopify Store</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Sync your products, manage orders, and track deliveries all from one powerful dashboard.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto flex flex-col gap-8 items-stretch">
          {/* Why Connect Your Store */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-blue-600" />
                  Why Connect Your Store?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit.text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

          {/* Quick Setup */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Setup</CardTitle>
                <CardDescription>Get started in just a few clicks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                      1
                    </div>
                    <span className="text-sm">Click "Connect to Shopify"</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                      2
                    </div>
                    <span className="text-sm">Authorize the connection</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                      3
                    </div>
                    <span className="text-sm">Start managing your store</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Ready to Connect */}
            <Card className="text-center">
              <CardHeader>
                <CardTitle>Ready to Connect?</CardTitle>
                <CardDescription>
                  Connect your Shopify store to get started with advanced order management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="text"
                  placeholder="your-store.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  className="text-center"
                />
                <Button
                  onClick={handleConnect}
                  disabled={isButtonDisabled}
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect to Shopify
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500">Secure connection powered by Shopify OAuth</p>
              </CardContent>
            </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            Don't have a Shopify store yet?{" "}
            <a
              href="https://shopify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Create one here
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
