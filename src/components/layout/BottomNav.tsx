'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plus, MessageCircle, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  householdId?: string
}

export function BottomNav({ householdId }: BottomNavProps) {
  const pathname = usePathname()

  const items = [
    {
      href: '/app',
      icon: Home,
      label: 'Аптечки',
      active: pathname === '/app' || (pathname.startsWith('/app/') && !pathname.includes('/add') && !pathname.includes('/assistant')),
    },
    {
      href: householdId ? `/app/${householdId}/add` : '/app/new',
      icon: Plus,
      label: 'Добавить',
      active: pathname.includes('/add'),
      isPrimary: true,
    },
    {
      href: householdId ? `/app/${householdId}/assistant` : '/app/assistant',
      icon: MessageCircle,
      label: 'Ассистент',
      active: pathname.includes('/assistant'),
    },
    {
      href: '/settings',
      icon: Settings,
      label: 'Настройки',
      active: pathname.startsWith('/settings'),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-150',
                item.isPrimary
                  ? 'bg-[#1D9E75] text-white -mt-5 w-14 h-14 justify-center rounded-2xl shadow-lg shadow-[#1D9E75]/30'
                  : item.active
                  ? 'text-[#1D9E75]'
                  : 'text-gray-400'
              )}
            >
              <Icon size={item.isPrimary ? 24 : 22} strokeWidth={item.active || item.isPrimary ? 2.5 : 1.8} />
              {!item.isPrimary && (
                <span className="text-xs font-medium">{item.label}</span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
