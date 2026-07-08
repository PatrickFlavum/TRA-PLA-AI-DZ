import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase, signOut } from '@/lib/supabase'

type Props = {
  children: React.ReactNode
  title?: string
}

export function AdminLayout({ children, title }: Props) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (!data.session) router.replace('/admin/login')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (!s) router.replace('/admin/login')
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await signOut()
    router.push('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-150 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Lädt…</p>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-150 print:bg-white">
      <header className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-bold text-brand-600 uppercase tracking-wide hover:text-brand-700">
              AI@DZ
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
              Admin
            </Link>
            {title && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-sm text-gray-800 font-medium">{title}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
