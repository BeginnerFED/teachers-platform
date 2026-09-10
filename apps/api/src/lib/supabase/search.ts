/**
 * Quote the whole pattern for PostgREST's `or` grammar, preserving email addresses and
 * punctuation while preventing a value from becoming another filter. LIKE escaping
 * happens first, then grammar escaping. Supabase handles URL encoding itself.
 * https://docs.postgrest.org/en/v13/references/api/url_grammar.html#reserved-characters
 */
export function searchPattern(term: string): string {
  const pattern = `%${term.trim().replace(/[\\%_]/g, '\\$&')}%`
  return `"${pattern.replace(/["\\]/g, '\\$&')}"`
}
