import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  loadStandortbestimmungDimensionen, createStandortbestimmungDimension,
  updateStandortbestimmungDimension, deleteStandortbestimmungDimension,
} from '@/lib/supabase'
import type { StandortbestimmungDimension } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function StandortbestimmungAdminPage() {
  const [dims, setDims] = useState<StandortbestimmungDimension[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // New dimension form
  const [showForm, setShowForm] = useState(false)
  const [newSortOrder, setNewSortOrder] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newLeitfragen, setNewLeitfragen] = useState('')

  // Edit dimension
  const [editDimId, setEditDimId] = useState<string | null>(null)
  const [editSortOrder, setEditSortOrder] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editLeitfragen, setEditLeitfragen] = useState('')

  const loadData = async () => {
    try {
      setDims(await loadStandortbestimmungDimensionen())
    } catch {
      setError('Fehler beim Laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSaving(true); setError(null)
    try {
      await createStandortbestimmungDimension({
        sort_order: parseInt(newSortOrder, 10) || 0,
        title: newTitle.trim(),
        leitfragen: newLeitfragen.trim() || null,
      })
      setNewSortOrder(''); setNewTitle(''); setNewLeitfragen(''); setShowForm(false)
      loadData()
    } catch { setError('Fehler beim Erstellen.') }
    finally { setSaving(false) }
  }

  const startEdit = (dim: StandortbestimmungDimension) => {
    setEditDimId(dim.id)
    setEditSortOrder(String(dim.sort_order))
    setEditTitle(dim.title)
    setEditLeitfragen(dim.leitfragen ?? '')
  }

  const handleUpdate = async (id: string) => {
    if (!editTitle.trim()) return
    setSaving(true); setError(null)
    try {
      await updateStandortbestimmungDimension(id, {
        sort_order: parseInt(editSortOrder, 10) || 0,
        title: editTitle.trim(),
        leitfragen: editLeitfragen.trim() || null,
      })
      setEditDimId(null)
      loadData()
    } catch { setError('Fehler beim Aktualisieren.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (dim: StandortbestimmungDimension) => {
    if (!confirm(`Dimension «${dim.title}» löschen?`)) return
    try { await deleteStandortbestimmungDimension(dim.id); loadData() }
    catch { setError('Fehler beim Löschen.') }
  }

  return (
    <>
      <Head><title>Standortbestimmung – AI@DZ</title></Head>
      <AdminLayout title="Standortbestimmung">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Standortbestimmung – Dimensionen</h1>
          <button type="button" onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            + Neue Dimension
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-6">
          Dimensionen erscheinen im Transformationsplan zur Beurteilung via Ampelfarbe und Begründung.
        </p>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Neue Dimension</h2>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rang</label>
                <input type="number" value={newSortOrder} onChange={e => setNewSortOrder(e.target.value)}
                  placeholder="z.B. 10"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Titel * (einzeilig)</label>
                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required
                  placeholder="z.B. Arbeitsweise & Prozesse"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Leitfragen (mehrzeilig)</label>
              <textarea value={newLeitfragen} onChange={e => setNewLeitfragen(e.target.value)} rows={4}
                placeholder="z.B. Werden AI-Tools aktiv in tägliche Abläufe integriert?&#10;Gibt es definierte Prozesse für den AI-Einsatz?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
            </div>
          </form>
        )}

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? <p className="text-gray-400 text-sm">Lädt…</p> : dims.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine Dimensionen vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dims.map(dim => (
              <div key={dim.id} className="bg-white rounded-xl border border-gray-200 p-4">
                {editDimId === dim.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Rang</label>
                        <input type="number" value={editSortOrder} onChange={e => setEditSortOrder(e.target.value)}
                          title="Rang" placeholder="0"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          title="Titel" placeholder="Titel der Dimension"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Leitfragen</label>
                      <textarea value={editLeitfragen} onChange={e => setEditLeitfragen(e.target.value)} rows={4}
                        title="Leitfragen" placeholder="Leitfragen zur Dimension"
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleUpdate(dim.id)} disabled={saving}
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50">
                        {saving ? 'Speichern…' : 'Speichern'}
                      </button>
                      <button type="button" onClick={() => setEditDimId(null)} className="text-sm text-gray-500">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="inline-block min-w-[2rem] text-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded shrink-0 mt-0.5">
                        {dim.sort_order}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{dim.title}</p>
                        {dim.leitfragen ? (
                          <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">{dim.leitfragen}</p>
                        ) : (
                          <p className="text-xs text-gray-300 italic mt-1">Keine Leitfragen</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button type="button" onClick={() => startEdit(dim)}
                        className="text-xs text-brand-600 hover:text-brand-700">Bearbeiten</button>
                      <button type="button" onClick={() => handleDelete(dim)}
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
