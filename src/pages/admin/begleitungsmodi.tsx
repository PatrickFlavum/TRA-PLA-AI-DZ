import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { loadGuidanceModes, createGuidanceMode, updateGuidanceMode, deleteGuidanceMode } from '@/lib/supabase'
import type { GuidanceMode } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function BegleitungsmodiPage() {
  const [modes, setModes] = useState<GuidanceMode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [letter, setLetter] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editLetter, setEditLetter] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const loadData = () => {
    loadGuidanceModes()
      .then(setModes)
      .catch(() => setError('Fehler beim Laden.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!letter.trim() || !title.trim()) return
    setSaving(true); setError(null)
    try {
      await createGuidanceMode({ letter: letter.trim(), title: title.trim(), description: desc.trim() || null })
      setLetter(''); setTitle(''); setDesc(''); setShowForm(false); loadData()
    } catch { setError('Fehler beim Erstellen.') }
    finally { setSaving(false) }
  }

  const handleUpdate = async (id: string) => {
    if (!editLetter.trim() || !editTitle.trim()) return
    try {
      await updateGuidanceMode(id, { letter: editLetter.trim(), title: editTitle.trim(), description: editDesc.trim() || null })
      setEditId(null); loadData()
    } catch { setError('Fehler beim Aktualisieren.') }
  }

  const handleDelete = async (mode: GuidanceMode) => {
    if (!confirm(`Begleitungsmodus «${mode.title}» löschen?`)) return
    try { await deleteGuidanceMode(mode.id); loadData() }
    catch { setError('Fehler beim Löschen.') }
  }

  return (
    <>
      <Head><title>Begleitungsmodi – AI@DZ</title></Head>
      <AdminLayout title="Begleitungsmodi">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Begleitungsmodi</h1>
          <button type="button" onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            + Neuer Modus
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Neuer Begleitungsmodus</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="gm-letter" className="block text-xs font-medium text-gray-600 mb-1">Buchstabe *</label>
                <input id="gm-letter" type="text" value={letter} onChange={e => setLetter(e.target.value)} required maxLength={3}
                  placeholder="z.B. A" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-2">
                <label htmlFor="gm-title" className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                <input id="gm-title" type="text" value={title} onChange={e => setTitle(e.target.value)} required
                  placeholder="z.B. Coaching" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label htmlFor="gm-desc" className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
              <input id="gm-desc" type="text" value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Kurze Beschreibung" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                {saving ? 'Speichern…' : 'Speichern'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
            </div>
          </form>
        )}

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? <p className="text-gray-400 text-sm">Lädt…</p> : modes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine Begleitungsmodi vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {modes.map(mode => (
              <div key={mode.id} className="bg-white rounded-xl border border-gray-200 p-3">
                {editId === mode.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input value={editLetter} onChange={e => setEditLetter(e.target.value)} maxLength={3}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="col-span-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Beschreibung"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(mode.id)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">Speichern</button>
                      <button onClick={() => setEditId(null)} className="text-sm text-gray-500">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-brand-100 text-brand-700 text-sm font-bold rounded-lg">{mode.letter}</span>
                      <div>
                        <span className="text-sm font-medium text-gray-900">{mode.title}</span>
                        {mode.description && <p className="text-xs text-gray-500">{mode.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setEditId(mode.id); setEditLetter(mode.letter); setEditTitle(mode.title); setEditDesc(mode.description ?? '') }}
                        className="text-xs text-brand-600 hover:text-brand-700">Bearbeiten</button>
                      <button onClick={() => handleDelete(mode)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
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
