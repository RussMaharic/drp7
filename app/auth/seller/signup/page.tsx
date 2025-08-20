"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Store, User, Mail, Lock, ArrowLeft, UserPlus, CreditCard, Check, Star } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

// TypeScript declarations for Cashfree SDK
declare global {
  interface Window {
    Cashfree: (config: { mode: 'sandbox' | 'production' }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget: string }) => void
    }
  }
}

// Separate component for search params logic
function SearchParamsHandler({ onError }: { onError: (error: string, step?: 'form' | 'payment') => void }) {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const error = searchParams.get('error')
    
    if (error === 'payment_failed') {
      onError('Payment failed. Please try again.', 'payment')
    } else if (error === 'callback_error') {
      onError('Payment processing error. Please try again.')
    }
  }, [searchParams, onError])
  
  return null
}

export default function SellerSignupPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'form' | 'payment'>('form')
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [cashfreeLoaded, setCashfreeLoaded] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Payment plans
  const paymentPlans = [
    {
      amount: 25000,
      title: 'Starter Plan',
      description: 'Perfect for small businesses',
      features: ['Basic dashboard access', 'Up to 100 products', 'Email support']
    },
    {
      amount: 50000,
      title: 'Professional Plan',
      description: 'For growing businesses',
      features: ['Advanced dashboard', 'Up to 500 products', 'Priority support', 'Analytics'],
      popular: true
    },
    {
      amount: 75000,
      title: 'Enterprise Plan',
      description: 'For large scale operations',
      features: ['Full dashboard access', 'Unlimited products', '24/7 support', 'Advanced analytics', 'Custom integrations']
    }
  ]

  // Load Cashfree SDK
  useEffect(() => {
    const loadCashfreeSDK = async () => {
      console.log('Starting Cashfree SDK load...')
      
      // Try multiple URLs for better reliability
      const urls = [
        'https://sdk.cashfree.com/js/ui/2.0/cashfree.prod.js',
        'https://sdk.cashfree.com/js/v3/cashfree.js',
        'https://cdn.cashfree.com/js/v3/cashfree.js'
      ]
      
      const loadScript = (url: string) => {
        return new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = url
          script.async = true
          script.defer = true
          
          script.onload = () => {
            console.log(`Cashfree SDK loaded successfully from ${url}`)
            // Wait a bit for the SDK to initialize
            setTimeout(() => {
              if (typeof window.Cashfree !== 'undefined') {
                setCashfreeLoaded(true)
                resolve()
              } else {
                reject(new Error('SDK loaded but Cashfree object not available'))
              }
            }, 100)
          }
          
          script.onerror = (error) => {
            console.error(`Failed to load Cashfree SDK from ${url}:`, error)
            reject(new Error(`Failed to load from ${url}`))
          }
          
          document.head.appendChild(script)
        })
      }
      
      // Try each URL until one works
      for (const url of urls) {
        try {
          await loadScript(url)
          break // Success, exit loop
        } catch (error) {
          console.log(`Failed to load from ${url}, trying next...`)
          if (url === urls[urls.length - 1]) {
            // Last URL failed
            console.error('All Cashfree SDK URLs failed')
            setError('Failed to load payment system. Please refresh the page.')
          }
        }
      }
    }
    
    loadCashfreeSDK()
  }, [])

  const handleError = (errorMessage: string, errorStep?: 'form' | 'payment') => {
    setError(errorMessage)
    if (errorStep) {
      setStep(errorStep)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }
    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      // Create seller account immediately
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          name: formData.name,
          userType: 'seller'
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Account Created!",
          description: `Welcome ${data.user.name}! Now choose your subscription plan.`,
        })
        
        // Store user details for payment
        sessionStorage.setItem('sellerAccountId', data.user.id)
        sessionStorage.setItem('sellerUsername', data.user.username)
        setStep('payment')
      } else {
        setError(data.error || 'Signup failed')
        toast({
          title: "Signup Failed",
          description: data.error || 'Please check your information',
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Signup error:', error)
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

  const handlePayment = async (amount: number) => {
    if (!cashfreeLoaded) {
      setError('Payment system is loading. Please wait.')
      return
    }

    setPaymentLoading(true)
    setSelectedPlan(amount)

    try {
      // Get the created account ID
      const accountId = sessionStorage.getItem('sellerAccountId')
      const username = sessionStorage.getItem('sellerUsername')
      
      if (!accountId || !username) {
        throw new Error('Account not found. Please try signing up again.')
      }

      // Create Cashfree order
      const orderId = `seller_${accountId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          customerEmail: formData.email,
          customerName: formData.name,
          customerPhone: '9999999999',
          orderId
        }),
      })

      const orderData = await orderResponse.json()

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order')
      }

      // Store payment details for callback
      sessionStorage.setItem('paymentOrderId', orderData.orderId)
      sessionStorage.setItem('selectedPlanAmount', amount.toString())

      // Initialize Cashfree and open checkout
      console.log('Initializing Cashfree checkout with session ID:', orderData.paymentSessionId)
      console.log('Order data received:', orderData)
      console.log('Window location:', window.location.href)
      console.log('Window hostname:', window.location.hostname)
      
      // Check if Cashfree SDK is available
      if (typeof window.Cashfree === 'undefined') {
        console.error('Cashfree SDK not found on window object')
        console.log('Available window properties:', Object.keys(window).filter(key => key.toLowerCase().includes('cashfree')))
        throw new Error('Cashfree payment system not loaded. Please refresh the page.')
      }

      // Determine environment - use a more reliable method
      const hostname = window.location.hostname
      // For Vercel deployments, always use sandbox mode for testing
      // Change this to production only when you have production Cashfree credentials
      const mode = 'sandbox' // Always use sandbox for now
      
      console.log('Cashfree mode:', mode, 'Hostname:', hostname)
      console.log('Using sandbox mode for testing')
      
      try {
        const cashfree = window.Cashfree({
          mode: mode
        })
        
        console.log('Cashfree instance created:', cashfree)
        console.log('Checkout method available:', typeof cashfree.checkout)

        const checkoutOptions = {
          paymentSessionId: orderData.paymentSessionId,
          redirectTarget: '_self'
        }

        console.log('Opening Cashfree checkout with options:', checkoutOptions)
        
        // Open Cashfree checkout
        cashfree.checkout(checkoutOptions)
      } catch (sdkError) {
        console.error('Error creating Cashfree instance:', sdkError)
        const errorMessage = sdkError instanceof Error ? sdkError.message : 'Unknown SDK error'
        throw new Error(`Failed to initialize payment system: ${errorMessage}`)
      }

    } catch (error) {
      console.error('Payment error:', error)
      const message = error instanceof Error ? error.message : 'Payment initialization failed'
      setError(message)
      toast({
        title: "Payment Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setPaymentLoading(false)
      setSelectedPlan(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className={`w-full space-y-8 ${step === 'payment' ? 'max-w-4xl' : 'max-w-md'}`}>
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
            {step === 'form' ? (
              <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            ) : (
              <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            {step === 'form' ? 'Create Seller Account' : 'Choose Your Plan'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {step === 'form' 
              ? 'Join our platform as a seller and start managing your Shopify store'
              : 'Select a subscription plan to complete your seller registration'
            }
          </p>
        </div>

        <Suspense fallback={<div>Loading search params...</div>}>
          <SearchParamsHandler onError={handleError} />
        </Suspense>

        {step === 'form' ? (
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Create your seller account to access the dashboard
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
                    <Label htmlFor="name">Full Name</Label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        className="pl-10"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={handleInputChange}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="username">Username</Label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        required
                        className="pl-10"
                        placeholder="Choose a username"
                        value={formData.username}
                        onChange={handleInputChange}
                        disabled={loading}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      At least 3 characters, letters and numbers only
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="pl-10"
                        placeholder="Enter your email address"
                        value={formData.email}
                        onChange={handleInputChange}
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
                        autoComplete="new-password"
                        required
                        className="pl-10"
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={handleInputChange}
                        disabled={loading}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      At least 6 characters
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="pl-10"
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
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
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Already have an account?{' '}
                  <Link
                    href="/auth/seller/login"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    Sign in here
                  </Link>
                </p>
                <div className="mt-4 space-y-2 text-sm text-gray-500">
                  <p>
                    Want to be a supplier?{' '}
                    <Link
                      href="/auth/supplier/signup"
                      className="font-medium text-green-600 hover:text-green-500"
                    >
                      Supplier Signup
                    </Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* User Info Summary */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{formData.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{formData.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('form')}
                    className="ml-auto"
                  >
                    Edit Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Payment Plans */}
            <div className="grid md:grid-cols-3 gap-6">
              {paymentPlans.map((plan) => (
                <Card 
                  key={plan.amount} 
                  className={`relative ${plan.popular ? 'border-blue-500 shadow-lg scale-105' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center">
                        <Star className="h-3 w-3 mr-1" />
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-lg">{plan.title}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        ₹{plan.amount.toLocaleString()}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 ml-1">one-time</span>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm">
                          <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handlePayment(plan.amount)}
                      disabled={paymentLoading || !cashfreeLoaded}
                    >
                      {paymentLoading && selectedPlan === plan.amount ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Buy Now'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!cashfreeLoaded && (
              <div className="text-center">
                <p className="text-sm text-gray-500">Loading payment system...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}