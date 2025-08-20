'use client'

import { useState, useEffect } from 'react'

// TypeScript declarations for Cashfree SDK
declare global {
  interface Window {
    Cashfree: (config: { mode: 'sandbox' | 'production' }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget: string }) => void
    }
  }
}

export default function TestCashfreePage() {
  const [cashfreeLoaded, setCashfreeLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  // Load Cashfree SDK
  useEffect(() => {
    addLog('Starting Cashfree SDK load...')
    
    const script = document.createElement('script')
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
    
    script.onload = () => {
      addLog('Cashfree SDK loaded successfully')
      setCashfreeLoaded(true)
    }
    
    script.onerror = (error) => {
      addLog(`Failed to load Cashfree SDK: ${error}`)
      setError('Failed to load payment system')
    }
    
    document.head.appendChild(script)
    addLog('Script tag added to document head')

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
        addLog('Script tag removed')
      }
    }
  }, [])

  const testOrderCreation = async () => {
    setLoading(true)
    setError('')
    addLog('Testing order creation...')

    try {
      const response = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 50000,
          customerEmail: 'test@example.com',
          customerName: 'Test User',
          customerPhone: '9999999999',
          orderId: `test_${Date.now()}`
        }),
      })

      const orderData = await response.json()
      addLog(`Order creation response: ${JSON.stringify(orderData)}`)

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      addLog(`Payment session ID: ${orderData.paymentSessionId}`)
      
      // Test Cashfree initialization
      if (typeof window.Cashfree === 'undefined') {
        throw new Error('Cashfree SDK not available')
      }

      const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      const mode = isProduction ? 'production' : 'sandbox'
      
      addLog(`Environment: ${mode} (hostname: ${window.location.hostname})`)
      
      const cashfree = window.Cashfree({ mode })
      addLog('Cashfree instance created successfully')
      
      addLog('Testing checkout method...')
      if (typeof cashfree.checkout === 'function') {
        addLog('Checkout method is available')
        addLog('Ready to open checkout!')
      } else {
        throw new Error('Checkout method not available')
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      addLog(`Error: ${message}`)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Cashfree SDK Test Page
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">SDK Status</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>SDK Loaded:</span>
                  <span className={`px-2 py-1 rounded text-sm ${cashfreeLoaded ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {cashfreeLoaded ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Environment:</span>
                  <span className="px-2 py-1 rounded text-sm bg-blue-100 text-blue-800">
                    {typeof window !== 'undefined' ? (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? 'Production' : 'Development') : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Hostname:</span>
                  <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                    {typeof window !== 'undefined' ? window.location.hostname : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Actions</h2>
              <button
                onClick={testOrderCreation}
                disabled={loading || !cashfreeLoaded}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Testing...' : 'Test Order Creation'}
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="text-sm font-mono text-gray-700 dark:text-gray-300">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
