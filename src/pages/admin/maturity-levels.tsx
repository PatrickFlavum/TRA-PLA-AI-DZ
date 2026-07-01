import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  loadMaturityLevels, createMaturityLevel, updateMaturityLevel, deleteMaturityLevel,
} from '@/lib/supabase'
import type { MaturityLevel } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function MaturityLevelsPage() {
  const [levels, setLevels] = useState<MaturityLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const loadData = () => {
    loadMaturityLevels()
      .then(setLevels)
      .catch(() => setError('Fehler beim Laden.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !title.trim()) return
    setSaving(true); setError(null)
    try {
      await createMaturityLevel({ code: code.trim(), title: title.trim(), description: desc.trim() || null })
      setCode(''); setTitle(''); setDesc(''); setShowForm(false); loadData()
    } catch { setError('Fehler beim Erstellen. Prüfe ob der Code bereits vergeben ist.') }
    finally { setSaving(false) }
  }

  const handleUpdate = async (id: string) => {
    if (!editCode.trim() || !editTitle.trim()) return
    try {
      await updateMaturityLevel(id, { code: editCode.trim(), title: editTitle.trim(), description: editDesc.trim() || null })
      setEditId(null); loadData()
    } catch { setError('Fehler beim Aktualisieren.') }
  }

  const handleDelete = async (level: MaturityLevel) => {
    if (!confirm(`Maturitätsstufe «${level.code} – ${level.title}» löschen?`)) return
    try { await deleteMaturityLevel(level.id); loadData() }
    catch { setError('Fehler beim Löschen. Möglicherweise ist die Stufe noch einem Use Case zugeordnet.') }
  }

  return (
    <>
      <Head><title>Maturitätsstufen – AI@DZ</title></Head>
      <AdminLayout title="Maturitätsstufen">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Maturitätsstufen</h1>
          <button type="button" onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            + Neue Stufe
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-6">
          Maturitätsstufen beschreiben den Reifegrad eines AI Use Cases. Sie werden anhand des Codes absteigend sortiert (z.B. L5 vor L1).
        </p>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Neue Maturitätsstufe</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ml-code" className="block text-xs font-medium text-gray-600 mb-1">Kurzcode * (z.B. L1, L2)</label>
                <input id="ml-code" type="text" value={code} onChange={e => setCode(e.target.value)} required maxLength={10}
                  placeholder="z.B. L3" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label htmlFor="ml-title" className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                <input id="ml-title" type="text" value={title} onChange={e => setTitle(e.target.value)} required
                  placeholder="z.B. Etabliert" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label htmlFor="ml-desc" className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
              <textarea id="ml-desc" value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                placeholder="Kurze Beschreibung der Maturitätsstufe…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                {saving ? 'Speichern…' : 'Speichern'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
            </div>
          </form>
        )}

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? <p className="text-gray-400 text-sm">Lädt…</p> : levels.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine Maturitätsstufen vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {levels.map(level => (
              <div key={level.id} className="bg-white rounded-xl border border-gray-200 p-4">
                {editId === level.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Kurzcode *</label>
                        <input value={editCode} onChange={e => setEditCode(e.target.value)} maxLength={10}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      </div>
                    </div>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                      placeholder="Beschreibung…"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(level.id)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">Speichern</button>
                      <button onClick={() => setEditId(null)} className="text-sm text-gray-500">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-bold rounded">{level.code}</span>
                        <span className="text-sm font-semibold text-gray-900">{level.title}</span>
                      </div>
                      {level.description && <p className="text-xs text-gray-500 mt-1">{level.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <button type="button"
                        onClick={() => { setEditId(level.id); setEditCode(level.code); setEditTitle(level.title); setEditDesc(level.description ?? '') }}
                        className="text-xs text-brand-600 hover:text-brand-700">Bearbeiten</button>
                      <button type="button" onClick={() => handleDelete(level)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
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
