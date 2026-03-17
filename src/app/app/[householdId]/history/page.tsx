'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { BottomNav } from '@/components/layout/BottomNav'
import { formatRelativeDate, cn } from '@/lib/utils'

interface LogEntry {
  id: string
  action: 'added' | 'updated' | 'taken' | 'removed' | 'expired'
  quantity_change: number | null
  note: string | null
  created_at: string
  medicines: { name: string; photo_url: string | null } | null
  profiles: { name: string | null } | null
}

const actionConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  added:   { label: 'Добавлено',  dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
  removed: { label: 'Удалено',    dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700' },
  taken:   { label: 'Изменено',   dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  updated: { label: 'Обновлено',  dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
  expired: { label: 'Истёкшее',   dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
}

function groupByDay(entries: LogEntry[]) {
  const groups: Record<string, LogEntry[]> = {}
  for (const entry of entries) {
    const day = entry.created_at.split('T')[0]
    if (!groups[day]) groups[day] = []
    groups[day].push(entry)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

function formatDay(day: string) {
  const d = new Date(day)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Сегодня'
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export default function HistoryPage() {
  const params = useParams()
  const householdId = params.householdId as string
  const supabase = createClient()

  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 30

  const load = useCallback(async (pageNum: number) => {
    if (pageNum > 0) setLoadingMore(true)
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data } = await supabase
      .from('medicine_log')
      .select('*, medicines(name, photo_url), profiles(name)')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .range(from, to)

    const rows = (data || []) as LogEntry[]
    if (pageNum === 0) {
      setEntries(rows)
    } else {
      setEntries(prev => [...prev, ...rows])
    }
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [householdId])

  useEffect(() => { load(0) }, [load])

  const grouped = groupByDay(entries)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <PageHeader title="История изменений" backHref={`/app/${householdId}`} />

      <div className="px-4 space-y-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">История пуста</h3>
            <p className="text-gray-500">Изменения появятся здесь</p>
          </div>
        ) : (
          <>
            {grouped.map(([day, dayEntries]) => (
              <div key={day}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">
                  {formatDay(day)}
                </p>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                  {dayEntries.map((entry) => {
                    const cfg = actionConfig[entry.action] || actionConfig.updated
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        {/* Medicine photo or dot */}
                        {entry.medicines?.photo_url ? (
                          <img
                            src={entry.medicines.photo_url}
                            alt={entry.medicines.name || ''}
                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <div className={cn('w-2.5 h-2.5 rounded-full', cfg.dot)} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {entry.medicines?.name || 'Лекарство удалено'}
                          </p>
                          <p className="text-xs text-gray-400">
                            <span className={cn('font-medium', cfg.text)}>{cfg.label}</span>
                            {entry.quantity_change !== null && entry.action === 'taken' && (
                              <span className={cn('ml-1 font-medium',
                                (entry.quantity_change || 0) > 0 ? 'text-green-600' : 'text-orange-600'
                              )}>
                                {(entry.quantity_change || 0) > 0 ? '+' : ''}{entry.quantity_change}
                              </span>
                            )}
                            {entry.profiles?.name && (
                              <span className="text-gray-300"> · {entry.profiles.name}</span>
                            )}
                          </p>
                        </div>
                        <span className="text-xs text-gray-300 flex-shrink-0">
                          {new Date(entry.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => { const next = page + 1; setPage(next); load(next) }}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 active:bg-gray-50"
              >
                {loadingMore ? 'Загрузка...' : 'Показать ещё'}
              </button>
            )}
          </>
        )}
      </div>

      <BottomNav householdId={householdId} />
    </div>
  )
}
