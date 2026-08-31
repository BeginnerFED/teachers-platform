import { requireRole } from '@/lib/auth'

/**
 * The role check sits in the layout rather than the page. loading.tsx puts the page
 * inside a Suspense boundary, and a redirect thrown in there only reaches the browser
 * mid-stream, after a 200 has already gone out. From the layout it happens first.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await requireRole('admin')

  return children
}
