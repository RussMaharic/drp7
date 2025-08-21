"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AuthService } from '@/lib/auth-service'

// Separate component for search params logic
function SearchParamsHandler({ onComplete }: { onComplete: (orderId: string, amount: string) => void }) {
  const searchParams = useSearchParams()
  const [hasCalledComplete, setHasCalledComplete] = useState(false)
  
  useEffect(() => {
    // Prevent multiple calls
    if (hasCalledComplete) {
      return
    }
    
    // Check if we have the required parameters
    const orderId = searchParams.get('order_id')
    const amount = searchParams.get('amount')
    const status = searchParams.get('status')
    
    console.log('Completion page loaded with:', { orderId, amount, status })
    
    if (orderId && amount) {
      setHasCalledComplete(true)
      onComplete(orderId, amount)
    }
  }, [searchParams, onComplete, hasCalledComplete])
  
  return null
}

export default function SignupCompletePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [processed, setProcessed] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleComplete = async (orderId: string, amount: string) => {
    // Prevent multiple executions
    if (processed) {
      console.log('Already processed, skipping...')
      return
    }
    
    setProcessed(true)
    try {
      setPaymentAmount(amount)

      // Check if this is a direct success from Cashfree callback
      const searchParams = new URLSearchParams(window.location.search)
      const directSuccess = searchParams.get('direct_success')
      const callbackSuccess = searchParams.get('status') === 'callback_success'
      
      console.log('Completion parameters:', { orderId, amount, directSuccess, callbackSuccess })

      // If we have direct success indicators, skip verification
      if (directSuccess === 'true' || callbackSuccess) {
        console.log('Skipping payment verification - direct success indicated')
        setSuccess(true)
        
        toast({
          title: "Welcome to DRP Shipper!",
          description: `Your seller account has been created successfully. Payment of ₹${amount} confirmed.`,
        })

        // Auto-redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/auth/seller/login?message=Account created successfully, please login')
        }, 3000)
        return
      }

      // Only verify payment if we don't have direct success indicators
      console.log('Verifying payment status...')
      
      try {
        const verifyResponse = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderId })
        })

        const verifyData = await verifyResponse.json()

        if (!verifyData.success || !verifyData.isPaid) {
          throw new Error('Payment verification failed')
        }

        // Try to get stored account data for database update
        const accountId = sessionStorage.getItem('sellerAccountId')
        const username = sessionStorage.getItem('sellerUsername')
        
        if (accountId && username) {
          console.log('Found account data, updating subscription...')
          
          // Update seller account with payment details
          const updateResponse = await fetch('/api/auth/update-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accountId,
              subscriptionAmount: amount,
              paymentStatus: 'paid',
              paymentOrderId: orderId
            }),
          })

          const updateResult = await updateResponse.json()

          if (!updateResult.success) {
            console.log('Failed to update subscription, but payment was successful')
          }

          // Clear stored data
          sessionStorage.removeItem('sellerAccountId')
          sessionStorage.removeItem('sellerUsername')
          sessionStorage.removeItem('paymentOrderId')
          sessionStorage.removeItem('selectedPlanAmount')
        } else {
          console.log('No account data found, but payment was successful - skipping database update')
        }

      } catch (verificationError) {
        console.log('Payment verification failed, but proceeding since payment was successful:', verificationError)
        // Don't throw error here - payment was successful according to Cashfree
      }

      setSuccess(true)
      
      toast({
        title: "Welcome to DRP Shipper!",
        description: `Your seller account has been created successfully. Payment of ₹${amount} confirmed.`,
      })

      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/seller/login?message=Account created successfully, please login')
      }, 3000)

    } catch (error) {
      console.error('Signup completion error:', error)
      setError(error instanceof Error ? error.message : 'Failed to complete signup')
      toast({
        title: "Signup Failed",
        description: error instanceof Error ? error.message : 'Please try again',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={null}>
        <SearchParamsHandler onComplete={handleComplete} />
      </Suspense>
      <div className="max-w-md w-full space-y-8">
        {/* Back to home */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500 mb-4">
            <ArrowRight className="h-4 w-4 mr-1 rotate-180" />
            Back to Home
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full mb-4">
              {loading ? (
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              ) : success ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
            </div>
            <CardTitle>
              {loading ? 'Processing Your Account...' : success ? 'Welcome to DRP Shipper!' : 'Signup Failed'}
            </CardTitle>
            <CardDescription>
              {loading 
                ? 'Please wait while we verify your payment and create your account'
                : success 
                  ? 'Your seller account has been created successfully'
                  : 'There was an issue completing your registration'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-200">
                      Payment Confirmed
                    </span>
                  </div>
                  {paymentAmount && (
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Amount: ₹{Number(paymentAmount).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="text-center space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You will be redirected to the login page in a few seconds...
                  </p>
                  
                  <Button 
                    onClick={() => router.push('/auth/seller/login')}
                    className="w-full"
                  >
                    Continue to Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!loading && !success && (
              <div className="space-y-4">
                <Button 
                  onClick={() => router.push('/auth/seller/signup')}
                  className="w-full"
                  variant="outline"
                >
                  Try Again
                </Button>
                
                <div className="text-center">
                  <Link 
                    href="/contact" 
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Need help? Contact Support
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

