'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Search, Filter, AlertTriangle, Users, Plus, X, ChevronDown, Check, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Medicine, Household } from '@/lib/supabase/types'
import { BottomNav } from '@/components/layout/BottomNav'
import { MedicineCard } from '@/components/medicines/MedicineCard'
import { getExpiryStatus, getDaysUntilExpiry, CATEGORIES } from '@/lib/utils'

type FilterType = 'all' | 'expiring' | 'low' | 'expired'
type SortType = 'expires' | 'name' | 'category' | 'quantity'

interface HouseholdOption {
  id: string
  name: string
  icon: string
}

export default function HouseholdPage() {
  const params = useParams()
  const router = useRouter()
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
  const [allHouseholds, setAllHouseholds] = useState<HouseholdOption[]>([])
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: h }, { data: meds }, { data: member }, { data: members }] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).single(),
      supabase.from('medicines').select('*').eq('household_id', householdId).order('expires_at', { ascending: true, nullsFirst: false }),
      supabase.from('household_members').select('role').eq('household_id', householdId).eq('user_id', user.id).single(),
      supabase.from('household_members').select('household_id, households(id, name, icon)').eq('user_id', user.id),
    ])

    setHousehold(h)
    setMedicines(meds || [])
    setIsOwner(member?.role === 'owner')

    if (members) {
      const opts = members
        .map((m: any) => m.households as HouseholdOption)
        .filter(Boolean)
      setAllHouseholds(opts)
    }

    setLoading(false)
  }, [householdId])

  useEffect(() => {
    loadData()

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

  // Categories that actually appear in current medicines
  const usedCategories = [...new Set(medicines.map(m => m.category).filter(Boolean))] as string[]

  const filteredMedicines = medicines
    .filter(m => {
      const matchesSearch = !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.purpose && m.purpose.toLowerCase().includes(search.toLowerCase())) ||
        (m.substance && m.substance.toLowerCase().includes(search.toLowerCase()))

      if (!matchesSearch) return false

      if (categoryFilter && m.category !== categoryFilter) return false

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
            {/* Household switcher */}
            <div className="relative">
              <button
                onClick={() => setShowSwitcher(!showSwitcher)}
                className="flex items-center gap-1 group"
              >
                <div>
                  <h1 className="font-bold text-gray-900 text-xl leading-tight">{household?.name}</h1>
                  <p className="text-xs text-gray-500">{medicines.length} лекарств</p>
                </div>
                {allHouseholds.length > 1 && (
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 mt-1 transition-transform ${showSwitcher ? 'rotate-180' : ''}`}
                  />
                )}
              </button>

              {showSwitcher && allHouseholds.length > 1 && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSwitcher(false)}
                  />
                  {/* Dropdown */}
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    {allHouseholds.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setShowSwitcher(false)
                          if (h.id !== householdId) router.push(`/app/${h.id}`)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="text-xl">{h.icon}</span>
                        <span className="flex-1 text-sm font-medium text-gray-900 truncate">{h.name}</span>
                        {h.id === householdId && (
                          <Check size={15} className="text-[#1D9E75] flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    <div className="border-t border-gray-100">
                      <Link
                        href="/app/new"
                        onClick={() => setShowSwitcher(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Plus size={14} className="text-gray-500" />
                        </div>
                        <span className="text-sm text-gray-600">Новая аптечка</span>
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {warnings > 0 && (
              <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-full">
                <AlertTriangle size={12} className="text-orange-500" />
                <span className="text-xs font-medium text-orange-600">{warnings}</span>
              </div>
            )}
            <Link href={`/app/${householdId}/history`} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600">
              <History size={18} />
            </Link>
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

        {/* Category quick-filter */}
        {usedCategories.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
            {usedCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  categoryFilter === cat
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

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
