import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'bt-session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/login'
  const hasSession = !!request.cookies.get(COOKIE)?.value

  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Page routes only — skip API, Next.js internals, and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
