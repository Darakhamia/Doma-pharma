import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  const { householdId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is owner
  const { data: memberRaw } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  const member = memberRaw as { role: string } | null

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = generateToken()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get('origin') ||
    `${request.nextUrl.protocol}//${request.headers.get('host')}`

  const { error } = await supabase.from('invites').insert({
    household_id: householdId,
    token,
    created_by: user.id,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }

  return NextResponse.json({ url: `${appUrl}/invite/${token}` })
}
