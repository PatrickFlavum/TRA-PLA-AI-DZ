import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { loadEmployeeRoles, createEmployeeRole, updateEmployeeRole, deleteEmployeeRole } from '@/lib/supabase'
import type { EmployeeRole } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function RollenPage() {
  const [roles, setRoles] = useState<EmployeeRole[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadData = () => {
    loadEmployeeRoles()
      .then(setRoles)
      .catch(() => setError('Fehler beim Laden.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createEmployeeRole(newName.trim())
      setNewName('')
      loadData()
    } catch {
      setError('Fehler beim Erstellen.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    try {
      await updateEmployeeRole(id, editName.trim())
      setEditId(null)
      loadData()
    } catch {
      setError('Fehler beim Aktualisieren.')
    }
  }

  const handleDelete = async (role: EmployeeRole) => {
    if (!confirm(`MA-Rolle «${role.name}» löschen?`)) return
    try {
      await deleteEmployeeRole(role.id)
      loadData()
    } catch {
      setError('Fehler beim Löschen. Möglicherweise wird die Rolle noch verwendet.')
    }
  }

  return (
    <>
      <Head><title>MA-Rollen – AI@DZ</title></Head>
      <AdminLayout title="MA-Rollen">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mitarbeiter-Rollen</h1>

        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Neue Rolle</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="z.B. Software Engineer"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
          >
            {saving ? 'Hinzufügen…' : 'Hinzufügen'}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-400 text-sm">Lädt…</p>
        ) : roles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine MA-Rollen vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {roles.map(role => (
              <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                {editId === role.id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Escape') setEditId(null) }}
                    />
                    <button onClick={() => handleUpdate(role.id)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                      Speichern
                    </button>
                    <button onClick={() => setEditId(null)} className="text-sm text-gray-500 hover:text-gray-700">
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-900">{role.name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setEditId(role.id); setEditName(role.name) }}
                        className="text-xs text-brand-600 hover:text-brand-700"
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(role)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Löschen
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </>
  )
}
