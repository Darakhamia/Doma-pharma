'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Minus, Plus, MapPin, ChevronRight } from 'lucide-react'
import { Medicine } from '@/lib/supabase/types'
import { getExpiryStatus, getExpiryLabel, formatDateShort, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'

interface MedicineCardProps {
  medicine: Medicine
  householdId: string
  onQuantityChange?: () => void
}

export function MedicineCard({ medicine, householdId, onQuantityChange }: MedicineCardProps) {
  const [quantity, setQuantity] = useState(medicine.quantity)
  const [updating, setUpdating] = useState(false)
  const supabase = createClient()

  const expiryStatus = getExpiryStatus(medicine.expires_at)
  const isLowQty = quantity <= medicine.low_qty_threshold

  const borderColors = {
    expired: 'border-l-red-500',
    'expiring-soon': 'border-l-orange-400',
    'expiring-later': 'border-l-yellow-400',
    ok: 'border-l-transparent',
  }

  const expiryBadgeVariant = {
    expired: 'danger' as const,
    'expiring-soon': 'warning' as const,
    'expiring-later': 'info' as const,
    ok: 'gray' as const,
  }

  async function updateQuantity(delta: number) {
    const newQty = Math.max(0, quantity + delta)
    setQuantity(newQty) // optimistic update
    setUpdating(true)

    const { data: { user } } = await supabase.auth.getUser()

    await supabase
      .from('medicines')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', medicine.id)

    await supabase.from('medicine_log').insert({
      medicine_id: medicine.id,
      household_id: householdId,
      user_id: user?.id,
      action: 'taken',
      quantity_change: delta,
      note: delta > 0 ? 'Добавлено' : 'Использовано',
    })

    setUpdating(false)
    onQuantityChange?.()
  }

  return (
    <div className={cn(
      'bg-white rounded-2xl border border-gray-100 border-l-4 overflow-hidden card-hover',
      borderColors[expiryStatus]
    )}>
      <Link href={`/app/${householdId}/${medicine.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base">{medicine.name}</h3>
              {medicine.form && (
                <Badge variant="gray">{medicine.form}</Badge>
              )}
              {medicine.category && (
                <Badge variant="default">{medicine.category}</Badge>
              )}
            </div>
            {medicine.substance && (
              <p className="text-xs text-gray-500 mt-0.5">{medicine.substance}</p>
            )}
            {medicine.purpose && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{medicine.purpose}</p>
            )}
          </div>
          <ChevronRight size={18} className="text-gray-300 flex-shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {medicine.expires_at && (
            <div className={cn(
              'flex items-center gap-1',
              expiryStatus === 'expired' ? 'text-red-600' :
              expiryStatus === 'expiring-soon' ? 'text-orange-600' : 'text-gray-500'
            )}>
              <span className="text-xs">
                {expiryStatus === 'expired' ? '⚠️' : '📅'}
              </span>
              <span className="text-xs font-medium">{getExpiryLabel(medicine.expires_at)}</span>
            </div>
          )}
          {medicine.location && (
            <div className="flex items-center gap-1 text-gray-400">
              <MapPin size={11} />
              <span className="text-xs">{medicine.location}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Quantity controls */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <span className={cn('text-sm font-semibold', isLowQty ? 'text-orange-600' : 'text-gray-900')}>
            {quantity % 1 === 0 ? quantity : quantity.toFixed(1)} {medicine.quantity_unit}
          </span>
          {isLowQty && <span className="text-xs text-orange-500">• мало</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.preventDefault(); updateQuantity(-1) }}
            disabled={updating || quantity <= 0}
            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-40 active:bg-gray-100 transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); updateQuantity(1) }}
            disabled={updating}
            className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center text-white active:bg-[#158a63] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
