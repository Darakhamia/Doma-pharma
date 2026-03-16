'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Search, Filter, AlertTriangle, Users, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Medicine, Household } from '@/lib/supabase/types'
import { BottomNav } from '@/components/layout/BottomNav'
import { MedicineCard } from '@/components/medicines/MedicineCard'
import { getExpiryStatus, getDaysUntilExpiry } from '@/lib/utils'

type FilterType = 'all' | 'expiring' | 'low' | 'expired'
type SortType = 'expires' | 'name' | 'category' | 'quantity'

export default function HouseholdPage() {
  const params = useParams()
  const householdId = params.householdId as string
  const supabase = createClient()

  const [household, setHousehold] = useState<Household | null>(null)
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('expires')
  const [showFilters, setShowFilters] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: h }, { data: meds }, { data: member }] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).single(),
      supabase.from('medicines').select('*').eq('household_id', householdId).order('expires_at', { ascending: true, nullsFirst: false }),
      supabase.from('household_members').select('role').eq('household_id', householdId).eq('user_id', user.id).single(),
    ])

    setHousehold(h)
    setMedicines(meds || [])
    setIsOwner(member?.role === 'owner')
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    loadData()

    // Realtime subscription
    const channel = supabase
      .channel(`medicines:${householdId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'medicines',
        filter: `household_id=eq.${householdId}`,
      }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [householdId, loadData])

  const filteredMedicines = medicines
    .filter(m => {
      const matchesSearch = !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.purpose && m.purpose.toLowerCase().includes(search.toLowerCase())) ||
        (m.substance && m.substance.toLowerCase().includes(search.toLowerCase()))

      if (!matchesSearch) return false

      switch (filter) {
        case 'expired':
          return getExpiryStatus(m.expires_at) === 'expired'
        case 'expiring':
          return getExpiryStatus(m.expires_at) === 'expiring-soon'
        case 'low':
          return m.quantity <= m.low_qty_threshold
        default:
          return true
      }
    })
    .sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name, 'ru')
        case 'category':
          return (a.category || '').localeCompare(b.category || '', 'ru')
        case 'quantity':
          return a.quantity - b.quantity
        case 'expires':
        default:
          const dA = getDaysUntilExpiry(a.expires_at)
          const dB = getDaysUntilExpiry(b.expires_at)
          if (dA === null && dB === null) return 0
          if (dA === null) return 1
          if (dB === null) return -1
          return dA - dB
      }
    })

  const warnings = medicines.filter(m =>
    getExpiryStatus(m.expires_at) !== 'ok' || m.quantity <= m.low_qty_threshold
  ).length

  const filterLabels: Record<FilterType, string> = {
    all: 'Все',
    expiring: 'Истекают',
    low: 'Заканчиваются',
    expired: 'Истёкшие',
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
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{household?.icon}</span>
            <div>
              <h1 className="font-bold text-gray-900 text-xl">{household?.name}</h1>
              <p className="text-xs text-gray-500">{medicines.length} лекарств</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {warnings > 0 && (
              <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-full">
                <AlertTriangle size={12} className="text-orange-500" />
                <span className="text-xs font-medium text-orange-600">{warnings}</span>
              </div>
            )}
            <Link href={`/app/${householdId}/members`} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600">
              <Users size={18} />
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или назначению..."
            className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
          {(Object.keys(filterLabels) as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-[#1D9E75] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              showFilters ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Filter size={12} />
            Сортировка
          </button>
        </div>

        {/* Sort options */}
        {showFilters && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
            {([['expires', 'По сроку'], ['name', 'По названию'], ['category', 'По категории'], ['quantity', 'По количеству']] as [SortType, string][]).map(([s, label]) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${
                  sort === s ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Medicine list */}
      <div className="px-4 py-3 space-y-2">
        {filteredMedicines.length === 0 ? (
          <div className="text-center py-12">
            {search || filter !== 'all' ? (
              <>
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-gray-500">Ничего не найдено</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">💊</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Аптечка пуста</h3>
                <p className="text-gray-500 mb-6">Добавьте первое лекарство</p>
                <Link href={`/app/${householdId}/add`}>
                  <button className="bg-[#1D9E75] text-white px-6 py-3 rounded-xl font-medium">
                    <span className="flex items-center gap-2"><Plus size={18} /> Добавить лекарство</span>
                  </button>
                </Link>
              </>
            )}
          </div>
        ) : (
          filteredMedicines.map((med) => (
            <MedicineCard
              key={med.id}
              medicine={med}
              householdId={householdId}
              onQuantityChange={loadData}
            />
          ))
        )}
      </div>

      <BottomNav householdId={householdId} />
    </div>
  )
}
