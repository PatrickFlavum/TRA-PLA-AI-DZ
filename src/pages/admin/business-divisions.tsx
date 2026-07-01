import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  loadBusinessDivisions, createBusinessDivision, updateBusinessDivision, deleteBusinessDivision,
} from '@/lib/supabase'
import type { BusinessDivision } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function BusinessDivisionsPage() {
  const [divisions, setDivisions] = useState<BusinessDivision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const loadData = () => {
    loadBusinessDivisions()
      .then(setDivisions)
      .catch(() => setError('Fehler beim Laden.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSaving(true); setError(null)
    try {
      await createBusinessDivision({ title: newTitle.trim(), description: newDesc.trim() || null })
      setNewTitle(''); setNewDesc(''); setShowForm(false); loadData()
    } catch { setError('Fehler beim Erstellen.') }
    finally { setSaving(false) }
  }

  const handleUpdate = async (id: string) => {
    if (!editTitle.trim()) return
    try {
      await updateBusinessDivision(id, { title: editTitle.trim(), description: editDesc.trim() || null })
      setEditId(null); loadData()
    } catch { setError('Fehler beim Aktualisieren.') }
  }

  const handleDelete = async (div: BusinessDivision) => {
    if (!confirm(`Geschäftsbereich «${div.title}» löschen?`)) return
    try { await deleteBusinessDivision(div.id); loadData() }
    catch { setError('Fehler beim Löschen. Möglicherweise ist der Bereich noch einer AO zugeordnet.') }
  }

  return (
    <>
      <Head><title>IT-Geschäftsbereiche – AI@DZ</title></Head>
      <AdminLayout title="IT-Geschäftsbereiche">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">IT-Geschäftsbereiche</h1>
          <button type="button" onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            + Neuer Bereich
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-6">
          IT-Geschäftsbereiche können Arbeitsorganisationen (AOs) zugeordnet werden.
        </p>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Neuer IT-Geschäftsbereich</h2>
            <div>
              <label htmlFor="bd-title" className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
              <input id="bd-title" type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required
                placeholder="z.B. Payments & Banking"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label htmlFor="bd-desc" className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung</label>
              <textarea id="bd-desc" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                placeholder="Kurze Beschreibung des Geschäftsbereichs…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                {saving ? 'Speichern…' : 'Speichern'}</button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
            </div>
          </form>
        )}

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? <p className="text-gray-400 text-sm">Lädt…</p> : divisions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine IT-Geschäftsbereiche vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {divisions.map(div => (
              <div key={div.id} className="bg-white rounded-xl border border-gray-200 p-4">
                {editId === div.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                      placeholder="Kurzbeschreibung…"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleUpdate(div.id)}
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium">Speichern</button>
                      <button type="button" onClick={() => setEditId(null)}
                        className="text-sm text-gray-500">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{div.title}</p>
                      {div.description && <p className="text-xs text-gray-500 mt-1">{div.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <button type="button"
                        onClick={() => { setEditId(div.id); setEditTitle(div.title); setEditDesc(div.description ?? '') }}
                        className="text-xs text-brand-600 hover:text-brand-700">Bearbeiten</button>
                      <button type="button" onClick={() => handleDelete(div)}
                        className="text-xs text-red-400 hover:text-red-600">Löschen</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </>
  )
}
