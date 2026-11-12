// What a reply looks like it says, sorted by free word rules in the database
// (migration 64, reply_intent). Labels only: staff still change the stage.

import { Ban, CalendarClock, HelpCircle, ThumbsDown, ThumbsUp } from 'lucide-react'

export type ReplyIntent = 'interested' | 'question' | 'not_interested' | 'opt_out' | 'out_of_office' | 'other'

export const REPLY_INTENTS: { key: Exclude<ReplyIntent, 'other'>; label: string; cls: string; icon: React.ReactNode }[] = [
  { key: 'interested', label: 'Interested', cls: 'text-emerald-700', icon: <ThumbsUp size={12} /> },
  { key: 'question', label: 'Question', cls: 'text-sky-700', icon: <HelpCircle size={12} /> },
  { key: 'not_interested', label: 'Not interested', cls: 'text-slate-500', icon: <ThumbsDown size={12} /> },
  { key: 'opt_out', label: 'Opt-out', cls: 'text-red-600', icon: <Ban size={12} /> },
  { key: 'out_of_office', label: 'Away', cls: 'text-amber-700', icon: <CalendarClock size={12} /> },
]

// Text-only label with an icon; nothing for "other" (couldn't tell)
export function ReplyIntentLabel({ intent, matched, className = '' }: { intent?: string | null; matched?: string | null; className?: string }) {
  const i = REPLY_INTENTS.find(x => x.key === intent)
  if (!i) return null
  const title = `Looks like: ${i.label}${matched ? ` (“${matched}”)` : ''}. Sorted automatically; change the stage yourself.`
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${i.cls} ${className}`} title={title}>
      {i.icon}{i.label}
    </span>
  )
}
