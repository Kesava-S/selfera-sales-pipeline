'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SettingsManager({ cadenceRules = [] }: { cadenceRules: any[] }) {
  const router = useRouter()
  const [rules, setRules] = useState(cadenceRules)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings/cadence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
      })
      if (!res.ok) throw new Error('Failed to save settings')
      alert('Settings saved successfully!')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (id: string, days: number) => {
    setRules(rules.map(r => r.id === id ? { ...r, days_delay: days } : r))
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-semibold text-2xl">Settings</h1>
      </div>

      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Cadence Rules</h2>
        <p className="text-sm text-muted mb-6">
          Configure the default number of days to wait between follow-up steps.
        </p>

        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-sm text-muted p-4 bg-slate-50 dark:bg-white/5 rounded-lg">
              No cadence rules found. Please run the `20_v2_cadence_rules.sql` migration in your Supabase SQL editor.
            </div>
          ) : (
            rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between p-4 border border-[var(--card-border)] rounded-lg">
                <div>
                  <div className="font-medium">{rule.step_name}</div>
                  <div className="text-sm text-muted">{rule.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="1"
                    max="365"
                    value={rule.days_delay}
                    onChange={(e) => handleChange(rule.id, parseInt(e.target.value) || 1)}
                    className="input w-20 text-center"
                  />
                  <span className="text-sm text-muted">days</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 flex justify-end pt-4 border-t border-[var(--card-border)]">
          <button 
            onClick={handleSave} 
            disabled={isSaving || rules.length === 0}
            className="btn btn-primary"
          >
            <Save size={16} className="mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
