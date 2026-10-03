export { auth as proxy } from 'server/auth'

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpe?g|webp|avif|svg|woff2)$).*)',
  ],
}
