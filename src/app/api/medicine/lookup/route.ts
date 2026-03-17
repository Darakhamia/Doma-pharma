import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Detect if query looks like an EAN/UPC barcode
function isBarcode(q: string) {
  return /^\d{8,14}$/.test(q.trim())
}

// Try Open Food Facts / Open Products barcode lookup (free, no auth)
async function lookupBarcode(barcode: string) {
  const endpoints = [
    `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
    `https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`,
    `https://world.openproductsfacts.org/api/v0/product/${barcode}.json`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) continue
      const data = await res.json()
      if (data.status !== 1 || !data.product) continue
      const p = data.product
      const name = p.product_name || p.product_name_ru || p.product_name_en
      if (!name) continue
      return {
        name,
        brands: p.brands || null,
        categories: p.categories || null,
        ingredients: p.ingredients_text ? p.ingredients_text.slice(0, 300) : null,
        quantity: p.quantity || null,
      }
    } catch {}
  }
  return null
}

// Search OpenFDA for drug info
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
    if (!name && !substance) return null
    return { name, substance, purpose }
  } catch {
    return null
  }
}

// Search RxNorm
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
    const barcode = isBarcode(query) ? query.trim() : null

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('profiles').select('openai_api_key').eq('id', user.id).single()
      : { data: null }

    const apiKey = profile?.openai_api_key || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ found: false })
    }

    // Check cache (by barcode or by query)
    const cacheQuery = barcode ? `barcode:${barcode}` : normalizedQuery
    const { data: cached } = await supabase
      .from('medicine_catalog')
      .select('*')
      .ilike('query', cacheQuery)
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

    const openai = new OpenAI({ apiKey })

    let contextHint = ''

    if (barcode) {
      // 1. Try free barcode databases
      const barcodeData = await lookupBarcode(barcode)

      if (barcodeData) {
        contextHint = `Данные из базы штрихкодов для EAN ${barcode}:
Название: ${barcodeData.name}
Бренд: ${barcodeData.brands || 'н/д'}
Категории: ${barcodeData.categories || 'н/д'}
Состав: ${barcodeData.ingredients || 'н/д'}
Объём/кол-во: ${barcodeData.quantity || 'н/д'}
Используй эти данные как основу.`
      } else {
        // 2. Ask AI to identify barcode from training data
        contextHint = `Запрос по штрихкоду EAN-13: ${barcode}
Используй свои обучающие данные чтобы определить, какой это продукт/лекарство.
Этот код: ${barcode} (префикс страны: ${barcode.slice(0, 3)} — вероятно ${getCountryHint(barcode)}).`
      }
    } else {
      // Text search — try public APIs
      const [fdaResult, rxResult] = await Promise.all([
        searchOpenFDA(query),
        searchRxNorm(query),
      ])
      if (fdaResult || rxResult) {
        contextHint = `Данные из публичных баз:\n- OpenFDA: ${JSON.stringify(fdaResult)}\n- RxNorm: ${JSON.stringify(rxResult)}\nИспользуй эти данные как основу.`
      }
    }

    const prompt = barcode
      ? `Определи лекарство/продукт по штрихкоду EAN: ${barcode}

${contextHint}

Верни ТОЛЬКО JSON без пояснений:
{
  "name": "название продукта/лекарства",
  "substance": "действующее вещество и дозировка (если известно)",
  "purpose": "от чего помогает или назначение (кратко, на русском)",
  "category": "НПВС / Антибиотик / Антигистаминное / Антисептик / Витамин / Пастилки / БАД / Гомеопатия / другое",
  "form": "форма выпуска (Таблетки / Капсулы / Пастилки / Порошок / Капли / Мазь / Сироп / Спрей / другое)",
  "typical_quantity_unit": "таблетки / пастилки / капсулы / мл / г / пакетики / штук",
  "found": true
}

Если не удалось определить — верни {"found": false}.`
      : `Пользователь ищет лекарство: "${query}"
${contextHint}

Верни ТОЛЬКО JSON без пояснений:
{
  "name": "официальное название",
  "substance": "действующее вещество и дозировка",
  "purpose": "от чего помогает (кратко, 1-2 предложения на русском)",
  "category": "НПВС / Антибиотик / Антигистаминное / Антисептик / Энтеросорбент / Витамин / другое",
  "form": "форма выпуска (Таблетки / Капсулы / Порошок / Капли / Мазь / Сироп / другое)",
  "typical_quantity_unit": "таблетки / капсулы / мл / г / пакетики / штук",
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
    if (!content) return NextResponse.json({ found: false })

    let result: Record<string, unknown>
    try {
      result = JSON.parse(content)
    } catch {
      return NextResponse.json({ found: false })
    }

    // Cache successful results
    if (result.found) {
      const existing = await supabase
        .from('medicine_catalog')
        .select('id')
        .eq('query', cacheQuery)
        .maybeSingle()
      if (!existing.data) {
        await supabase.from('medicine_catalog').insert({
          query: cacheQuery,
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

function getCountryHint(barcode: string): string {
  const prefix = parseInt(barcode.slice(0, 3))
  if (prefix >= 400 && prefix <= 440) return 'Германия'
  if (prefix >= 450 && prefix <= 459 || prefix >= 490 && prefix <= 499) return 'Япония'
  if (prefix >= 460 && prefix <= 469) return 'Россия'
  if (prefix >= 470 && prefix <= 479) return 'Кыргызстан'
  if (prefix >= 480 && prefix <= 489) return 'Филиппины'
  if (prefix >= 500 && prefix <= 509) return 'Великобритания'
  if (prefix >= 520 && prefix <= 521) return 'Греция'
  if (prefix >= 535 && prefix <= 535) return 'Мальта'
  if (prefix >= 539 && prefix <= 539) return 'Ирландия'
  if (prefix >= 560 && prefix <= 569) return 'Португалия'
  if (prefix >= 570 && prefix <= 579) return 'Дания'
  if (prefix >= 590 && prefix <= 599) return 'Польша'
  if (prefix >= 600 && prefix <= 601) return 'ЮАР'
  if (prefix >= 611 && prefix <= 611) return 'Марокко'
  if (prefix >= 619 && prefix <= 619) return 'Тунис'
  if (prefix >= 621 && prefix <= 621) return 'Сирия'
  if (prefix >= 628 && prefix <= 628) return 'Саудовская Аравия'
  if (prefix >= 629 && prefix <= 629) return 'ОАЭ'
  if (prefix >= 640 && prefix <= 649) return 'Финляндия'
  if (prefix >= 690 && prefix <= 699) return 'Китай'
  if (prefix >= 700 && prefix <= 709) return 'Норвегия'
  if (prefix >= 730 && prefix <= 739) return 'Швеция'
  if (prefix >= 740 && prefix <= 745) return 'Гватемала/Мексика'
  if (prefix >= 750 && prefix <= 759) return 'Мексика'
  if (prefix >= 760 && prefix <= 769) return 'Швейцария'
  if (prefix >= 770 && prefix <= 771) return 'Колумбия'
  if (prefix >= 773 && prefix <= 773) return 'Уругвай'
  if (prefix >= 775 && prefix <= 775) return 'Перу'
  if (prefix >= 777 && prefix <= 777) return 'Боливия'
  if (prefix >= 779 && prefix <= 779) return 'Аргентина'
  if (prefix >= 780 && prefix <= 780) return 'Чили'
  if (prefix >= 784 && prefix <= 784) return 'Парагвай'
  if (prefix >= 786 && prefix <= 786) return 'Эквадор'
  if (prefix >= 789 && prefix <= 790) return 'Бразилия'
  if (prefix >= 800 && prefix <= 839) return 'Италия'
  if (prefix >= 840 && prefix <= 849) return 'Испания'
  if (prefix >= 850 && prefix <= 850) return 'Куба'
  if (prefix >= 858 && prefix <= 858) return 'Словакия'
  if (prefix >= 859 && prefix <= 859) return 'Чехия'
  if (prefix >= 860 && prefix <= 860) return 'Сербия'
  if (prefix >= 865 && prefix <= 865) return 'Монголия'
  if (prefix >= 867 && prefix <= 867) return 'Северная Корея'
  if (prefix >= 869 && prefix <= 869) return 'Турция'
  if (prefix >= 870 && prefix <= 879) return 'Нидерланды'
  if (prefix >= 880 && prefix <= 880) return 'Южная Корея'
  if (prefix >= 885 && prefix <= 885) return 'Таиланд'
  if (prefix >= 888 && prefix <= 888) return 'Сингапур'
  if (prefix >= 890 && prefix <= 890) return 'Индия'
  if (prefix >= 893 && prefix <= 893) return 'Вьетнам'
  if (prefix >= 896 && prefix <= 896) return 'Пакистан'
  if (prefix >= 899 && prefix <= 899) return 'Индонезия'
  if (prefix >= 900 && prefix <= 919) return 'Австрия'
  if (prefix >= 930 && prefix <= 939) return 'Австралия'
  if (prefix >= 940 && prefix <= 949) return 'Новая Зеландия'
  if (prefix >= 955 && prefix <= 955) return 'Малайзия'
  if (prefix >= 958 && prefix <= 958) return 'Макао'
  if ((prefix >= 30 && prefix <= 37) || prefix === 3) return 'Франция'
  if (prefix >= 380 && prefix <= 380) return 'Болгария'
  if (prefix >= 383 && prefix <= 383) return 'Словения'
  if (prefix >= 385 && prefix <= 385) return 'Хорватия'
  if (prefix >= 387 && prefix <= 387) return 'Босния и Герцеговина'
  if (prefix >= 389 && prefix <= 389) return 'Черногория'
  if (prefix >= 390 && prefix <= 390) return 'Косово'
  return 'неизвестная страна'
}
