import { createHash, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const digest = (value: string) => createHash('sha256').update(value).digest()

// Back-office calls from n8n: no user session, only the shared secret. Without the secret
// configured the API stays closed. Hashing first gives timingSafeEqual equal-length inputs.
export const requireInternal = (request: NextRequest): NextResponse | null => {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Wewnętrzne API jest wyłączone.' }, { status: 503 })
  }

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (!timingSafeEqual(digest(token), digest(secret))) {
    return NextResponse.json({ error: 'Nieprawidłowy sekret.' }, { status: 401 })
  }

  return null
}
