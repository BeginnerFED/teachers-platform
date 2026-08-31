/**
 * PostgREST parses an `or` filter out of a comma-separated string, so a search term
 * containing a comma, a bracket or a dot changes the meaning of the filter rather than
 * being searched for. Stripping them is blunt but safe; none of them help find a person.
 *
 * Shared rather than copied per repository: this is the kind of rule that gets fixed in
 * one place and quietly left wrong in the other.
 */
export function sanitiseSearch(term: string): string {
  return term.replace(/[,()."\\]/g, ' ').trim()
}
