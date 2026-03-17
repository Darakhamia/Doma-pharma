'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plus, MessageCircle, Settings, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  householdId?: string
}

export function BottomNav({ householdId }: BottomNavProps) {
  const pathname = usePathname()

  const leftItems = [
    {
      href: '/app',
      icon: Home,
      label: 'Аптечки',
      active: pathname === '/app' || (pathname.startsWith('/app/') && !pathname.includes('/add') && !pathname.includes('/assistant')),
    },
    {
      href: householdId ? `/app/${householdId}/assistant` : '/app/assistant',
      icon: MessageCircle,
      label: 'Ассистент',
      active: pathname.includes('/assistant'),
    },
  ]

  const rightItems = [
    {
      href: householdId ? `/app/${householdId}/restock` : '/app',
      icon: ShoppingCart,
      label: 'Докупить',
      active: pathname.includes('/restock'),
    },
    {
      href: '/settings',
      icon: Settings,
      label: 'Настройки',
      active: pathname.startsWith('/settings'),
    },
  ]

  const addHref = householdId ? `/app/${householdId}/add` : '/app/new'
  const addActive = pathname.includes('/add')

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-lg mx-auto relative flex items-center px-4 pt-2 pb-2" style={{ height: 64 }}>
        {/* Left items */}
        <div className="flex flex-1 justify-around">
          {leftItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-150',
                  item.active ? 'text-[#1D9E75]' : 'text-gray-400'
                )}
              >
                <Icon size={22} strokeWidth={item.active ? 2.5 : 1.8} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Center Plus — absolute center of nav */}
        <Link
          href={addHref}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 w-14 h-14 bg-[#1D9E75] rounded-2xl flex items-center justify-center shadow-lg shadow-[#1D9E75]/30 -translate-y-4 transition-transform active:scale-95',
            addActive && 'scale-95'
          )}
        >
          <Plus size={26} strokeWidth={2.2} className="text-white" />
        </Link>

        {/* Spacer so right side mirrors left */}
        <div className="w-14 flex-shrink-0" />

        {/* Right items */}
        <div className="flex flex-1 justify-around">
          {rightItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-150',
                  item.active ? 'text-[#1D9E75]' : 'text-gray-400'
                )}
              >
                <Icon size={22} strokeWidth={item.active ? 2.5 : 1.8} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
