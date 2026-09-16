import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('pa.accessToken')?.value;
  const path = request.nextUrl.pathname;

  const isPublicPath =
    path === '/login' ||
    path === '/register' ||
    path === '/privacy' ||
    path.startsWith('/oauth/');

  if (!token && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isPublicPath && !path.startsWith('/oauth/')) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)',
  ],
};
