export { auth as proxy } from 'server/auth'

// api/internal has no user session — its handlers check the n8n secret (server/internal.ts).
export const config = {
  matcher: [
    '/((?!api/auth|api/internal/|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpe?g|webp|avif|svg|woff2)$).*)',
  ],
}
