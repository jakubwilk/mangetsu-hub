export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

// Parses the `{ error }` body our Route Handlers return, so callers get a user-facing message.
export const errorFromResponse = async (res: Response, fallback: string) => {
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return new RequestError(data.error ?? fallback, res.status)
}

export const requestJson = async <T>(
  url: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
  fallbackError = 'Błąd serwera. Spróbuj ponownie.',
): Promise<T> => {
  const res = await fetch(url, {
    method,
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })

  if (!res.ok) throw await errorFromResponse(res, fallbackError)

  return (await res.json()) as T
}
