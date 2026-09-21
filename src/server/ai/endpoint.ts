const CHAT_COMPLETIONS_SUFFIX = /\/chat\/completions\/?$/

// OpenAI SDK's baseURL expects a `.../v1` root (it appends `/chat/completions` itself),
// but some providers' docs give the full completions path — accept either.
export const normalizeEndpoint = (endpoint: string | undefined): string | undefined =>
  endpoint ? endpoint.replace(CHAT_COMPLETIONS_SUFFIX, '') : endpoint
