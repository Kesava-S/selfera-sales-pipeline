'use client'

import Link from 'next/link'
import { ArrowLeft, Building2, Phone, Mail, Camera, ExternalLink, MessageSquare, History, Clock } from 'lucide-react'

export function BusinessDetail({ opp }: { opp: any }) {
  const b = opp.businesses

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="btn btn-outline btn-sm p-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-semibold text-2xl">{b.business_name}</h1>
            <div className="text-sm text-muted flex items-center gap-2 mt-1">
              <span>{b.business_type}</span>
              {b.tier && <span>•</span>}
              {b.tier && <span>{b.tier}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge text-base px-3 py-1 ${
            opp.stage === 'Won' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
            opp.stage === 'Interested' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
            opp.stage === 'Needs review' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
            opp.stage === 'No response' ? 'bg-gray-500/10 text-gray-500 border-gray-500/20' :
            'badge-neutral border-[var(--card-border)]'
          }`}>{opp.stage}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COL: Business Info & History */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Building2 size={18} /> Company Details
            </h2>
            
            <div className="space-y-4">
              {b.contact_name && (
                <div>
                  <div className="text-xs text-muted uppercase">Contact Name</div>
                  <div className="font-medium">{b.contact_name}</div>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <div className="text-xs text-muted uppercase">Contact Channels</div>
                {b.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-muted" /> {b.phone}
                  </div>
                )}
                {b.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-muted" /> {b.email}
                  </div>
                )}
                {b.instagram && (
                  <div className="flex items-center gap-2">
                    <Camera size={14} className="text-muted" /> {b.instagram}
                  </div>
                )}
              </div>

              {b.area && (
                <div>
                  <div className="text-xs text-muted uppercase">Location</div>
                  <div className="font-medium">{b.address || b.area} {b.postcode && `, ${b.postcode}`}</div>
                </div>
              )}

              {b.maps_link && (
                <a href={b.maps_link} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1">
                  View on Google Maps <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          <div className="card flex-1">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <History size={18} /> Opportunity History
            </h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[var(--card-border)] before:to-transparent">
              {opp.stage_changes?.map((change: any, i: number) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-[var(--accent)] text-slate-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  </div>
                  <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded border border-[var(--card-border)] bg-gray-50/50 dark:bg-white/5 shadow">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                      <div className="font-medium text-sm text-[var(--foreground)]">{change.to_stage}</div>
                      <time className="text-xs font-medium text-muted">{new Date(change.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                    </div>
                    <div className="text-xs text-muted">{change.reason}</div>
                  </div>
                </div>
              ))}
              {(!opp.stage_changes || opp.stage_changes.length === 0) && (
                <div className="text-sm text-muted italic pl-6">No stage changes recorded.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COL: Threads / Outreach */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <MessageSquare size={18} /> Communication Threads
              </h2>
              <button className="btn btn-outline btn-sm">Start New Thread</button>
            </div>

            <div className="flex flex-col gap-3">
              {opp.threads?.length === 0 ? (
                <div className="text-center py-8 text-muted border border-dashed border-[var(--card-border)] rounded-lg">
                  No outreach started yet.
                </div>
              ) : (
                opp.threads?.map((t: any) => {
                  const activeDraft = t.drafts?.find((d: any) => d.status !== 'sent')
                  
                  return (
                    <Link 
                      key={t.id} 
                      href={`/dashboard/${opp.id}/thread/${t.id}`}
                      className="p-4 rounded-lg border border-[var(--card-border)] hover:border-[var(--accent)] transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/30 dark:bg-white/5"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg group-hover:text-[var(--accent)] transition-colors">{t.platform}</span>
                          <span className="text-xs text-muted">• Step {t.step}</span>
                        </div>
                        <div className="text-sm text-muted">Status: <span className="font-medium text-foreground">{t.status}</span></div>
                      </div>
                      
                      <div className="flex flex-col sm:items-end gap-2 text-sm">
                        {t.next_due_on && (
                          <div className={`flex items-center gap-1 ${new Date(t.next_due_on) <= new Date() ? 'text-amber-500 font-medium' : 'text-muted'}`}>
                            <Clock size={14} /> Due: {new Date(t.next_due_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                        {activeDraft && (
                          <span className="badge bg-blue-500/10 text-blue-500">
                            Draft ready: {activeDraft.step_label}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
