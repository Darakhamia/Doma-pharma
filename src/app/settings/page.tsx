'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, LogOut, User, ChevronRight, Moon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageHeader } from '@/components/layout/PageHeader'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState({ name: '', notify_expiry_days: 30, notify_low_qty: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notifSupported, setNotifSupported] = useState(false)
  const [notifGranted, setNotifGranted] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    setNotifSupported('Notification' in window && 'serviceWorker' in navigator)
    setNotifGranted(Notification.permission === 'granted')
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email || '')

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile({
        name: data.name || '',
        notify_expiry_days: data.notify_expiry_days || 30,
        notify_low_qty: data.notify_low_qty ?? true,
      })
    }
    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').upsert({
      id: user.id,
      name: profile.name,
      notify_expiry_days: profile.notify_expiry_days,
      notify_low_qty: profile.notify_low_qty,
    })
    setSaving(false)
  }

  async function enableNotifications() {
    setSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setSubscribing(false)
        return
      }
      setNotifGranted(true)

      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidKey) {
        setSubscribing(false)
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      })

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
    } catch (error) {
      console.error('Failed to enable notifications:', error)
    }
    setSubscribing(false)
  }

  async function disableNotifications() {
    setSubscribing(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
      await fetch('/api/notifications/subscribe', { method: 'DELETE' })
      setNotifGranted(false)
    } catch (error) {
      console.error('Failed to disable notifications:', error)
    }
    setSubscribing(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <PageHeader title="Настройки" />

      <div className="px-4 space-y-4">
        {/* Profile */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
            <div className="w-10 h-10 rounded-full bg-[#e8f7f2] flex items-center justify-center">
              <User size={20} className="text-[#1D9E75]" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{profile.name || 'Пользователь'}</p>
              <p className="text-xs text-gray-400">{email}</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <Input
              label="Имя"
              value={profile.name}
              onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="Ваше имя"
            />
            <Button onClick={saveProfile} loading={saving} variant="outline" fullWidth>
              Сохранить
            </Button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-gray-400" />
            <h3 className="font-medium text-gray-900">Уведомления</h3>
          </div>

          {notifSupported ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Push-уведомления</p>
                  <p className="text-xs text-gray-400">
                    {notifGranted ? 'Включены' : 'Выключены'}
                  </p>
                </div>
                <button
                  onClick={notifGranted ? disableNotifications : enableNotifications}
                  disabled={subscribing}
                  className={`relative w-12 h-6 rounded-full transition-colors ${notifGranted ? 'bg-[#1D9E75]' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifGranted ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {notifGranted && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Напоминать за сколько дней до истечения срока
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[7, 14, 30, 60, 90].map(days => (
                        <button
                          key={days}
                          onClick={() => setProfile(p => ({ ...p, notify_expiry_days: days }))}
                          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                            profile.notify_expiry_days === days
                              ? 'bg-[#1D9E75] text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {days} дн.
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Уведомления о малом количестве</p>
                      <p className="text-xs text-gray-400">Когда запасы заканчиваются</p>
                    </div>
                    <button
                      onClick={() => setProfile(p => ({ ...p, notify_low_qty: !p.notify_low_qty }))}
                      className={`relative w-12 h-6 rounded-full transition-colors ${profile.notify_low_qty ? 'bg-[#1D9E75]' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${profile.notify_low_qty ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <Button onClick={saveProfile} loading={saving} variant="outline" size="sm">
                    Сохранить настройки
                  </Button>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <BellOff size={16} />
              <p className="text-sm">Push-уведомления не поддерживаются в этом браузере</p>
            </div>
          )}
        </div>

        {/* App info */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="text-sm text-gray-600">Версия приложения</p>
            <p className="text-sm text-gray-400">1.0.0</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-gray-600">MedBag PWA</p>
            <p className="text-sm text-gray-400">Умная аптечка</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-4 py-4 bg-white rounded-2xl border border-gray-100 text-red-500 active:bg-red-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <LogOut size={18} />
            <span className="font-medium">Выйти из аккаунта</span>
          </div>
          <ChevronRight size={18} className="text-red-300" />
        </button>
      </div>

      <BottomNav />
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
