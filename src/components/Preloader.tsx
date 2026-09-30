'use client'

import React from 'react'
import Image from 'next/image'

interface PreloaderProps {
  fullScreen?: boolean
}

export function Preloader({ fullScreen = true }: PreloaderProps) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: fullScreen ? '100vh' : '100%',
        height: fullScreen ? '100vh' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        position: fullScreen ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        padding: '2rem',
      }}
    >
      {/* Central Selfera Brand Logo */}
      <div
        className="preloader-main-logo"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
        }}
      >
        <Image
          src="/logo.png"
          alt="Selfera Logo"
          width={56}
          height={56}
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
          }}
          priority
        />
      </div>

      {/* Three dots below the logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '18px',
        }}
      >
        <div
          className="preloader-dot"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="preloader-dot"
          style={{ animationDelay: '0.18s' }}
        />
        <div
          className="preloader-dot"
          style={{ animationDelay: '0.36s' }}
        />
      </div>
    </div>
  )
}
