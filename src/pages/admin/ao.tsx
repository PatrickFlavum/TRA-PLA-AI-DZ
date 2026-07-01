import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  loadOrganization, updateOrganization,
  loadARTs, createART, deleteART,
} from '@/lib/supabase'
import type { Organization, ART } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function AODetailPage() {
  const router = useRouter()
  const orgId = router.query.id as string

  const [org, setOrg] = useState<Organization | null>(null)
  const [arts, setARTs] = useState<ART[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingOrg, setEditingOrg] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgDesc, setOrgDesc] = useState('')

  const [showArtForm, setShowArtForm] = useState(false)
  const [artName, setArtName] = useState('')
  const [artDesc, setArtDesc] = useState('')
  const [savingArt, setSavingArt] = useState(false)

  const loadData = async () => {
    if (!orgId) return
    try {
      const [o, a] = await Promise.all([loadOrganization(orgId), loadARTs(orgId)])
      setOrg(o)
      setARTs(a)
      if (o) { setOrgName(o.name); setOrgDesc(o.description ?? '') }
    } catch {
      setError('Fehler beim Laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [orgId])

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !orgName.trim()) return
    try {
      await updateOrganization(orgId, { name: orgName.trim(), description: orgDesc.trim() || null })
      setEditingOrg(false)
      loadData()
    } catch {
      setError('Fehler beim Aktualisieren.')
    }
  }

  const handleCreateArt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !artName.trim()) return
    setSavingArt(true)
    try {
      await createART({ org_id: orgId, name: artName.trim(), description: artDesc.trim() || null })
      setArtName('')
      setArtDesc('')
      setShowArtForm(false)
      loadData()
    } catch {
      setError('Fehler beim Erstellen des ART.')
    } finally {
      setSavingArt(false)
    }
  }

  const handleDeleteArt = async (art: ART) => {
    if (!confirm(`ART «${art.name}» und alle zugehörigen Daten löschen?`)) return
    try {
      await deleteART(art.id)
      loadData()
    } catch {
      setError('Fehler beim Löschen.')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (loading) {
    return (
      <>
        <Head><title>Lädt… – AI@DZ</title></Head>
        <AdminLayout><p className="text-gray-400 text-sm">Lädt…</p></AdminLayout>
      </>
    )
  }

  if (!org) {
    return (
      <>
        <Head><title>Nicht gefunden – AI@DZ</title></Head>
        <AdminLayout><p className="text-red-600 text-sm">Arbeitsorganisation nicht gefunden.</p></AdminLayout>
      </>
    )
  }

  return (
    <>
      <Head><title>{org.name} – AI@DZ</title></Head>
      <AdminLayout title={org.name}>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {/* AO Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {editingOrg ? (
            <form onSubmit={handleUpdateOrg} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Arbeitsorganisation bearbeiten</h2>
              <div>
                <label htmlFor="org-name" className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input
                  id="org-name"
                  type="text" value={orgName} onChange={e => setOrgName(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label htmlFor="org-desc" className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung</label>
                <input
                  id="org-desc"
                  type="text" value={orgDesc} onChange={e => setOrgDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg">
                  Speichern
                </button>
                <button type="button" onClick={() => setEditingOrg(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                  Abbrechen
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{org.name}</h2>
                {org.description && <p className="text-sm text-gray-500 mt-1">{org.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => setEditingOrg(true)}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                Bearbeiten
              </button>
            </div>
          )}
        </div>

        {/* ARTs */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Agile Release Trains</h2>
          <button
            type="button"
            onClick={() => setShowArtForm(v => !v)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Neuer ART
          </button>
        </div>

        {showArtForm && (
          <form
            onSubmit={handleCreateArt}
            className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3"
          >
            <h3 className="text-sm font-semibold text-gray-700">Neuer ART</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text" value={artName} onChange={e => setArtName(e.target.value)} required
                placeholder="z.B. Platform Engineering"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="art-desc" className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung (optional)</label>
              <input
                id="art-desc"
                type="text" value={artDesc} onChange={e => setArtDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingArt} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                {savingArt ? 'Speichern…' : 'Speichern'}
              </button>
              <button type="button" onClick={() => { setShowArtForm(false); setArtName(''); setArtDesc('') }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Abbrechen
              </button>
            </div>
          </form>
        )}

        {arts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Noch keine ARTs vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {arts.map(art => (
              <div key={art.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{art.name}</h3>
                    {art.description && <p className="text-sm text-gray-500 mt-0.5">{art.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteArt(art)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Löschen
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="font-medium text-gray-700 mb-1">Bearbeitungslink (Edit)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] text-gray-500 break-all flex-1">
                        {baseUrl}/plan?token={art.edit_token}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${baseUrl}/plan?token=${art.edit_token}`)}
                        className="text-brand-600 hover:text-brand-700 shrink-0"
                      >
                        Kopieren
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="font-medium text-gray-700 mb-1">Leselink (Read-only)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] text-gray-500 break-all flex-1">
                        {baseUrl}/plan?token={art.readonly_token}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${baseUrl}/plan?token=${art.readonly_token}`)}
                        className="text-brand-600 hover:text-brand-700 shrink-0"
                      >
                        Kopieren
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </>
  )
}
