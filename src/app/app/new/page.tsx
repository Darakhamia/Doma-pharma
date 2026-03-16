'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/layout/PageHeader'

const ICONS = ['💊', '🏥', '🏠', '🏡', '🌿', '❤️', '🧴', '💉', '🩺', '⚕️']

export default function NewHouseholdPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💊')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: household, error: createError } = await supabase
      .from('households')
      .insert({ name: name.trim(), icon, owner_id: user.id })
      .select()
      .single()

    if (createError || !household) {
      setError('Ошибка создания аптечки')
      setLoading(false)
      return
    }

    // Add owner as member
    await supabase.from('household_members').insert({
      household_id: household.id,
      user_id: user.id,
      role: 'owner',
    })

    router.push(`/app/${household.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto">
        <PageHeader title="Новая аптечка" backHref="/app" />

        <form onSubmit={handleCreate} className="px-4 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Icon selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Иконка</label>
            <div className="grid grid-cols-5 gap-2">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`h-12 rounded-xl text-2xl transition-all ${
                    icon === i
                      ? 'bg-[#e8f7f2] border-2 border-[#1D9E75] scale-105'
                      : 'bg-white border-2 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Дом, Дача, Офис..."
            required
            autoFocus
          />

          {/* Preview */}
          {name && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Предпросмотр</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#e8f7f2] rounded-xl flex items-center justify-center text-2xl">
                  {icon}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-sm text-gray-500">0 лекарств</p>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Создать аптечку
          </Button>
        </form>
      </div>
    </div>
  )
}
