export interface UserProfile {
  id: string
  user_id: string
  email: string
  full_name: string
  role_id: number
  role_name: string
  initial: string
  is_active: boolean
}

export const ROLE_NAMES: Record<number, string> = {
  1: 'Founder',
  2: 'UK Staff',
  3: 'Team Lead',
  4: 'Full Time',
  5: 'Intern',
}

export function formatUserName(rawName?: string | null, email?: string | null): string {
  if (rawName && rawName.trim().length > 0) {
    const trimmed = rawName.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }
  if (email && email.trim().length > 0) {
    const handle = email.split('@')[0]
    return handle.charAt(0).toUpperCase() + handle.slice(1)
  }
  return 'User'
}

export function getCachedUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('selfera_user_profile')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setCachedUserProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('selfera_user_profile', JSON.stringify(profile))
    window.dispatchEvent(new Event('selfera_user_profile_updated'))
  } catch {}
}

export function clearCachedUserProfile(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('selfera_user_profile')
    localStorage.removeItem('selfera_sso_token')
    sessionStorage.removeItem('selfera_auth_toast')
    document.cookie = 'selfera_sso_token=; path=/; max-age=0; SameSite=Lax'
    window.dispatchEvent(new Event('selfera_user_profile_updated'))
  } catch {}
}

export async function logoutUser(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
  } catch {}

  try {
    localStorage.removeItem('selfera_user_profile')
    localStorage.removeItem('selfera_sso_token')
    sessionStorage.removeItem('selfera_auth_toast')
    sessionStorage.setItem('selfera_explicit_logout', 'true')
    document.cookie = 'selfera_sso_token=; path=/; max-age=0; SameSite=Lax'
    window.dispatchEvent(new Event('selfera_user_profile_updated'))
  } catch {}

  window.location.href = '/login?logged_out=true'
}

export async function fetchActiveUserProfile(): Promise<UserProfile | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      const cached = getCachedUserProfile()
      if (cached && cached.email) {
        return cached
      }
      clearCachedUserProfile()
      return null
    }

    const email = (session.user.email || '').trim().toLowerCase()
    const userId = session.user.id

    // Explicitly query public.users schema!
    const { data: profiles } = await supabase
      .schema('public')
      .from('users')
      .select('id, user_id, email, full_name, role_id, is_active')
      .or(`user_id.eq.${userId},email.ilike.${email}`)

    const userRow = profiles && profiles.length > 0 ? profiles[0] : null
    const roleId = userRow?.role_id ?? 2
    const roleName = ROLE_NAMES[roleId] || 'Staff'

    const fullName = formatUserName(
      userRow?.full_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name,
      email
    )
    const initial = fullName.charAt(0).toUpperCase() || 'U'

    const resolved: UserProfile = {
      id: userRow?.id || userId,
      user_id: userId,
      email: session.user.email || email,
      full_name: fullName,
      role_id: roleId,
      role_name: roleName,
      initial,
      is_active: userRow?.is_active ?? true,
    }

    setCachedUserProfile(resolved)
    return resolved
  } catch (err) {
    console.error('Error fetching user profile:', err)
    return getCachedUserProfile()
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    let base64Url = parts[1]
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) {
      base64 += '='
    }
    const decoded = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(decoded)
  } catch (err) {
    console.error('[SSO] Failed to decode JWT token:', err)
    return null
  }
}

export const ROLE_TYPE_TO_ID: Record<string, number> = {
  founder: 1,
  uk_staff: 2,
  team_lead: 3,
  full_time: 4,
  intern: 5,
}

export async function handleSSOLogin(
  token: string
): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: 'missing_token' }

  const payload = decodeJwtPayload(token)
  if (!payload) return { success: false, error: 'invalid_token' }

  if (typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000) {
    return { success: false, error: 'token_expired' }
  }

  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    const userEmail = (
      (payload.email as string) ||
      (payload.user_email as string) ||
      ''
    ).trim().toLowerCase()

    const payloadUserId = (payload.user_id || payload.id || '') as string
    const roleTypeStr = (payload.role_type as string) || (payload.role as string) || ''
    const mappedFromType = roleTypeStr ? ROLE_TYPE_TO_ID[roleTypeStr.toLowerCase()] : undefined

    let userRow: {
      id: string
      user_id?: string
      email: string
      full_name?: string
      role_id?: number
      is_active?: boolean
    } | null = null

    if (userEmail) {
      const { data: users } = await supabase
        .schema('public')
        .from('users')
        .select('id, user_id, email, full_name, role_id, is_active')
        .ilike('email', userEmail)
      if (users && users.length > 0) userRow = users[0]
    }

    if (!userRow && payloadUserId) {
      const { data: users } = await supabase
        .schema('public')
        .from('users')
        .select('id, user_id, email, full_name, role_id, is_active')
        .or(`id.eq.${payloadUserId},user_id.eq.${payloadUserId}`)
      if (users && users.length > 0) userRow = users[0]
    }

    const roleId =
      userRow?.role_id ??
      (typeof payload.role_id === 'number'
        ? payload.role_id
        : mappedFromType ?? 2)

    // Verify product access (11 = Sales Pipeline)
    let canAccess = true
    try {
      const { data: accessData } = await supabase
        .schema('public')
        .from('role_product_access')
        .select('can_access')
        .eq('role_id', roleId)
        .eq('product_id', 11)
        .maybeSingle()

      if (accessData && accessData.can_access === false) {
        canAccess = false
      }
    } catch {
      // non-blocking fallback
    }

    if (!canAccess) {
      return { success: false, error: 'access_denied' }
    }

    const rawName =
      userRow?.full_name ||
      (payload.full_name as string) ||
      (payload.name as string) ||
      (userEmail ? userEmail.split('@')[0] : 'User')
    const fullName = formatUserName(rawName, userEmail)
    const roleName =
      ROLE_NAMES[roleId] || (payload.role as string) || (payload.role_type as string) || 'Staff'

    const profile: UserProfile = {
      id: userRow?.id || payloadUserId || String(payload.id || 'sso-user'),
      user_id: userRow?.user_id || payloadUserId || String(payload.id || 'sso-user'),
      email: userRow?.email || userEmail,
      full_name: fullName,
      role_id: roleId,
      role_name: roleName,
      initial: fullName.charAt(0).toUpperCase() || 'U',
      is_active: userRow?.is_active ?? true,
    }

    setCachedUserProfile(profile)

    if (typeof window !== 'undefined') {
      localStorage.setItem('selfera_sso_token', token)
      document.cookie = `selfera_sso_token=${encodeURIComponent(
        token
      )}; path=/; max-age=2592000; SameSite=Lax`
    }

    // Log audit event non-blocking
    try {
      await supabase.from('user_logs').insert({
        user_id: profile.id,
        user_name: profile.full_name,
        action: 'SSO_LOGIN',
        entity_type: 'auth',
        details: {
          provider: 'automaitee_admin',
          email: profile.email,
          role: profile.role_name,
          timestamp: new Date().toISOString(),
        },
      })
    } catch {
      // non-blocking
    }

    return { success: true }
  } catch (err) {
    console.error('[SSO] Error during SSO authentication:', err)
    return { success: false, error: 'sso_failed' }
  }
}

/**
 * Attempts auto SSO authentication by extracting token from URL, localStorage,
 * or background cookie session refresh with Admin Backend (port 3001).
 */
export async function attemptAutoSSO(ignoreExplicitLogout = false): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'no_window' }

  // If user explicitly logged out and we are not in an explicit action, prevent auto-login
  if (!ignoreExplicitLogout && sessionStorage.getItem('selfera_explicit_logout') === 'true') {
    return { success: false, error: 'explicitly_logged_out' }
  }

  // 1. Check URL parameters
  const urlParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  let token =
    urlParams.get('token') ||
    urlParams.get('accessToken') ||
    urlParams.get('access_token') ||
    hashParams.get('token') ||
    hashParams.get('accessToken') ||
    hashParams.get('access_token')

  // 2. Check localStorage
  if (!token) {
    token = localStorage.getItem('selfera_sso_token') || localStorage.getItem('accessToken')
  }

  // 3. Check cookie session refresh with Admin backend (port 3001)
  if (!token) {
    try {
      const adminBackendUrl =
        process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3001'
      const res = await fetch(`${adminBackendUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.accessToken) {
          token = data.accessToken
        }
      }
    } catch {
      // Non-blocking
    }
  }

  if (token) {
    return await handleSSOLogin(token)
  }

  return { success: false, error: 'no_token_found' }
}

/**
 * Log in directly through Admin Backend (port 3001) if credentials match company staff records.
 */
export async function loginViaAdminBackend(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; accessToken?: string }> {
  try {
    const adminBackendUrl =
      process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3001'
    const res = await fetch(`${adminBackendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
      credentials: 'include',
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      return { success: false, error: data.error || 'Invalid email or password' }
    }

    if (data.accessToken) {
      const ssoRes = await handleSSOLogin(data.accessToken)
      return { success: ssoRes.success, error: ssoRes.error, accessToken: data.accessToken }
    }

    return { success: false, error: 'No token received from auth server' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return { success: false, error: msg }
  }
}


