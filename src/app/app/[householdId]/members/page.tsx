'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Copy, Check, UserX, Crown, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'

interface Member {
  id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  profiles: { name: string | null; avatar_url: string | null } | null
}

export default function MembersPage() {
  const params = useParams()
  const householdId = params.householdId as string
  const supabase = createClient()

  const [members, setMembers] = useState<Member[]>([])
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    loadData()
  }, [householdId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: memberData } = await supabase
      .from('household_members')
      .select('*, profiles(name, avatar_url)')
      .eq('household_id', householdId)
      .order('joined_at')

    setMembers((memberData || []) as Member[])
    const myRole = memberData?.find(m => m.user_id === user.id)?.role
    setIsOwner(myRole === 'owner')
    setLoading(false)
  }

  async function createInvite() {
    setCreatingInvite(true)
    const res = await fetch(`/api/household/${householdId}/invite`, { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      setInviteUrl(data.url)
    }
    setCreatingInvite(false)
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function removeMember(userId: string) {
    if (!confirm('Удалить участника из аптечки?')) return
    await supabase
      .from('household_members')
      .delete()
      .eq('household_id', householdId)
      .eq('user_id', userId)
    loadData()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-lg mx-auto">
        <PageHeader title="Участники" backHref={`/app/${householdId}`} />

        <div className="px-4 space-y-4">
          {/* Invite section */}
          {isOwner && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3">Пригласить участника</h3>
              {inviteUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 flex-1 break-all font-mono">{inviteUrl}</p>
                    <button
                      onClick={copyInvite}
                      className="flex-shrink-0 w-8 h-8 bg-[#1D9E75] rounded-lg flex items-center justify-center text-white"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Ссылка действует 7 дней</p>
                </div>
              ) : (
                <Button onClick={createInvite} loading={creatingInvite} variant="outline" fullWidth>
                  Создать ссылку-приглашение
                </Button>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h3 className="font-medium text-gray-900 text-sm">{members.length} участников</h3>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-[#e8f7f2] flex items-center justify-center flex-shrink-0">
                      {member.role === 'owner' ? (
                        <Crown size={18} className="text-[#1D9E75]" />
                      ) : (
                        <User size={18} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {member.profiles?.name || 'Пользователь'}
                        {member.user_id === currentUserId && (
                          <span className="text-gray-400 font-normal"> (вы)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {member.role === 'owner' ? 'Владелец' : 'Участник'}
                      </p>
                    </div>
                    {isOwner && member.role !== 'owner' && member.user_id !== currentUserId && (
                      <button
                        onClick={() => removeMember(member.user_id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <UserX size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
