import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Если env vars не заданы — не падаем, пропускаем запрос
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user && pathname.startsWith('/auth')) {
      return NextResponse.redirect(new URL('/app', request.url))
    }

    if (!user && (pathname.startsWith('/app') || pathname.startsWith('/settings'))) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    if (pathname === '/') {
      return NextResponse.redirect(new URL(user ? '/app' : '/auth/login', request.url))
    }
  } catch {
    // При ошибке — пропускаем, страницы сами проверят авторизацию
    return NextResponse.next({ request })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw\\.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
