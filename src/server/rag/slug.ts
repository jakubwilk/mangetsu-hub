const MAX_SLUG_LENGTH = 120

const SLUG = /^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u

// Polish letters stay — existing slugs (e.g. "system-obrażeń-i-leczenie") already keep them.
export const slugify = (title: string): string =>
  title
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')

export const isValidSlug = (slug: string): boolean =>
  slug.length <= MAX_SLUG_LENGTH && SLUG.test(slug)
