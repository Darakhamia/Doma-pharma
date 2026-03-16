'use client'

import { useEffect, useState, useRef } from 'react'
import { Send, Bot, User, AlertCircle, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { Household } from '@/lib/supabase/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function GeneralAssistantPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Привет! Я помощник вашей аптечки 👋\n\nОпишите симптомы — подберу что-нибудь из аптечки или посоветую что купить.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedHousehold, setSelectedHousehold] = useState<string>('')
  const [showPicker, setShowPicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadHouseholds()
  }, [])

  async function loadHouseholds() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: members } = await supabase
      .from('household_members')
      .select('households(*)')
      .eq('user_id', user.id)

    if (members) {
      const hs = members.map(m => m.households as unknown as Household).filter(Boolean)
      setHouseholds(hs)
      if (hs.length > 0) setSelectedHousehold(hs[0].id)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch('/api/assistant/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMsg }],
          householdId: selectedHousehold || null,
        }),
      })

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте ещё раз.',
      }])
    }

    setLoading(false)
  }

  const selectedH = households.find(h => h.id === selectedHousehold)

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: '100dvh', paddingBottom: '64px' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">AI-ассистент</h1>

        {/* Household picker */}
        {households.length > 0 && (
          <div className="mt-2 relative">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200"
            >
              <span>{selectedH?.icon || '💊'}</span>
              <span>{selectedH?.name || 'Выбрать аптечку'}</span>
              <ChevronDown size={14} className={`transition-transform ${showPicker ? 'rotate-180' : ''}`} />
            </button>
            {showPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-48">
                {households.map(h => (
                  <button
                    key={h.id}
                    onClick={() => { setSelectedHousehold(h.id); setShowPicker(false) }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl ${
                      selectedHousehold === h.id ? 'text-[#1D9E75] font-medium' : 'text-gray-700'
                    }`}
                  >
                    <span>{h.icon}</span>
                    <span>{h.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mx-4 mt-3 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 flex-shrink-0">
        <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">Ассистент не ставит диагнозы. При серьёзных симптомах обращайтесь к врачу.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 py-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-[#1D9E75]' : 'bg-gray-200'
            }`}>
              {msg.role === 'assistant' ? (
                <Bot size={16} className="text-white" />
              ) : (
                <User size={16} className="text-gray-500" />
              )}
            </div>
            <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                : 'bg-[#1D9E75] text-white rounded-tr-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1D9E75] flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pt-3 pb-2 bg-white border-t border-gray-100 flex-shrink-0">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Опишите симптомы..."
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-11 h-11 bg-[#1D9E75] rounded-xl flex items-center justify-center text-white disabled:opacity-40 active:bg-[#158a63] transition-colors flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  )
}
