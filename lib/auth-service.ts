import { supabase } from '@/lib/supabase'
import crypto from 'crypto'
import { isTestMode } from '@/lib/test-mode'

export type UserType = 'seller' | 'supplier'

export interface User {
  id: string
  username: string
  email: string
  name: string
  userType: UserType
  companyName?: string
  createdAt: string
  lastLogin?: string
}

export interface LoginCredentials {
  usernameOrEmail: string
  password: string
  userType: UserType
}

export interface SignupCredentials {
  username: string
  email: string
  password: string
  name: string
  userType: UserType
  companyName?: string
  paymentOrderId?: string
  subscriptionAmount?: string
}

export interface SessionData {
  user: User
  sessionToken: string
  expiresAt: string
}

export class AuthService {
  private static hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password + 'dropship_salt_2024').digest('hex')
  }

  private static generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex') + Date.now().toString(36)
  }

  static async signup(credentials: SignupCredentials): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const { username, email, password, name, userType, companyName, paymentOrderId, subscriptionAmount } = credentials

      // Validate input
      if (!username || !email || !password || !name) {
        return { success: false, error: 'All fields are required' }
      }

      if (username.length < 3) {
        return { success: false, error: 'Username must be at least 3 characters' }
      }

      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' }
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Invalid email format' }
      }

      const tableName = userType === 'seller' ? 'sellers' : 'suppliers'
      const hashedPassword = this.hashPassword(password)

      // Check if username or email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from(tableName)
        .select('username, email')
        .or(`username.eq.${username},email.eq.${email}`)
        .limit(1)

      if (checkError) {
        console.error('Error checking existing user:', checkError)
        return { success: false, error: 'Database error occurred' }
      }

      if (existingUser && existingUser.length > 0) {
        const existing = existingUser[0]
        if (existing.username === username) {
          return { success: false, error: 'Username already taken' }
        }
        if (existing.email === email) {
          return { success: false, error: 'Email already registered' }
        }
      }

      // Create new user
      const userData = {
        username,
        email,
        password_hash: hashedPassword,
        name,
        ...(userType === 'supplier' && companyName && { company_name: companyName }),
        ...(userType === 'seller' && paymentOrderId && { 
          payment_order_id: paymentOrderId,
          payment_status: 'paid',
          payment_date: new Date().toISOString()
        }),
        ...(userType === 'seller' && subscriptionAmount && { subscription_amount: Number(subscriptionAmount) })
      }

      const { data: newUser, error: insertError } = await supabase
        .from(tableName)
        .insert(userData)
        .select()
        .single()

      if (insertError) {
        console.error('Error creating user:', insertError)
        return { success: false, error: 'Failed to create account' }
      }

      const user: User = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        userType,
        companyName: newUser.company_name,
        createdAt: newUser.created_at,
        lastLogin: newUser.last_login
      }

      return { success: true, user }
    } catch (error) {
      console.error('Signup error:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  static async login(credentials: LoginCredentials, ipAddress?: string, userAgent?: string): Promise<{ success: boolean; sessionData?: SessionData; error?: string }> {
    try {
      const { usernameOrEmail, password, userType } = credentials

      if (!usernameOrEmail || !password) {
        return { success: false, error: 'Username/email and password are required' }
      }

      // Test mode: accept known credentials and bypass database
      if (isTestMode()) {
        const isValid = (usernameOrEmail === 'Rushi' || usernameOrEmail === 'rushi@example.com') && password === 'Rushi2002'
        if (!isValid) {
          return { success: false, error: 'Invalid credentials' }
        }
        const sessionToken = 'test-session-token'
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        const user: User = {
          id: 'test-user-id',
          username: 'Rushi',
          email: 'rushi@example.com',
          name: 'Rushi',
          userType,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        }
        return {
          success: true,
          sessionData: {
            user,
            sessionToken,
            expiresAt: expiresAt.toISOString(),
          },
        }
      }

      const tableName = userType === 'seller' ? 'sellers' : 'suppliers'
      const hashedPassword = this.hashPassword(password)

      console.log(`🔍 Attempting login for ${userType}: ${usernameOrEmail}`)
      console.log(`📊 Using table: ${tableName}`)

      // Find user by username or email
      const { data: user, error } = await supabase
        .from(tableName)
        .select('*')
        .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error(`❌ Database error during login:`, error)
        return { success: false, error: 'Authentication temporarily unavailable' }
      }

      if (!user) {
        console.log(`❌ User not found: ${usernameOrEmail} in ${tableName}`)
        return { success: false, error: 'Invalid credentials' }
      }

      console.log(`✅ User found: ${user.username} (${user.email})`)

      // Verify password
      if (hashedPassword !== user.password_hash) {
        console.log(`❌ Password mismatch for user: ${user.username}`)
        return { success: false, error: 'Invalid credentials' }
      }

      console.log(`✅ Password verified for user: ${user.username}`)

      // Create session
      const sessionToken = this.generateSessionToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      console.log(`🔐 Creating session for user: ${user.username}`)

      const { error: sessionError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          user_type: userType,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent
        })

      if (sessionError) {
        console.error('❌ Failed to create session:', sessionError)
        return { success: false, error: 'Failed to create session' }
      }

      console.log(`✅ Session created successfully for user: ${user.username}`)

      // Update last login
      await supabase
        .from(tableName)
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)

      const userData: User = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        userType,
        companyName: user.company_name,
        createdAt: user.created_at,
        lastLogin: new Date().toISOString()
      }

      console.log(`🎉 Login successful for user: ${user.username}`)

      return {
        success: true,
        sessionData: {
          user: userData,
          sessionToken,
          expiresAt: expiresAt.toISOString()
        }
      }
    } catch (error) {
      console.error('❌ Login error:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  static async verifySession(sessionToken: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      if (!sessionToken) {
        return { success: false, error: 'No session token provided' }
      }

      // Test mode: accept the fixed token
      if (isTestMode() && sessionToken === 'test-session-token') {
        return {
          success: true,
          user: {
            id: 'test-user-id',
            username: 'Rushi',
            email: 'rushi@example.com',
            name: 'Rushi',
            userType: 'seller',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          },
        }
      }

      // Get session from database
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !session) {
        return { success: false, error: 'Invalid or expired session' }
      }

      // Get user data
      const tableName = session.user_type === 'seller' ? 'sellers' : 'suppliers'
      const { data: user, error: userError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', session.user_id)
        .eq('is_active', true)
        .single()

      if (userError || !user) {
        return { success: false, error: 'User not found' }
      }

      const userData: User = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        userType: session.user_type as UserType,
        companyName: user.company_name,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }

      return { success: true, user: userData }
    } catch (error) {
      console.error('Session verification error:', error)
      return { success: false, error: 'Session verification failed' }
    }
  }

  static async logout(sessionToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', sessionToken)

      if (error) {
        console.error('Logout error:', error)
        return { success: false, error: 'Failed to logout' }
      }

      return { success: true }
    } catch (error) {
      console.error('Logout error:', error)
      return { success: false, error: 'Logout failed' }
    }
  }

  static async cleanupExpiredSessions(): Promise<void> {
    try {
      await supabase
        .from('user_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString())
    } catch (error) {
      console.error('Session cleanup error:', error)
    }
  }
}