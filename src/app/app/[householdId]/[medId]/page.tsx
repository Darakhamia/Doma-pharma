'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Minus, Plus, Trash2, Edit3, Save, X, History, MapPin, Package, Calendar, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Medicine, MedicineLog } from '@/lib/supabase/types'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDate, formatRelativeDate, getExpiryStatus, getExpiryLabel, CATEGORIES, FORMS, QUANTITY_UNITS, cn } from '@/lib/utils'

interface LogWithProfile extends MedicineLog {
  profiles?: { name: string | null } | null
}

export default function MedicineDetailPage() {
  const params = useParams()
  const router = useRouter()
  const householdId = params.householdId as string
  const medId = params.medId as string
  const supabase = createClient()

  const [medicine, setMedicine] = useState<Medicine | null>(null)
  const [logs, setLogs] = useState<LogWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quantity, setQuantity] = useState(0)
  const [editData, setEditData] = useState<Partial<Medicine>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [medId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)

    const [{ data: med }, { data: logData }] = await Promise.all([
      supabase.from('medicines').select('*').eq('id', medId).single(),
      supabase
        .from('medicine_log')
        .select('*, profiles(name)')
        .eq('medicine_id', medId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (med) {
      setMedicine(med)
      setQuantity(med.quantity)
      setEditData(med)
    }
    setLogs(logData || [])
    setLoading(false)
  }

  async function updateQuantity(delta: number) {
    if (!medicine) return
    const newQty = Math.max(0, quantity + delta)
    setQuantity(newQty)

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('medicines').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', medId)
    await supabase.from('medicine_log').insert({
      medicine_id: medId,
      household_id: householdId,
      user_id: user?.id,
      action: 'taken',
      quantity_change: delta,
      note: delta > 0 ? 'Добавлено' : 'Использовано',
    })
    loadData()
  }

  async function handleSave() {
    if (!medicine) return
    setSaving(true)
    await supabase.from('medicines').update({
      ...editData,
      updated_at: new Date().toISOString(),
    }).eq('id', medId)
    setSaving(false)
    setEditing(false)
    loadData()
  }

  async function handleDelete() {
    if (!confirm('Удалить это лекарство из аптечки?')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('medicine_log').insert({
      medicine_id: medId,
      household_id: householdId,
      user_id: user?.id,
      action: 'removed',
    })
    await supabase.from('medicines').delete().eq('id', medId)
    router.push(`/app/${householdId}`)
  }

  const expiryStatus = getExpiryStatus(medicine?.expires_at)

  const actionLabels: Record<string, string> = {
    added: 'Добавлено',
    updated: 'Обновлено',
    taken: 'Изменено',
    removed: 'Удалено',
    expired: 'Истёкшее',
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
    </div>
  }

  if (!medicine) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Лекарство не найдено</p>
    </div>
  }

  const categoryOptions = CATEGORIES.map(c => ({ value: c, label: c }))
  const formOptions = FORMS.map(f => ({ value: f, label: f }))
  const unitOptions = QUANTITY_UNITS.map(u => ({ value: u, label: u }))

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-lg mx-auto">
        <PageHeader
          title={editing ? 'Редактирование' : medicine.name}
          backHref={`/app/${householdId}`}
          actions={
            editing ? (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl text-gray-600">
                  <X size={18} />
                </button>
                <button onClick={handleSave} className="w-9 h-9 flex items-center justify-center bg-[#1D9E75] rounded-xl text-white">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl text-gray-600">
                  <Edit3 size={18} />
                </button>
                <button onClick={handleDelete} className="w-9 h-9 flex items-center justify-center bg-red-50 rounded-xl text-red-500">
                  <Trash2 size={18} />
                </button>
              </div>
            )
          }
        />

        <div className="px-4 space-y-4">
          {editing ? (
            <>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
                <Input label="Название" value={editData.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />
                <Input label="Действующее вещество" value={editData.substance || ''} onChange={e => setEditData(p => ({ ...p, substance: e.target.value }))} />
                <Textarea label="От чего помогает" value={editData.purpose || ''} onChange={e => setEditData(p => ({ ...p, purpose: e.target.value }))} rows={2} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Категория" value={editData.category || ''} onChange={e => setEditData(p => ({ ...p, category: e.target.value }))} options={categoryOptions} placeholder="Выберите..." />
                  <Select label="Форма" value={editData.form || ''} onChange={e => setEditData(p => ({ ...p, form: e.target.value }))} options={formOptions} placeholder="Выберите..." />
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Количество" type="number" value={String(editData.quantity ?? 0)} onChange={e => setEditData(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))} min="0" step="0.5" />
                  <Select label="Единица" value={editData.quantity_unit || 'шт'} onChange={e => setEditData(p => ({ ...p, quantity_unit: e.target.value }))} options={unitOptions} />
                </div>
                <Input label="Порог низкого количества" type="number" value={String(editData.low_qty_threshold ?? 5)} onChange={e => setEditData(p => ({ ...p, low_qty_threshold: parseFloat(e.target.value) || 0 }))} min="0" />
                <Input label="Где лежит" value={editData.location || ''} onChange={e => setEditData(p => ({ ...p, location: e.target.value }))} />
                <Input label="Срок годности" type="date" value={editData.expires_at?.split('T')[0] || ''} onChange={e => setEditData(p => ({ ...p, expires_at: e.target.value }))} />
                <Textarea label="Заметки" value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
            </>
          ) : (
            <>
              {/* Main card */}
              <div className={cn(
                'bg-white rounded-2xl p-4 border border-l-4',
                expiryStatus === 'expired' ? 'border-l-red-500 border-gray-100' :
                expiryStatus === 'expiring-soon' ? 'border-l-orange-400 border-gray-100' : 'border-l-[#1D9E75] border-gray-100'
              )}>
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900">{medicine.name}</h2>
                    {medicine.substance && <p className="text-sm text-gray-500 mt-0.5">{medicine.substance}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {medicine.form && <Badge variant="gray">{medicine.form}</Badge>}
                    {medicine.category && <Badge variant="default">{medicine.category}</Badge>}
                  </div>
                </div>
                {medicine.purpose && (
                  <p className="text-gray-700 mt-3 text-sm leading-relaxed">{medicine.purpose}</p>
                )}
              </div>

              {/* Quantity */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-600">Количество</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(-1)} disabled={quantity <= 0}
                      className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-40 active:bg-gray-200">
                      <Minus size={16} />
                    </button>
                    <span className="text-xl font-bold text-gray-900 min-w-[60px] text-center">
                      {quantity % 1 === 0 ? quantity : quantity.toFixed(1)} {medicine.quantity_unit}
                    </span>
                    <button onClick={() => updateQuantity(1)}
                      className="w-9 h-9 rounded-xl bg-[#1D9E75] flex items-center justify-center text-white active:bg-[#158a63]">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                {quantity <= medicine.low_qty_threshold && (
                  <p className="text-xs text-orange-600 mt-2">⚠️ Осталось мало — пора пополнить</p>
                )}
              </div>

              {/* Info grid */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                {medicine.expires_at && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Calendar size={16} />
                      <span className="text-sm">Срок годности</span>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-medium',
                        expiryStatus === 'expired' ? 'text-red-600' :
                        expiryStatus === 'expiring-soon' ? 'text-orange-600' : 'text-gray-900'
                      )}>
                        {formatDate(medicine.expires_at)}
                      </p>
                      <p className="text-xs text-gray-400">{getExpiryLabel(medicine.expires_at)}</p>
                    </div>
                  </div>
                )}
                {medicine.location && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-500">
                      <MapPin size={16} />
                      <span className="text-sm">Где лежит</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{medicine.location}</span>
                  </div>
                )}
                {medicine.notes && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <FileText size={16} />
                      <span className="text-sm">Заметки</span>
                    </div>
                    <p className="text-sm text-gray-700">{medicine.notes}</p>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
                  Добавлено {formatRelativeDate(medicine.created_at)}
                </div>
              </div>

              {/* History */}
              {logs.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <History size={16} className="text-gray-400" />
                    <h3 className="font-medium text-gray-900 text-sm">История</h3>
                  </div>
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-1.5 h-1.5 rounded-full',
                            log.action === 'added' ? 'bg-green-500' :
                            log.action === 'removed' ? 'bg-red-500' :
                            log.action === 'taken' && (log.quantity_change || 0) < 0 ? 'bg-orange-500' : 'bg-blue-500'
                          )} />
                          <span className="text-gray-600">
                            {actionLabels[log.action]}
                            {log.quantity_change !== null && log.action === 'taken' && (
                              <span className={cn('ml-1 font-medium',
                                (log.quantity_change || 0) > 0 ? 'text-green-600' : 'text-orange-600'
                              )}>
                                {(log.quantity_change || 0) > 0 ? '+' : ''}{log.quantity_change}
                              </span>
                            )}
                          </span>
                          {log.profiles?.name && (
                            <span className="text-gray-400">· {log.profiles.name}</span>
                          )}
                        </div>
                        <span className="text-gray-400 text-xs">{formatRelativeDate(log.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
