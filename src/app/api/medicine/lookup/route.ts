import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Search OpenFDA for drug info (US/international drugs)
async function searchOpenFDA(query: string) {
  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(query)}"&limit=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0]
    if (!result) return null

    const name = result.openfda?.brand_name?.[0] || null
    const substance = result.openfda?.generic_name?.[0] || null
    const purpose = result.purpose?.[0]?.replace(/\n/g, ' ').slice(0, 200) || null
    const pharmClass = result.openfda?.pharm_class_epc?.[0] || null

    if (!name && !substance) return null
    return { name, substance, purpose, pharmClass }
  } catch {
    return null
  }
}

// Search RxNorm for drug name normalization
async function searchRxNorm(query: string) {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const data = await res.json()
    const concepts = data.drugGroup?.conceptGroup
    if (!concepts) return null

    for (const group of concepts) {
      if (group.conceptProperties?.length) {
        return { name: group.conceptProperties[0].name }
      }
    }
    return null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || query.length < 2) {
      return NextResponse.json({ found: false })
    }

    const normalizedQuery = query.toLowerCase().trim()

    // Check cache first
    const supabase = await createClient()

    // Get user's OpenAI key from profile, fall back to env
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('profiles').select('openai_api_key').eq('id', user.id).single()
      : { data: null }

    const apiKey = profile?.openai_api_key || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ found: false })
    }

    const openai = new OpenAI({ apiKey })
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

    // Try public APIs first
    const [fdaResult, rxResult] = await Promise.all([
      searchOpenFDA(query),
      searchRxNorm(query),
    ])

    const publicApiHint = fdaResult || rxResult
      ? `Данные из публичных баз:\n- OpenFDA: ${JSON.stringify(fdaResult)}\n- RxNorm: ${JSON.stringify(rxResult)}\nИспользуй эти данные как основу.`
      : ''

    // Use OpenAI to fill/complete the data
    const prompt = `Пользователь ищет лекарство: "${query}"
${publicApiHint}

Верни ТОЛЬКО JSON без пояснений:
{
  "name": "официальное название",
  "substance": "действующее вещество и дозировка",
  "purpose": "от чего помогает (кратко, 1-2 предложения на русском)",
  "category": "категория (НПВС / Антибиотик / Антигистаминное / Антисептик / Энтеросорбент / Витамин / другое)",
  "form": "форма выпуска (Таблетки / Капсулы / Порошок / Капли / Мазь / Сироп / другое)",
  "typical_quantity_unit": "единица измерения (таблетки / капсулы / мл / г / пакетики / штук)",
  "found": true
}

Если лекарство не найдено или запрос нерелевантен — верни {"found": false}.`

    const message = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const content = message.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ found: false })
    }

    let result: Record<string, unknown>
    try {
      result = JSON.parse(content)
    } catch {
      return NextResponse.json({ found: false })
    }

    // Cache successful results
    if (result.found) {
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
