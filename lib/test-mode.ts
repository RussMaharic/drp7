export function isTestMode(): boolean {
  const explicit = process.env.TEST_MODE === 'true' || process.env.NEXT_PUBLIC_TEST_MODE === 'true'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseUnset = !supabaseUrl || supabaseUrl === 'https://your-project.supabase.co'
  return explicit || supabaseUnset
}











