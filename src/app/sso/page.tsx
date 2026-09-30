'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { handleSSOLogin, attemptAutoSSO } from '@/lib/authUtils'
import { Preloader } from '@/components/Preloader'

function SSOProcessor() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    let isCancelled = false

    const process = async () => {
      // 1. Synchronously inspect window.location for query parameters
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      const hashParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.replace(/^#/, '')) : null

      const directToken =
        urlParams?.get('token') ||
        searchParams?.get('token') ||
        urlParams?.get('accessToken') ||
        searchParams?.get('accessToken') ||
        urlParams?.get('access_token') ||
        searchParams?.get('access_token') ||
        hashParams?.get('token') ||
        hashParams?.get('access_token')

      const targetRedirect =
        urlParams?.get('redirect') ||
        searchParams?.get('redirect') ||
        urlParams?.get('next') ||
        searchParams?.get('next') ||
        '/'

      let result: { success: boolean; error?: string }

      if (directToken) {
        result = await handleSSOLogin(directToken)
      } else {
        // Attempt auto SSO via localStorage or cookie refresh with Admin backend
        result = await attemptAutoSSO()
      }

      if (isCancelled) return

      if (result.success) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('selfera_auth_toast', 'Authentication successful')
        }
        const dest = targetRedirect === '/' ? '/?sso=success' : targetRedirect
        window.location.replace(dest)
      } else {
        router.replace(`/login?error=${encodeURIComponent(result.error || 'sso_failed')}`)
      }
    }

    process()

    return () => {
      isCancelled = true
    }
  }, [searchParams, router])

  // Preloader with Selfera logo and three logo loader below, no text data
  return <Preloader fullScreen />
}

export default function SSOPage() {
  return (
    <Suspense fallback={<Preloader fullScreen />}>
      <SSOProcessor />
    </Suspense>
  )
}
