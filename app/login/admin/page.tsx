"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Shield, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AdminLogin() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    // Ensure body has white background
    document.body.style.backgroundColor = 'white'
    document.documentElement.style.backgroundColor = 'white'
    
    return () => {
      // Clean up on unmount
      document.body.style.backgroundColor = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('🔍 Admin login attempt:', { username, passwordLength: password.length })
      
      // Get admin credentials from environment variables
      const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "admin"
      const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123"
      
      // Simple demo authentication - in production, this should be properly secured
      if (username.trim() === adminUsername && password.trim() === adminPassword) {
        console.log('✅ Admin credentials valid, setting localStorage...')
        localStorage.setItem('adminUser', username.trim())
        
        toast({
          title: "Login successful!",
          description: "Welcome to the admin dashboard.",
        })
        
        console.log('🔄 Redirecting to admin dashboard...')
        
        // Use multiple redirect methods for reliability
        setTimeout(() => {
          window.location.href = '/admin'
        }, 500)
        
        // Also try router.push as backup
        router.push('/admin')
        
      } else {
        console.log('❌ Invalid credentials:', { 
          username: username.trim(), 
          password: '***', 
          usernameMatch: username.trim() === adminUsername,
          passwordMatch: password.trim() === adminPassword
        })
        
        toast({
          title: "Invalid credentials",
          description: "Please check your username and password.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('💥 Login error:', error)
      toast({
        title: "Login failed",
        description: "An error occurred during login. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-4" style={{ backgroundColor: 'white' }}>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <CardDescription>
            Sign in to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 