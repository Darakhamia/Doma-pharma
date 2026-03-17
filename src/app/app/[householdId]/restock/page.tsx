'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ShoppingCart, CheckCircle2, Circle, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageHeader } from '@/components/layout/PageHeader'
import { getExpiryStatus } from '@/lib/utils'

interface RestockItem {
  id: string
  name: string
  quantity: number
  quantity_unit: string
  low_qty_threshold: number
  expires_at: string | null
  reason: 'low' | 'expired' | 'expiring'
  checked: boolean
}

export default function RestockPage() {
  const params = useParams()
  const householdId = params.householdId as string
  const supabase = createClient()

  const [items, setItems] = useState<RestockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const { data: meds } = await supabase
      .from('medicines')
      .select('id, name, quantity, quantity_unit, low_qty_threshold, expires_at')
      .eq('household_id', householdId)

    if (!meds) { setLoading(false); return }

    const list: RestockItem[] = []
    for (const m of meds) {
      const status = getExpiryStatus(m.expires_at)
      if (status === 'expired') {
        list.push({ ...m, reason: 'expired', checked: false })
      } else if (status === 'expiring-soon') {
        list.push({ ...m, reason: 'expiring', checked: false })
      } else if (m.quantity <= m.low_qty_threshold) {
        list.push({ ...m, reason: 'low', checked: false })
      }
    }

    // Sort: expired first, then expiring, then low
    list.sort((a, b) => {
      const order = { expired: 0, expiring: 1, low: 2 }
      return order[a.reason] - order[b.reason]
    })

    setItems(list)
    setLoading(false)
  }, [householdId])

  useEffect(() => { load() }, [load])

  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function shareList() {
    const unchecked = items.filter(i => !checked.has(i.id))
    const text = unchecked
      .map(i => {
        const label = i.reason === 'expired' ? '(истёк)' : i.reason === 'expiring' ? '(скоро истечёт)' : `(осталось ${i.quantity} ${i.quantity_unit})`
        return `• ${i.name} ${label}`
      })
      .join('\n')

    if (navigator.share) {
      await navigator.share({ title: 'Список покупок — аптечка', text })
    } else {
      await navigator.clipboard.writeText(text)
    }
  }

  const reasonLabel: Record<string, { text: string; color: string; bg: string }> = {
    expired: { text: 'Истёк', color: 'text-red-600', bg: 'bg-red-100' },
    expiring: { text: 'Скоро истечёт', color: 'text-orange-600', bg: 'bg-orange-100' },
    low: { text: 'Заканчивается', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  }

  const uncheckedCount = items.filter(i => !checked.has(i.id)).length

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <PageHeader
        title="Докупить"
        actions={items.length > 0 ? (
          <button
            onClick={shareList}
            className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600"
          >
            <Share2 size={18} />
          </button>
        ) : undefined}
      />

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Всё в порядке</h3>
            <p className="text-gray-500">Нет лекарств которые нужно докупить</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1 py-1">
              <p className="text-sm text-gray-500">
                {uncheckedCount > 0
                  ? `${uncheckedCount} позиций нужно купить`
                  : 'Все куплено 🎉'}
              </p>
              {checked.size > 0 && (
                <button
                  onClick={() => setChecked(new Set())}
                  className="text-xs text-gray-400 underline"
                >
                  Сбросить
                </button>
              )}
            </div>

            {items.map((item) => {
              const isChecked = checked.has(item.id)
              const badge = reasonLabel[item.reason]
              return (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`w-full flex items-center gap-3 bg-white rounded-2xl p-4 border transition-all text-left ${
                    isChecked ? 'border-gray-100 opacity-50' : 'border-gray-100'
                  }`}
                >
                  {isChecked
                    ? <CheckCircle2 size={22} className="text-[#1D9E75] flex-shrink-0" />
                    : <Circle size={22} className="text-gray-300 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${isChecked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.quantity} {item.quantity_unit} · порог {item.low_qty_threshold} {item.quantity_unit}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${badge.bg} ${badge.color}`}>
                    {badge.text}
                  </span>
                </button>
              )
            })}
          </>
        )}
      </div>

      <BottomNav householdId={householdId} />
    </div>
  )
}
