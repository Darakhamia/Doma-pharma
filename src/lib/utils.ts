import { type ClassValue, clsx } from 'clsx'
import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Не указан'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMMM yyyy', { locale: ru })
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd.MM.yyyy')
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { locale: ru, addSuffix: true })
}

export function getDaysUntilExpiry(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null
  return differenceInDays(parseISO(expiresAt), new Date())
}

export type ExpiryStatus = 'expired' | 'expiring-soon' | 'expiring-later' | 'ok'

export function getExpiryStatus(expiresAt: string | null | undefined): ExpiryStatus {
  if (!expiresAt) return 'ok'
  const days = getDaysUntilExpiry(expiresAt)
  if (days === null) return 'ok'
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring-soon'
  if (days <= 90) return 'expiring-later'
  return 'ok'
}

export function getExpiryLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return ''
  const days = getDaysUntilExpiry(expiresAt)
  if (days === null) return ''
  if (days < 0) return `Истёк ${Math.abs(days)} д. назад`
  if (days === 0) return 'Истекает сегодня'
  if (days === 1) return 'Истекает завтра'
  if (days <= 30) return `Через ${days} дн.`
  return formatDateShort(expiresAt)
}

export function getQuantityStatus(quantity: number, threshold: number): 'low' | 'ok' {
  return quantity <= threshold ? 'low' : 'ok'
}

export const CATEGORIES = [
  'НПВС',
  'Антибиотик',
  'Антигистаминное',
  'Антисептик',
  'Энтеросорбент',
  'Витамин',
  'Сердечно-сосудистое',
  'Желудочно-кишечное',
  'Противовирусное',
  'Обезболивающее',
  'Жаропонижающее',
  'Другое',
]

export const FORMS = [
  'Таблетки',
  'Капсулы',
  'Порошок',
  'Капли',
  'Мазь',
  'Сироп',
  'Гель',
  'Крем',
  'Спрей',
  'Суппозитории',
  'Ампулы',
  'Другое',
]

export const QUANTITY_UNITS = [
  'шт',
  'таблетки',
  'капсулы',
  'мл',
  'г',
  'пакетики',
  'упаковки',
]
