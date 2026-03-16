'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

type Status = 'loading' | 'success' | 'expired' | 'already' | 'error'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const supabase = createClient()

  const [status, setStatus] = useState<Status>('loading')
  const [householdName, setHouseholdName] = useState('')

  useEffect(() => {
    acceptInvite()
  }, [token])

  async function acceptInvite() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/auth/login?invite=${token}`)
      return
    }

    // Get invite
    const { data: invite, error } = await supabase
      .from('invites')
      .select('*, households(name)')
      .eq('token', token)
      .single()

    if (error || !invite) {
      setStatus('error')
      return
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      setStatus('expired')
      return
    }

    const household = invite.households as { name: string } | null
    setHouseholdName(household?.name || 'Аптечка')

    // Check if already a member
    const { data: existing } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', invite.household_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      setStatus('already')
      setTimeout(() => router.push(`/app/${invite.household_id}`), 2000)
      return
    }

    // Add as member
    const { error: memberError } = await supabase
      .from('household_members')
      .insert({
        household_id: invite.household_id,
        user_id: user.id,
        role: 'member',
      })

    if (memberError) {
      setStatus('error')
      return
    }

    // Mark invite as used
    await supabase
      .from('invites')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('id', invite.id)

    setStatus('success')
    setTimeout(() => router.push(`/app/${invite.household_id}`), 2500)
  }

  const content = {
    loading: {
      icon: <div className="w-16 h-16 border-4 border-[#1D9E75] border-t-transparent rounded-full animate-spin mx-auto" />,
      title: 'Обработка приглашения...',
      subtitle: 'Подождите немного',
    },
    success: {
      icon: <CheckCircle size={64} className="text-[#1D9E75] mx-auto" />,
      title: 'Вы присоединились!',
      subtitle: `Теперь у вас есть доступ к аптечке «${householdName}»`,
    },
    already: {
      icon: <CheckCircle size={64} className="text-gray-400 mx-auto" />,
      title: 'Вы уже участник',
      subtitle: `Открываем аптечку «${householdName}»...`,
    },
    expired: {
      icon: <Clock size={64} className="text-orange-400 mx-auto" />,
      title: 'Ссылка устарела',
      subtitle: 'Срок действия ссылки-приглашения истёк. Попросите создать новую.',
    },
    error: {
      icon: <XCircle size={64} className="text-red-400 mx-auto" />,
      title: 'Ссылка недействительна',
      subtitle: 'Эта ссылка не существует или уже была использована.',
    },
  }

  const c = content[status]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-4">{c.icon}</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{c.title}</h1>
        <p className="text-gray-500 mb-6">{c.subtitle}</p>
        {(status === 'expired' || status === 'error') && (
          <Button onClick={() => router.push('/app')} fullWidth>
            На главную
          </Button>
        )}
      </div>
    </div>
  )
}
