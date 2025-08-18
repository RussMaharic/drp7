"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface LogoutButtonProps {
  userType: 'seller' | 'supplier'
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function LogoutButton({ userType, className, variant = 'outline', size = 'sm' }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogout = async () => {
    setLoading(true)
    
    try {
      // Clear localStorage for supplier authentication
      if (userType === 'supplier') {
        localStorage.removeItem('supplierName')
      }
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (response.ok) {
        toast({
          title: "Logged Out",
          description: "You have been successfully logged out.",
        })
        
        // Redirect to appropriate login page
        router.push(`/auth/${userType}/login`)
      } else {
        throw new Error('Logout failed')
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast({
        title: "Logout Error",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      })
      
      // Force redirect anyway for security
      router.push(`/auth/${userType}/login`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={loading}
      className={className}
    >
      <LogOut className="h-4 w-4 mr-2" />
      {loading ? 'Logging out...' : 'Logout'}
    </Button>
  )
}