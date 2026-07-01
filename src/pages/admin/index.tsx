import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { loadOrganizations, createOrganization, deleteOrganization } from '@/lib/supabase'
import type { Organization } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function AdminDashboard() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = () => {
    loadOrganizations()
      .then(setOrgs)
      .catch(() => setError('Fehler beim Laden der Arbeitsorganisationen.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createOrganization({ name: name.trim(), description: description.trim() || null })
      setName('')
      setDescription('')
      setShowForm(false)
      loadData()
    } catch {
      setError('Fehler beim Erstellen der Arbeitsorganisation.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (org: Organization) => {
    if (!confirm(`Arbeitsorganisation «${org.name}» und alle zugehörigen Daten löschen?`)) return
    try {
      await deleteOrganization(org.id)
      loadData()
    } catch {
      setError('Fehler beim Löschen.')
    }
  }

  return (
    <>
      <Head><title>Admin – AI@DZ Transformation Plans</title></Head>
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Arbeitsorganisationen</h1>
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Neue Arbeitsorganisation
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3"
          >
            <h2 className="text-sm font-semibold text-gray-700">Neue Arbeitsorganisation</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="z.B. Muster AG"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung (optional)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Kurze Beschreibung"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
              >
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setName(''); setDescription('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-400 text-sm">Lädt…</p>
        ) : orgs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine Arbeitsorganisationen vorhanden.</p>
            <p className="text-gray-400 text-xs mt-1">Erstellen Sie die erste mit dem Button oben.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orgs.map(org => (
              <div
                key={org.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <Link
                    href={`/admin/ao?id=${org.id}`}
                    className="text-base font-semibold text-gray-900 hover:text-brand-600"
                  >
                    {org.name}
                  </Link>
                  {org.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{org.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/ao?id=${org.id}`}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Öffnen →
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(org)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </>
  )
}
