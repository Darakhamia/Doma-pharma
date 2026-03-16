import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { formatDateShort } from '@/lib/utils'
import { Medicine } from '@/lib/supabase/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { messages, householdId } = await request.json()

    const supabase = await createClient()

    // Get medicines from the household
    const { data: medicinesRaw } = await supabase
      .from('medicines')
      .select('*')
      .eq('household_id', householdId)
      .gt('quantity', 0)

    const medicines = (medicinesRaw || []) as Medicine[]

    const medicinesList = medicines
      .map(m => {
        const expInfo = m.expires_at
          ? `срок: ${formatDateShort(m.expires_at)}`
          : 'срок не указан'
        const now = new Date()
        const expDate = m.expires_at ? new Date(m.expires_at) : null
        const isExpired = expDate && expDate < now

        return `• ${m.name}${m.form ? ` (${m.form})` : ''}: ${m.quantity} ${m.quantity_unit}` +
          `${m.purpose ? `, назначение: ${m.purpose}` : ''}` +
          `${m.location ? `, место: ${m.location}` : ''}` +
          `, ${expInfo}${isExpired ? ' ⚠️ ИСТЁК' : ''}`
      })
      .join('\n')

    const systemPrompt = `Ты — помощник домашней аптечки. Твоя задача — помочь пользователю найти подходящее средство из его аптечки на основе симптомов.

В аптечке пользователя сейчас есть:
${medicinesList || 'Аптечка пуста'}

Правила:
1. Задавай уточняющие вопросы при неясных симптомах (не более 2 вопросов подряд)
2. При лёгких симптомах (простуда, боль в горле, диарея, головная боль, аллергия) — предлагай что есть в аптечке с указанием количества и где лежит
3. Если в аптечке нет подходящего — скажи что купить
4. При серьёзных симптомах (температура выше 39°C, боль в груди, затруднённое дыхание, рвота с кровью, потеря сознания, сильная аллергическая реакция) — ОБЯЗАТЕЛЬНО рекомендуй обратиться к врачу или вызвать скорую
5. Не ставь диагнозы. Ты помощник, не врач.
6. Отвечай по-русски, дружелюбно и кратко
7. Упоминай истёкшие лекарства с предупреждением что их не стоит использовать`

    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: anthropicMessages,
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ message: 'Извините, произошла ошибка.' })
    }

    return NextResponse.json({ message: content.text })
  } catch (error) {
    console.error('Assistant error:', error)
    return NextResponse.json({ message: 'Извините, сервис временно недоступен.' })
  }
}
