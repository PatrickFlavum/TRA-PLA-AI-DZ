import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  loadQualityChecklistItems, createQualityChecklistItem,
  updateQualityChecklistItem, deleteQualityChecklistItem,
} from '@/lib/supabase'
import type { QualityChecklistItem } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function QualityChecklistPage() {
  const [items, setItems] = useState<QualityChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [sortOrder, setSortOrder] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editSortOrder, setEditSortOrder] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const loadData = () => {
    loadQualityChecklistItems()
      .then(setItems)
      .catch(() => setError('Fehler beim Laden.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setError(null)
    try {
      await createQualityChecklistItem({
        sort_order: parseInt(sortOrder, 10) || 0,
        title: title.trim(),
        description: desc.trim() || null,
      })
      setSortOrder(''); setTitle(''); setDesc(''); setShowForm(false); loadData()
    } catch { setError('Fehler beim Erstellen.') }
    finally { setSaving(false) }
  }

  const handleUpdate = async (id: string) => {
    if (!editTitle.trim()) return
    try {
      await updateQualityChecklistItem(id, {
        sort_order: parseInt(editSortOrder, 10) || 0,
        title: editTitle.trim(),
        description: editDesc.trim() || null,
      })
      setEditId(null); loadData()
    } catch { setError('Fehler beim Aktualisieren.') }
  }

  const handleDelete = async (item: QualityChecklistItem) => {
    if (!confirm(`Checklisten-Eintrag «${item.title}» löschen?`)) return
    try { await deleteQualityChecklistItem(item.id); loadData() }
    catch { setError('Fehler beim Löschen.') }
  }

  return (
    <>
      <Head><title>Qualitäts-Checkliste – AI@DZ</title></Head>
      <AdminLayout title="Qualitäts-Checkliste">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Qualitäts-Checkliste</h1>
          <button type="button" onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            + Neuer Eintrag
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-6">
          Die hier erfassten Einträge erscheinen im Transformationsplan als Checkliste. Jede ART kann die Punkte einzeln abhaken.
        </p>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Neuer Checklisten-Eintrag</h2>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rang (Sortierung)</label>
                <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                  placeholder="z.B. 10"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                  placeholder="z.B. Alle Use Cases sind bewertet"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                placeholder="Kurze Erläuterung was dieser Punkt beinhaltet…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
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

        {loading ? <p className="text-gray-400 text-sm">Lädt…</p> : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine Checklisten-Einträge vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                {editId === item.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Rang</label>
                        <input type="number" value={editSortOrder} onChange={e => setEditSortOrder(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      </div>
                    </div>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                      placeholder="Kurzbeschreibung…"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(item.id)}
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium">Speichern</button>
                      <button onClick={() => setEditId(null)} className="text-sm text-gray-500">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="inline-block mt-0.5 min-w-[2rem] text-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded shrink-0">
                        {item.sort_order}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <button type="button" onClick={() => {
                        setEditId(item.id)
                        setEditSortOrder(String(item.sort_order))
                        setEditTitle(item.title)
                        setEditDesc(item.description ?? '')
                      }} className="text-xs text-brand-600 hover:text-brand-700">Bearbeiten</button>
                      <button type="button" onClick={() => handleDelete(item)}
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
