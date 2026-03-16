'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Household } from '@/lib/supabase/types'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

interface HouseholdWithStats extends Household {
  medicine_count: number
  expiring_count: number
  low_qty_count: number
  role: 'owner' | 'member'
}

export default function AppPage() {
  const router = useRouter()
  const [households, setHouseholds] = useState<HouseholdWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    setUserName(profile?.name || user.email?.split('@')[0] || 'Пользователь')

    // Get households with member role
    const { data: members } = await supabase
      .from('household_members')
      .select('household_id, role, households(*)')
      .eq('user_id', user.id)

    if (!members) {
      setLoading(false)
      return
    }

    // Get stats for each household
    const householdsWithStats = await Promise.all(
      members.map(async (member) => {
        const h = member.households as unknown as Household
        const today = new Date().toISOString().split('T')[0]
        const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        const { count: medicineCount } = await supabase
          .from('medicines')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', h.id)

        const { count: expiringCount } = await supabase
          .from('medicines')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', h.id)
          .lte('expires_at', in30Days)
          .gte('expires_at', today)

        const { data: lowQtyMeds } = await supabase
          .from('medicines')
          .select('quantity, low_qty_threshold')
          .eq('household_id', h.id)

        const lowQtyCount = (lowQtyMeds || []).filter(
          m => m.quantity <= m.low_qty_threshold
        ).length

        return {
          ...h,
          medicine_count: medicineCount || 0,
          expiring_count: expiringCount || 0,
          low_qty_count: lowQtyCount,
          role: member.role as 'owner' | 'member',
        }
      })
    )

    setHouseholds(householdsWithStats)
    setLoading(false)
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Доброе утро'
    if (hour < 18) return 'Добрый день'
    return 'Добрый вечер'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <p className="text-sm text-gray-500">{greeting()},</p>
        <h1 className="text-2xl font-bold text-gray-900">{userName} 👋</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Мои аптечки</h2>
          <Link href="/app/new">
            <Button size="sm" variant="outline">
              <Plus size={16} />
              Создать
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : households.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">💊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет аптечек</h3>
            <p className="text-gray-500 mb-6">Создайте первую аптечку или присоединитесь по ссылке-приглашению</p>
            <Link href="/app/new">
              <Button>
                <Plus size={18} />
                Создать аптечку
              </Button>
            </Link>
          </div>
        ) : (
          households.map((h) => (
            <Link key={h.id} href={`/app/${h.id}`}>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 card-hover flex items-center gap-3">
                <div className="w-12 h-12 bg-[#e8f7f2] rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {h.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{h.name}</h3>
                    {h.role === 'owner' && (
                      <span className="text-xs bg-[#e8f7f2] text-[#1D9E75] px-2 py-0.5 rounded-full font-medium">
                        Владелец
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {h.medicine_count} {h.medicine_count === 1 ? 'лекарство' : h.medicine_count < 5 ? 'лекарства' : 'лекарств'}
                  </p>
                  {(h.expiring_count > 0 || h.low_qty_count > 0) && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle size={12} className="text-orange-500" />
                      <span className="text-xs text-orange-600">
                        {h.expiring_count > 0 && `${h.expiring_count} истекает`}
                        {h.expiring_count > 0 && h.low_qty_count > 0 && ' · '}
                        {h.low_qty_count > 0 && `${h.low_qty_count} заканчивается`}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
              </div>
            </Link>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  )
}
