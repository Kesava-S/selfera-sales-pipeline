'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, MessageSquare, AlertCircle, CheckCircle, ChevronDown, ListPlus } from 'lucide-react'

export function ChatInterface({ thread, activeDraft, templates = [], allThreads = [] }: { thread: any, activeDraft: any, templates?: any[], allThreads?: any[] }) {
  const opp = thread.opportunities
  const b = opp.businesses
  const router = useRouter()
  const [isSending, setIsSending] = useState(false)
  const [draftBody, setDraftBody] = useState(activeDraft?.body || '')
  const [subject, setSubject] = useState(activeDraft?.subject || '')
  const [selectedTemplate, setSelectedTemplate] = useState(activeDraft?.template_id || '')
  
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: thread.id,
          body: draftBody,
          subject: subject || undefined,
          templateId: selectedTemplate || undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send')
      }
      
      setDraftBody('') // Clear on success
      setSubject('')
      setSelectedTemplate('')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to send message.')
    } finally {
      setIsSending(false)
    }
  }

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tId = e.target.value
    setSelectedTemplate(tId)
    const t = templates.find(temp => temp.id === tId)
    if (t) {
      setDraftBody(t.body)
      if (t.subject) setSubject(t.subject)
    }
  }

  const platforms = ['Email', 'WhatsApp', 'Instagram', 'Facebook']

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-4 border-b border-[var(--card-border)] shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/${opp.id}`} className="btn btn-outline btn-sm p-2">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-semibold text-lg">{b.business_name}</h1>
            <div className="text-sm text-muted flex items-center gap-2">
              <MessageSquare size={14} /> {thread.platform}
              <span>•</span>
              <span className={`badge ${
                thread.status === 'Replied' ? 'bg-green-500/10 text-green-500' :
                thread.status === 'Awaiting reply' ? 'bg-blue-500/10 text-blue-500' :
                'badge-neutral'
              }`}>{thread.status}</span>
              <span>•</span>
              <span>Step {thread.step}</span>
            </div>
          </div>
        </div>
        
        {/* Platform Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {platforms.map(p => {
            const existing = allThreads.find(t => t.platform === p)
            const isActive = thread.platform === p
            
            if (existing) {
              return (
                <Link 
                  key={p} 
                  href={`/dashboard/${opp.id}/thread/${existing.id}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'bg-[var(--accent)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p}
                </Link>
              )
            } else {
              // Could add an API route to create a new thread if needed, but for now just show disabled
              return (
                <button 
                  key={p} 
                  disabled
                  title={`No ${p} thread`}
                  className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-slate-50 text-slate-400 opacity-50 cursor-not-allowed border border-dashed border-slate-200"
                >
                  + {p}
                </button>
              )
            }
          })}
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-4">
        {thread.messages?.length === 0 && (
          <div className="text-center py-12 text-muted h-full flex flex-col items-center justify-center">
            <MessageSquare size={32} className="opacity-30 mb-4" />
            <p>No messages yet.</p>
          </div>
        )}
        
        {thread.messages?.map((msg: any) => {
          const isOutbound = msg.direction === 'outbound'
          const isSystem = msg.direction === 'system'

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <div className="bg-gray-100 dark:bg-white/5 rounded-full px-4 py-1 text-xs text-muted flex items-center gap-2">
                  <AlertCircle size={12} />
                  {msg.body}
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                isOutbound 
                  ? 'bg-[var(--accent)] text-white rounded-br-sm' 
                  : 'bg-gray-100 dark:bg-white/10 rounded-bl-sm'
              }`}>
                {msg.subject && <div className="font-semibold mb-1 text-sm opacity-90">{msg.subject}</div>}
                <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
                <div className={`text-[10px] mt-2 text-right ${isOutbound ? 'text-white/70' : 'text-muted'}`}>
                  {new Date(msg.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer Area */}
      <div className="shrink-0 pt-4 border-t border-[var(--card-border)]">
        <form onSubmit={handleSend} className="card bg-gray-50 dark:bg-[#0a0a0a]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
            <div className="font-semibold text-sm flex items-center gap-2">
              {activeDraft ? (
                <>
                  <span className="badge bg-[var(--accent)]/10 text-[var(--accent)]">Draft: {activeDraft.step_label}</span>
                  {activeDraft.status === 'needs_data' && (
                    <span className="text-amber-500 text-xs flex items-center gap-1">
                      <AlertCircle size={12} /> Missing data
                    </span>
                  )}
                </>
              ) : (
                <span className="badge badge-neutral">New Message</span>
              )}
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:min-w-[200px]">
                <ListPlus size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <select 
                  value={selectedTemplate}
                  onChange={handleTemplateSelect}
                  className="input w-full pl-8 py-1.5 text-xs bg-white dark:bg-black"
                >
                  <option value="">Insert template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {(subject || thread.platform === 'Email') && (
            <div className="mb-2">
              <input
                type="text"
                placeholder="Subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-transparent border-b border-[var(--card-border)] focus:ring-0 p-2 text-sm font-medium"
              />
            </div>
          )}
          
          <textarea
            className="w-full bg-transparent border-0 focus:ring-0 p-2 text-sm min-h-[100px] resize-y"
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="Type your message here..."
          />
          
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--card-border)]">
            <div className="text-xs text-muted">
              {activeDraft ? 'Review this message before sending. The system has drafted it based on your cadence.' : 'Write a custom message or pick a template above.'}
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSending || !draftBody.trim()}
            >
              {isSending ? 'Sending...' : (
                <>Send <Send size={16} className="ml-2" /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
