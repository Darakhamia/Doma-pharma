import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || query.length < 2) {
      return NextResponse.json({ found: false })
    }

    const normalizedQuery = query.toLowerCase().trim()

    // Check cache first
    const supabase = await createClient()
    const { data: cached } = await supabase
      .from('medicine_catalog')
      .select('*')
      .ilike('query', normalizedQuery)
      .single()

    if (cached) {
      return NextResponse.json({
        found: true,
        name: cached.name,
        substance: cached.substance,
        purpose: cached.purpose,
        category: cached.category,
        form: cached.form,
        typical_quantity_unit: cached.typical_quantity_unit,
      })
    }

    // Ask Claude
    const prompt = `Пользователь ищет лекарство: "${query}"

Верни ТОЛЬКО JSON без пояснений:
{
  "name": "официальное название",
  "substance": "действующее вещество и дозировка",
  "purpose": "от чего помогает (кратко, 1-2 предложения)",
  "category": "категория (НПВС / Антибиотик / Антигистаминное / Антисептик / Энтеросорбент / Витамин / другое)",
  "form": "форма выпуска (Таблетки / Капсулы / Порошок / Капли / Мазь / Сироп / другое)",
  "typical_quantity_unit": "единица измерения (таблетки / капсулы / мл / г / пакетики / штук)",
  "found": true
}

Если лекарство не найдено или запрос нерелевантен — верни {"found": false}.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ found: false })
    }

    let result: Record<string, unknown>
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { found: false }
    } catch {
      return NextResponse.json({ found: false })
    }

    // Cache successful results
    if (result.found) {
      // Cache result, ignore if query already exists
      const existing = await supabase.from('medicine_catalog').select('id').eq('query', normalizedQuery).maybeSingle()
      if (!existing.data) {
        await supabase.from('medicine_catalog').insert({
          query: normalizedQuery,
          name: result.name as string,
          substance: result.substance as string | null,
          purpose: result.purpose as string | null,
          category: result.category as string | null,
          form: result.form as string | null,
          typical_quantity_unit: result.typical_quantity_unit as string | null,
        })
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Medicine lookup error:', error)
    return NextResponse.json({ found: false })
  }
}
