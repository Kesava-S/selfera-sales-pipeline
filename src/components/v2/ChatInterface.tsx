'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react'
import { sendOutboundMessage } from '@/app/(dashboard)/[oppId]/thread/[threadId]/actions'

export function ChatInterface({ thread, activeDraft }: { thread: any, activeDraft: any }) {
  const opp = thread.opportunities
  const b = opp.businesses
  const [isSending, setIsSending] = useState(false)
  const [draftBody, setDraftBody] = useState(activeDraft?.body || '')
  
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append('threadId', thread.id)
      formData.append('body', draftBody)
      if (activeDraft?.subject) formData.append('subject', activeDraft.subject)
      if (activeDraft?.template_id) formData.append('templateId', activeDraft.template_id)
      
      await sendOutboundMessage(formData)
      setDraftBody('') // Clear on success
    } catch (err) {
      console.error(err)
      alert('Failed to send message.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--card-border)] shrink-0">
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
                  {new Date(msg.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer Area */}
      <div className="shrink-0 pt-4 border-t border-[var(--card-border)]">
        {activeDraft ? (
          <form onSubmit={handleSend} className="card bg-gray-50 dark:bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2">
                <span className="badge bg-[var(--accent)]/10 text-[var(--accent)]">Draft: {activeDraft.step_label}</span>
                {activeDraft.status === 'needs_data' && (
                  <span className="text-amber-500 text-xs flex items-center gap-1">
                    <AlertCircle size={12} /> Missing data
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                Due: {new Date(activeDraft.due_on).toLocaleDateString()}
              </div>
            </div>
            
            {activeDraft.subject && (
              <div className="mb-2 font-medium text-sm border-b border-[var(--card-border)] pb-2">
                Subject: {activeDraft.subject}
              </div>
            )}
            
            <textarea
              className="w-full bg-transparent border-0 focus:ring-0 p-0 text-sm min-h-[100px] resize-y"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Type your message..."
            />
            
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--card-border)]">
              <div className="text-xs text-muted">
                Review this message before sending. The AI has drafted it based on your cadence.
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSending || !draftBody.trim()}
              >
                {isSending ? 'Sending...' : (
                  <>Send Message <Send size={16} className="ml-2" /></>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="card text-center py-6 text-muted bg-gray-50/50 dark:bg-white/5">
            <CheckCircle size={24} className="mx-auto mb-2 opacity-50" />
            <p>No active drafts due. Waiting for a reply.</p>
          </div>
        )}
      </div>
    </div>
  )
}
