import React from 'react'
import { AlertTriangle, Database, Key } from 'lucide-react'

interface EnvWarningBannerProps {
  error?: string
}

export function EnvWarningBanner({ error }: EnvWarningBannerProps) {
  return (
    <div
      className="card mb-6"
      style={{
        border: '1px solid #fde68a',
        backgroundColor: '#fffbeb',
        borderRadius: '12px',
        padding: '1.5rem',
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle size={24} style={{ color: '#d97706', flexShrink: 0 }} />
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#92400e' }}>
          {error ? 'Supabase Connection Error' : 'Supabase Credentials Required'}
        </h3>
      </div>

      <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem', color: '#78350f' }}>
        {error ? (
          <>
            Failed to query Supabase: <strong>{error}</strong>. If your tables are not yet set up,
            make sure to execute the SQL migrations in Supabase SQL Editor.
          </>
        ) : (
          <>
            Your <code>.env.local</code> file currently contains placeholder credentials. To connect
            this dashboard to your database, please configure your actual Supabase project keys.
          </>
        )}
      </p>

      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          color: '#1e293b',
        }}
      >
        <div className="flex items-center gap-2 mb-2 text-muted">
          <Key size={14} />
          <span>Set these in <strong>.env.local</strong>:</span>
        </div>
        <div style={{ color: 'var(--primary)' }}>
          NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
        </div>
        <div style={{ color: 'var(--primary)', marginTop: '0.25rem' }}>
          NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 text-muted" style={{ borderTop: '1px solid var(--card-border)' }}>
          <Database size={14} />
          <span>And verify SQL migrations in <strong>supabase/migrations/</strong> are executed.</span>
        </div>
      </div>
    </div>
  )
}
