'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Check, AlertTriangle } from 'lucide-react'
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
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: members } = await supabase
      .from('household_members')
      .select('household_id, role, households(*)')
      .eq('user_id', user.id)

    if (!members || members.length === 0) {
      setLoading(false)
      return
    }

    // Auto-redirect if only one household
    if (members.length === 1) {
      const h = members[0].households as unknown as Household
      router.replace(`/app/${h.id}`)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const householdsWithStats = await Promise.all(
      members.map(async (member) => {
        const h = member.households as unknown as Household

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 pt-12 pb-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Мои аптечки</h1>
        <p className="text-sm text-gray-500 mt-1">Выберите аптечку</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {households.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">💊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет аптечек</h3>
            <p className="text-gray-500 mb-6">Создайте первую или присоединитесь по ссылке</p>
            <Link href="/app/new">
              <Button>
                <Plus size={18} />
                Создать аптечку
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {households.map((h) => (
              <Link key={h.id} href={`/app/${h.id}`}>
                <div className="bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50 transition-colors flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#e8f7f2] rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                    {h.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-gray-900 text-base truncate">{h.name}</h3>
                      {h.role === 'owner' && (
                        <span className="text-xs bg-[#e8f7f2] text-[#1D9E75] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                          Моя
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
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
                  <Check size={20} className="text-gray-200 flex-shrink-0" />
                </div>
              </Link>
            ))}

            <Link href="/app/new">
              <div className="flex items-center gap-4 px-4 py-4 bg-white rounded-2xl border border-dashed border-gray-200 active:bg-gray-50 transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Plus size={22} className="text-gray-400" />
                </div>
                <span className="text-sm font-medium text-gray-500">Создать новую аптечку</span>
              </div>
            </Link>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
