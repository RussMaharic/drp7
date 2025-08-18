import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if environment variables are properly set
if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not properly configured')
  console.error('Please set your Supabase project URL in .env.local')
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key') {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not properly configured')
  console.error('Please set your Supabase anon key in .env.local')
}

// Use fallback values for development if env vars are missing
const finalSupabaseUrl = supabaseUrl || 'https://your-project.supabase.co'
const finalSupabaseAnonKey = supabaseAnonKey || 'your-anon-key'

export const supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey)

// Test the connection
if (process.env.NODE_ENV === 'development') {
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('❌ Supabase connection failed:', error.message)
      console.error('Please check your Supabase configuration in .env.local')
    } else {
      console.log('✅ Supabase connection successful')
    }
  })
} 