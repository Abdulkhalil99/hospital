import { NextRequest, NextResponse } from 'next/server';

const locales  = ['en', 'fa', 'ps'];
const default_ = 'en';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check if locale already in path
  const hasLocale = locales.some(
    loc => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)
  );

  if (!hasLocale) {
    return NextResponse.redirect(new URL(`/${default_}${pathname}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
