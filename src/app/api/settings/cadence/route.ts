import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rules } = await request.json()

    if (!rules || !Array.isArray(rules)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // In a real app we'd validate permissions
    for (const rule of rules) {
      await supabase
        .from('cadence_rules')
        .update({ days_delay: rule.days_delay })
        .eq('id', rule.id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
