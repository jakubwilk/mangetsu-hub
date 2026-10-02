import { PrismaAdapter } from '@auth/prisma-adapter'
import { canAccessApp, getAppByPath, toAppRoles } from 'common/apps'
import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'
import { cache } from 'react'

import { db } from './db'

const useSecureCookies = process.env.AUTH_URL?.startsWith('https://') ?? false

// `__Host-` = Secure, Path=/, no Domain: the browser rejects any cookie with this name set by a
// sibling subdomain or the parent domain (thalverntable.app), so they can't toss in a session.
const hostOnlyCookie = (name: string) => ({
  name: useSecureCookies ? `__Host-authjs.${name}` : `authjs.${name}`,
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [Discord],
  session: { strategy: 'database' },
  useSecureCookies,
  cookies: {
    sessionToken: hostOnlyCookie('session-token'),
    callbackUrl: hostOnlyCookie('callback-url'),
    pkceCodeVerifier: hostOnlyCookie('pkce.code_verifier'),
    state: hostOnlyCookie('state'),
    nonce: hostOnlyCookie('nonce'),
  },
  pages: { signIn: '/', error: '/' },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      session.user.isRoot = user.isRoot
      session.user.apps = toAppRoles(
        await db.appRole.findMany({
          where: { userId: user.id },
          select: { app: true, role: true },
        }),
      )
      return session
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const redirectTo = (path: string) => Response.redirect(new URL(path, request.nextUrl))

      if (pathname.startsWith('/api/')) {
        return auth ? true : NextResponse.json({ error: 'Wymagane logowanie.' }, { status: 401 })
      }
      if (pathname === '/') return true
      if (!auth) return false

      const access = auth.user
      const isPending = !access.isRoot && Object.keys(access.apps).length === 0
      if (pathname === '/pending') return isPending ? true : redirectTo('/')
      if (isPending) return redirectTo('/pending')

      if (pathname.startsWith('/admin')) return access.isRoot ? true : redirectTo('/')

      const app = getAppByPath(pathname)
      if (app && !canAccessApp(access, app.id)) return redirectTo('/')

      return true
    },
  },
})

// Per-request memoized session for Server Components — the header and the page both need it,
// and with database sessions every auth() call is a DB round-trip.
export const getSession = cache(async () => auth())
