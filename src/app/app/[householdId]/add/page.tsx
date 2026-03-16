'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Search, Sparkles, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/layout/PageHeader'
import { CATEGORIES, FORMS, QUANTITY_UNITS } from '@/lib/utils'

interface MedicineData {
  name: string
  substance: string
  purpose: string
  category: string
  form: string
  quantity: string
  quantity_unit: string
  low_qty_threshold: string
  location: string
  expires_at: string
  notes: string
}

export default function AddMedicinePage() {
  const params = useParams()
  const router = useRouter()
  const householdId = params.householdId as string
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [aiFound, setAiFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [data, setData] = useState<MedicineData>({
    name: '',
    substance: '',
    purpose: '',
    category: '',
    form: '',
    quantity: '1',
    quantity_unit: 'шт',
    low_qty_threshold: '5',
    location: '',
    expires_at: '',
    notes: '',
  })

  function update(field: keyof MedicineData, value: string) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSearchChange(query: string) {
    setSearchQuery(query)
    update('name', query)
    setAiFound(false)

    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (query.length < 2) return

    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch('/api/medicine/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        const result = await res.json()
        if (result.found) {
          setData(prev => ({
            ...prev,
            name: result.name || prev.name,
            substance: result.substance || prev.substance,
            purpose: result.purpose || prev.purpose,
            category: result.category || prev.category,
            form: result.form || prev.form,
            quantity_unit: result.typical_quantity_unit || prev.quantity_unit,
          }))
          setAiFound(true)
        }
      } catch {}
      setSearching(false)
    }, 700)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!data.name.trim()) {
      setError('Введите название лекарства')
      return
    }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { data: med, error: saveError } = await supabase
      .from('medicines')
      .insert({
        household_id: householdId,
        name: data.name.trim(),
        substance: data.substance || null,
        purpose: data.purpose || null,
        category: data.category || null,
        form: data.form || null,
        quantity: parseFloat(data.quantity) || 0,
        quantity_unit: data.quantity_unit || 'шт',
        low_qty_threshold: parseFloat(data.low_qty_threshold) || 5,
        location: data.location || null,
        expires_at: data.expires_at || null,
        notes: data.notes || null,
        added_by: user?.id,
      })
      .select()
      .single()

    if (saveError || !med) {
      setError('Ошибка при сохранении')
      setSaving(false)
      return
    }

    // Log addition
    await supabase.from('medicine_log').insert({
      medicine_id: med.id,
      household_id: householdId,
      user_id: user?.id,
      action: 'added',
      quantity_change: parseFloat(data.quantity) || 0,
    })

    router.push(`/app/${householdId}`)
  }

  const categoryOptions = CATEGORIES.map(c => ({ value: c, label: c }))
  const formOptions = FORMS.map(f => ({ value: f, label: f }))
  const unitOptions = QUANTITY_UNITS.map(u => ({ value: u, label: u }))

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-lg mx-auto">
        <PageHeader title="Добавить лекарство" backHref={`/app/${householdId}`} />

        <form onSubmit={handleSave} className="px-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {/* AI search */}
          <div className="relative">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Название лекарства (AI заполнит данные)"
                className="w-full pl-9 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {searching ? (
                  <svg className="animate-spin h-4 w-4 text-[#1D9E75]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : aiFound ? (
                  <CheckCircle size={16} className="text-[#1D9E75]" />
                ) : null}
              </div>
            </div>
            {aiFound && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-[#1D9E75]">
                <Sparkles size={11} />
                <span>AI заполнил данные автоматически</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
            <h3 className="font-medium text-gray-900 text-sm">Основная информация</h3>

            <Input
              label="Название *"
              value={data.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Нурофен"
              required
            />

            <Input
              label="Действующее вещество"
              value={data.substance}
              onChange={(e) => update('substance', e.target.value)}
              placeholder="Ибупрофен 400 мг"
            />

            <Textarea
              label="От чего помогает"
              value={data.purpose}
              onChange={(e) => update('purpose', e.target.value)}
              placeholder="Обезболивающее, жаропонижающее, противовоспалительное"
              rows={2}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Категория"
                value={data.category}
                onChange={(e) => update('category', e.target.value)}
                options={categoryOptions}
                placeholder="Выберите..."
              />
              <Select
                label="Форма выпуска"
                value={data.form}
                onChange={(e) => update('form', e.target.value)}
                options={formOptions}
                placeholder="Выберите..."
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
            <h3 className="font-medium text-gray-900 text-sm">Количество и место</h3>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Количество"
                type="number"
                value={data.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                min="0"
                step="0.5"
              />
              <Select
                label="Единица"
                value={data.quantity_unit}
                onChange={(e) => update('quantity_unit', e.target.value)}
                options={unitOptions}
              />
            </div>

            <Input
              label="Порог низкого количества"
              type="number"
              value={data.low_qty_threshold}
              onChange={(e) => update('low_qty_threshold', e.target.value)}
              min="0"
              step="1"
              hint="Уведомление когда осталось меньше этого"
            />

            <Input
              label="Где лежит"
              value={data.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="Верхняя полка, Ванная..."
            />
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
            <h3 className="font-medium text-gray-900 text-sm">Срок годности и заметки</h3>

            <Input
              label="Срок годности"
              type="date"
              value={data.expires_at}
              onChange={(e) => update('expires_at', e.target.value)}
            />

            <Textarea
              label="Заметки"
              value={data.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Дополнительные заметки..."
              rows={2}
            />
          </div>

          <Button type="submit" fullWidth size="lg" loading={saving}>
            Сохранить лекарство
          </Button>
        </form>
      </div>
    </div>
  )
}
