import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { loadCapabilities, createCapability, updateCapability, deleteCapability } from '@/lib/supabase'
import type { BizDevOpsCapability } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

const DEFAULT_COLOR = '#6366f1'

export default function CapabilitiesPage() {
  const [caps, setCaps] = useState<BizDevOpsCapability[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(DEFAULT_COLOR)
  const [editSortOrder, setEditSortOrder] = useState('1')
  const [error, setError] = useState<string | null>(null)

  const loadData = () => {
    loadCapabilities()
      .then(setCaps)
      .catch(() => setError('Fehler beim Laden.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true); setError(null)
    try {
      await createCapability(newName.trim(), newColor)
      setNewName(''); setNewColor(DEFAULT_COLOR); loadData()
    } catch { setError('Fehler beim Erstellen.') }
    finally { setSaving(false) }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    const sortOrderNum = parseInt(editSortOrder)
    if (isNaN(sortOrderNum)) { setError('Sortier-Nummer muss eine Zahl sein.'); return }
    try {
      await updateCapability(id, { name: editName.trim(), color: editColor, sort_order: sortOrderNum })
      setEditId(null); loadData()
    } catch { setError('Fehler beim Aktualisieren.') }
  }

  const handleDelete = async (cap: BizDevOpsCapability) => {
    if (!confirm(`BizDevOps Capability «${cap.name}» löschen?`)) return
    try { await deleteCapability(cap.id); loadData() }
    catch { setError('Fehler beim Löschen. Möglicherweise wird die Capability noch verwendet.') }
  }

  return (
    <>
      <Head><title>BizDevOps Capabilities – AI@DZ</title></Head>
      <AdminLayout title="Capabilities">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">BizDevOps Capabilities</h1>
        <p className="text-xs text-gray-400 mb-6">Die Reihenfolge (Sortier-Nummer) bestimmt die Darstellung im Transformationsplan.</p>

        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex gap-3 items-end">
          <div className="flex-1">
            <label htmlFor="cap-name" className="block text-xs font-medium text-gray-600 mb-1">Neue Capability</label>
            <input id="cap-name" type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="z.B. Implement & Build"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="shrink-0">
            <label htmlFor="cap-color" className="block text-xs font-medium text-gray-600 mb-1">Farbe</label>
            <div className="flex items-center gap-2">
              <input id="cap-color" type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                className="w-9 h-9 rounded border border-gray-200 cursor-pointer" />
              <input type="text" value={newColor} onChange={e => setNewColor(e.target.value)} maxLength={7}
                className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                aria-label="Farbe als Hex-Code" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
            {saving ? 'Hinzufügen…' : 'Hinzufügen'}</button>
        </form>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? <p className="text-gray-400 text-sm">Lädt…</p> : caps.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine BizDevOps Capabilities vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {caps.map(cap => (
              <div key={cap.id} className="bg-white rounded-xl border border-gray-200 p-3">
                {editId === cap.id ? (
                  <div className="flex gap-2 items-center flex-1">
                    <input type="number" value={editSortOrder} onChange={e => setEditSortOrder(e.target.value)}
                      className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                      aria-label="Sortier-Nummer" />
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Escape') setEditId(null) }}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label="Capability Name" />
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer" aria-label="Farbe wählen" />
                    <input type="text" value={editColor} onChange={e => setEditColor(e.target.value)} maxLength={7}
                      className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                      aria-label="Farbe als Hex-Code" />
                    <button type="button" onClick={() => handleUpdate(cap.id)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">Speichern</button>
                    <button type="button" onClick={() => setEditId(null)} className="text-sm text-gray-500 hover:text-gray-700">Abbrechen</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-xs text-gray-400 font-mono shrink-0">{cap.sort_order}</span>
                      <div className="w-5 h-5 rounded shrink-0" style={{ backgroundColor: cap.color ?? DEFAULT_COLOR }} />
                      <span className="text-sm text-gray-900">{cap.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{cap.color ?? DEFAULT_COLOR}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setEditId(cap.id); setEditName(cap.name); setEditColor(cap.color ?? DEFAULT_COLOR); setEditSortOrder(String(cap.sort_order)) }}
                        className="text-xs text-brand-600 hover:text-brand-700">Bearbeiten</button>
                      <button type="button" onClick={() => handleDelete(cap)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
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
