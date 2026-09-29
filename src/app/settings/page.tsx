'use client'

import React from 'react'
import { Calendar } from 'lucide-react'

export default function SettingsAndGuidePage() {
  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '0 0 0.2rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
            Outreach Cadence Rules
          </h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Standard operational timeline and cadence rules for lead follow-ups.
          </p>
        </div>
      </div>

      {/* Cadence Rules Table Card */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #bfdbfe',
            }}
          >
            <Calendar size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Follow-Up Cadence Schedule
            </h2>
            <p className="text-muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
              All cadence timings automatically skip non-working days and weekends.
            </p>
          </div>
        </div>

        <div className="table-container" style={{ marginTop: '1.5rem' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.85rem 1rem' }}>Event / Action</th>
                <th style={{ padding: '0.85rem 1rem' }}>Resulting Stage</th>
                <th style={{ padding: '0.85rem 1rem' }}>Next Scheduled Follow-up</th>
                <th style={{ padding: '0.85rem 1rem' }}>Cadence Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold" style={{ padding: '1rem' }}>Initial Outreach Sent</td>
                <td style={{ padding: '1rem' }}><span className="badge badge-stage-Contacted">Contacted</span></td>
                <td style={{ padding: '1rem', color: '#1e293b', fontWeight: 600 }}>+3 working days</td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>Follow-up 1 queued in Today&apos;s tasks</td>
              </tr>
              <tr>
                <td className="font-semibold" style={{ padding: '1rem' }}>Follow-up 1 Sent</td>
                <td style={{ padding: '1rem' }}><span className="badge badge-stage-Contacted">Contacted</span></td>
                <td style={{ padding: '1rem', color: '#1e293b', fontWeight: 600 }}>+5 working days</td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>Follow-up 2 queued in Today&apos;s tasks</td>
              </tr>
              <tr>
                <td className="font-semibold" style={{ padding: '1rem' }}>Follow-up 2 Sent</td>
                <td style={{ padding: '1rem' }}><span className="badge badge-stage-Contacted">Contacted</span></td>
                <td style={{ padding: '1rem', color: '#1e293b', fontWeight: 600 }}>+14 working days</td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>Final check follow-up scheduled</td>
              </tr>
              <tr>
                <td className="font-semibold" style={{ padding: '1rem' }}>Client Replied</td>
                <td style={{ padding: '1rem' }}><span className="badge badge-stage-Replied">Replied</span></td>
                <td style={{ padding: '1rem', color: '#64748b' }}>None (Cadence halts)</td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>Switches to active 1-on-1 sales dialogue</td>
              </tr>
              <tr>
                <td className="font-semibold" style={{ padding: '1rem' }}>Client Interested</td>
                <td style={{ padding: '1rem' }}><span className="badge badge-stage-Interested">Interested</span></td>
                <td style={{ padding: '1rem', color: '#b45309', fontWeight: 600 }}>+2 working days</td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>High-priority proposal / demo follow-up</td>
              </tr>
              <tr>
                <td className="font-semibold" style={{ padding: '1rem' }}>Deal Won</td>
                <td style={{ padding: '1rem' }}><span className="badge badge-stage-Won">Won</span></td>
                <td style={{ padding: '1rem', color: '#15803d', fontWeight: 600 }}>Cadence Completed</td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>Account successfully closed</td>
              </tr>
              <tr>
                <td className="font-semibold" style={{ padding: '1rem' }}>Final Check (No reply)</td>
                <td style={{ padding: '1rem' }}><span className="badge badge-stage-Lost">Lost</span></td>
                <td style={{ padding: '1rem', color: '#64748b' }}>Cadence halts</td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>Archived as unresponsive</td>
              </tr>
              <tr>
                <td className="font-semibold" style={{ padding: '1rem' }}>Opt-out / Do Not Contact</td>
                <td style={{ padding: '1rem' }}><span className="badge badge-stage-Do">Do not contact</span></td>
                <td style={{ padding: '1rem', color: '#b91c1c', fontWeight: 600 }}>Immediately halted</td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>All open tasks cancelled; no further outreach</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
