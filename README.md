# MedBag — Умная домашняя аптечка

PWA-приложение для управления домашней аптечкой с поддержкой нескольких домохозяйств, совместным доступом и AI-ассистентом.

## Технический стек

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **База данных + Auth**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Уведомления**: Web Push API + Supabase Edge Functions
- **PWA**: next-pwa (Service Worker, офлайн кэш, installable)

## Быстрый старт

### 1. Установите зависимости

```bash
npm install
```

### 2. Настройте переменные окружения

```bash
cp .env.local.example .env.local
```

Заполните `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://your-domain.com
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

### 3. Настройте Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Выполните SQL из `supabase/migrations/001_initial.sql` в SQL Editor Supabase
3. Включите Google OAuth в Authentication > Providers (опционально)
4. Добавьте URL редиректов: `https://your-domain.com/auth/callback`

### 4. Генерация VAPID ключей

```bash
npx web-push generate-vapid-keys
```

### 5. Запуск

```bash
npm run dev   # разработка
npm run build && npm start  # продакшн
```

## Структура проекта

```
src/
├── app/
│   ├── auth/           # Аутентификация (логин, регистрация, callback)
│   ├── app/            # Основное приложение
│   │   ├── page.tsx    # Список аптечек
│   │   ├── new/        # Создать аптечку
│   │   └── [householdId]/
│   │       ├── page.tsx      # Список лекарств + поиск/фильтры
│   │       ├── add/          # Добавить лекарство (с AI-поиском)
│   │       ├── [medId]/      # Карточка лекарства + история
│   │       ├── members/      # Участники + инвайт-ссылка
│   │       └── assistant/    # AI-ассистент симптомов
│   ├── api/
│   │   ├── medicine/lookup/        # POST — AI поиск лекарств
│   │   ├── assistant/symptoms/     # POST — AI чат ассистент
│   │   ├── household/[id]/invite/  # POST — создать инвайт
│   │   └── notifications/subscribe/ # Web Push подписка
│   ├── invite/[token]/  # Принять приглашение
│   └── settings/        # Настройки профиля и уведомлений
├── components/
│   ├── ui/              # Button, Input, Badge, Select
│   ├── layout/          # BottomNav, PageHeader
│   └── medicines/       # MedicineCard (с оптимистичными обновлениями)
└── lib/
    ├── supabase/        # client.ts, server.ts, types.ts
    └── utils.ts         # форматирование, статусы срока годности

supabase/
├── migrations/001_initial.sql  # Все таблицы + RLS политики
└── functions/notify-expiry/    # Edge Function для push-уведомлений
```

## Ключевые функции

| Функция | Статус |
|---------|--------|
| Email + Google OAuth | ✅ |
| Несколько аптечек | ✅ |
| Инвайт-ссылки (7 дней) | ✅ |
| CRUD лекарств | ✅ |
| AI-поиск при добавлении | ✅ |
| AI-ассистент симптомов | ✅ |
| Цветовая индикация срока | ✅ |
| Быстрые кнопки +/- (оптимистичные) | ✅ |
| История изменений | ✅ |
| Realtime обновления | ✅ |
| Web Push уведомления | ✅ |
| PWA (установка на телефон) | ✅ |
| Поиск и фильтры | ✅ |
| Bottom navigation | ✅ |

## Деплой на Vercel

1. `git push` в ваш репозиторий
2. Подключите репозиторий к Vercel
3. Добавьте все переменные окружения в настройках проекта
4. Деплой произойдёт автоматически

## Edge Functions (Cron уведомления)

```bash
supabase functions deploy notify-expiry
```

Настройте cron в Supabase Dashboard → Edge Functions → Schedules:
- Schedule: `0 9 * * *` (каждый день в 9:00 UTC)
