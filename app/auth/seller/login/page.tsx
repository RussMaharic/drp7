"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Store, User, Lock, ArrowLeft, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

// Separate component for search params logic
function SearchParamsHandler({ onMessage }: { onMessage: (message: string) => void }) {
  const searchParams = useSearchParams()
  const [messageShown, setMessageShown] = useState(false)
  
  useEffect(() => {
    // Prevent showing the same message multiple times
    if (messageShown) {
      return
    }
    
    const message = searchParams.get('message')
    if (message) {
      setMessageShown(true)
      onMessage(message)
      
      // Clean up the URL after showing the message
      const url = new URL(window.location.href)
      url.searchParams.delete('message')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, onMessage, messageShown])
  
  return null
}

export default function SellerLoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { toast } = useToast()

  const handleMessage = (message: string) => {
    toast({
      title: "Success",
      description: message,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernameOrEmail,
          password,
          userType: 'seller'
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Welcome back!",
          description: `Hello ${data.user.name}, you're now logged in.`,
        })
        
        router.push('/dashboard')
      } else {
        setError(data.error || 'Login failed')
        toast({
          title: "Login Failed",
          description: data.error || 'Please check your credentials',
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Network error. Please try again.')
      toast({
        title: "Network Error",
        description: 'Please check your connection and try again',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={null}>
        <SearchParamsHandler onMessage={handleMessage} />
      </Suspense>
      <div className="max-w-md w-full space-y-8">
        {/* Back to home */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Store className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Seller Login
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your seller dashboard
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Enter your credentials to access your seller dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="usernameOrEmail">Username or Email</Label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="usernameOrEmail"
                      name="usernameOrEmail"
                      type="text"
                      autoComplete="username"
                      required
                      className="pl-10"
                      placeholder="Enter username or email"
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="pl-10"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <Link
                  href="/auth/seller/signup"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Sign up here
                </Link>
              </p>
              <div className="mt-4 space-y-2 text-sm text-gray-500">
                <p>
                  Need supplier access?{' '}
                  <Link
                    href="/auth/supplier/login"
                    className="font-medium text-green-600 hover:text-green-500"
                  >
                    Supplier Login
                  </Link>
                </p>
                <p>
                  Admin access?{' '}
                  <Link
                    href="/login/admin"
                    className="font-medium text-purple-600 hover:text-purple-500"
                  >
                    Admin Login
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}