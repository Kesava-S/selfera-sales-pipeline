import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only admins should create templates in a real app, but we allow anyone for now
    
    const { name, subject, body } = await request.json()

    if (!name || !body) {
      return NextResponse.json({ error: 'Name and body are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('templates')
      .insert({ name, subject: subject || null, body })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
