"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SupplierLoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the full authentication system
    router.push('/auth/supplier/login')
  }, [router])

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to supplier login...</p>
      </div>
    </div>
  )
} 