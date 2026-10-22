// A rejected source or document — the message is safe to show and `status` maps it to HTTP.
export class IngestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 422 | 502 | 503,
  ) {
    super(message)
  }
}
