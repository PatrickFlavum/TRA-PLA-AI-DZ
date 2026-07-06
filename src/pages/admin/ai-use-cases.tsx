import { useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  loadAllAIUseCasesAdmin, createAIUseCase, updateAIUseCase, deleteAIUseCase,
  loadCapabilities, loadAllUseCaseCapabilityLinks, saveUseCaseCapabilities,
  loadMaturityLevels, loadAllUseCaseMaturityLinks, saveUseCaseMaturityLevels,
  loadAllARTs, loadOrganizations,
} from '@/lib/supabase'
import type { AIUseCase, AIUseCaseStatus, ART, BizDevOpsCapability, MaturityLevel, Organization } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

const STATUS_OPTIONS: AIUseCaseStatus[] = [
  'In Backlog', 'In Lösungsexploration', 'In Entwicklung', 'Im Rollout', 'In Betrieb', 'Abgebrochen',
]

const STATUS_BADGE: Record<AIUseCaseStatus, string> = {
  'In Backlog': 'bg-gray-100 text-gray-600',
  'In Lösungsexploration': 'bg-blue-50 text-blue-700',
  'In Entwicklung': 'bg-amber-50 text-amber-700',
  'Im Rollout': 'bg-purple-50 text-purple-700',
  'In Betrieb': 'bg-green-50 text-green-700',
  'Abgebrochen': 'bg-red-50 text-red-600',
}

type CapEntry = { capability_id: string; efficiency_potential: string }

function makeCapEntries(capIds: string[]): CapEntry[] {
  return capIds.map(id => ({ capability_id: id, efficiency_potential: '' }))
}

export default function AIUseCasesPage() {
  const [useCases, setUseCases] = useState<AIUseCase[]>([])
  const [capabilities, setCapabilities] = useState<BizDevOpsCapability[]>([])
  const [maturityLevels, setMaturityLevels] = useState<MaturityLevel[]>([])
  const [allArts, setAllArts] = useState<ART[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [capLinks, setCapLinks] = useState<Record<string, CapEntry[]>>({})
  const [maturityLinks, setMaturityLinks] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [link, setLink] = useState('')
  const [status, setStatus] = useState<AIUseCaseStatus | ''>('')
  const [availableFrom, setAvailableFrom] = useState('')
  const [selectedCaps, setSelectedCaps] = useState<CapEntry[]>([])
  const [selectedMaturity, setSelectedMaturity] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editLink, setEditLink] = useState('')
  const [editStatus, setEditStatus] = useState<AIUseCaseStatus | ''>('')
  const [editAvailableFrom, setEditAvailableFrom] = useState('')
  const [editCaps, setEditCaps] = useState<CapEntry[]>([])
  const [editMaturity, setEditMaturity] = useState<string[]>([])

  const loadData = () => {
    Promise.all([
      loadAllAIUseCasesAdmin(), loadCapabilities(), loadMaturityLevels(),
      loadAllUseCaseCapabilityLinks(), loadAllUseCaseMaturityLinks(),
      loadAllARTs(), loadOrganizations(),
    ])
      .then(([uc, caps, ml, capLinksList, matLinksList, arts, organizations]) => {
        setUseCases(uc); setCapabilities(caps); setMaturityLevels(ml)
        setAllArts(arts); setOrgs(organizations)
        const capMap: Record<string, CapEntry[]> = {}
        capLinksList.forEach(l => {
          if (!capMap[l.use_case_id]) capMap[l.use_case_id] = []
          capMap[l.use_case_id].push({
            capability_id: l.capability_id,
            efficiency_potential: l.efficiency_potential != null ? String(l.efficiency_potential) : '',
          })
        })
        setCapLinks(capMap)
        const matMap: Record<string, string[]> = {}
        matLinksList.forEach(l => { matMap[l.use_case_id] = [...(matMap[l.use_case_id] ?? []), l.maturity_level_id] })
        setMaturityLinks(matMap)
      })
      .catch(() => setError('Fehler beim Laden.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const toggleCapEntry = (entries: CapEntry[], setEntries: (v: CapEntry[]) => void, capId: string) => {
    if (entries.some(e => e.capability_id === capId)) {
      setEntries(entries.filter(e => e.capability_id !== capId))
    } else {
      setEntries([...entries, { capability_id: capId, efficiency_potential: '' }])
    }
  }

  const updateCapEfficiency = (entries: CapEntry[], setEntries: (v: CapEntry[]) => void, capId: string, val: string) => {
    setEntries(entries.map(e => e.capability_id === capId ? { ...e, efficiency_potential: val } : e))
  }

  const toggleMaturity = (ids: string[], setIds: (v: string[]) => void, id: string) => {
    setIds(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  const parseEntries = (entries: CapEntry[]) =>
    entries.map(e => ({
      capability_id: e.capability_id,
      efficiency_potential: e.efficiency_potential.trim() ? parseInt(e.efficiency_potential, 10) : null,
    }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setError(null)
    try {
      const uc = await createAIUseCase({
        title: title.trim(),
        description: desc.trim() || null,
        link: link.trim() || null,
        status: status || null,
        available_from: availableFrom || null,
      })
      await Promise.all([
        saveUseCaseCapabilities(uc.id, parseEntries(selectedCaps)),
        saveUseCaseMaturityLevels(uc.id, selectedMaturity),
      ])
      setTitle(''); setDesc(''); setLink(''); setStatus(''); setAvailableFrom('')
      setSelectedCaps([]); setSelectedMaturity([]); setShowForm(false); loadData()
    } catch { setError('Fehler beim Erstellen.') }
    finally { setSaving(false) }
  }

  const handleUpdate = async (id: string) => {
    if (!editTitle.trim()) return
    try {
      await updateAIUseCase(id, {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        link: editLink.trim() || null,
        status: editStatus || null,
        available_from: editAvailableFrom || null,
      })
      await Promise.all([
        saveUseCaseCapabilities(id, parseEntries(editCaps)),
        saveUseCaseMaturityLevels(id, editMaturity),
      ])
      setEditId(null); loadData()
    } catch { setError('Fehler beim Aktualisieren.') }
  }

  const handleDelete = async (uc: AIUseCase) => {
    if (!confirm(`AI Use Case «${uc.title}» löschen?`)) return
    try { await deleteAIUseCase(uc.id); loadData() }
    catch { setError('Fehler beim Löschen. Möglicherweise wird der Use Case noch in einem Transformationsplan verwendet.') }
  }

  const handlePromoteToOfficial = async (uc: AIUseCase) => {
    if (!confirm(`Lokalen Use Case «${uc.title}» zum offiziellen Use Case hochstufen? Er wird dann für alle ARTs sichtbar.`)) return
    try {
      await updateAIUseCase(uc.id, { type: 'official', art_id: null })
      loadData()
    } catch { setError('Fehler beim Hochstufen.') }
  }

  const capName = (id: string) => capabilities.find(c => c.id === id)?.name ?? '–'
  const capColor = (id: string) => capabilities.find(c => c.id === id)?.color ?? '#6366f1'

  const startEdit = (uc: AIUseCase) => {
    setEditId(uc.id)
    setEditTitle(uc.title)
    setEditDesc(uc.description ?? '')
    setEditLink(uc.link ?? '')
    setEditStatus(uc.status ?? '')
    setEditAvailableFrom(uc.available_from ?? '')
    setEditCaps(capLinks[uc.id] ?? [])
    setEditMaturity(maturityLinks[uc.id] ?? [])
  }

  const renderCapabilitySelector = (
    entries: CapEntry[],
    setEntries: (v: CapEntry[]) => void,
    prefix: string
  ) => (
    <div>
      <span className="block text-xs font-medium text-gray-600 mb-1">BizDevOps Capabilities & Effizienzpotential</span>
      <div className="space-y-2">
        {capabilities.map(cap => {
          const entry = entries.find(e => e.capability_id === cap.id)
          const selected = !!entry
          return (
            <div key={cap.id} className="flex items-center gap-2">
              <button type="button"
                onClick={() => toggleCapEntry(entries, setEntries, cap.id)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors whitespace-nowrap ${
                  selected ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                }`}>
                {cap.name}
              </button>
              {selected && (
                <div className="flex items-center gap-1">
                  <input
                    id={`${prefix}-eff-${cap.id}`}
                    type="number" min="0" max="100"
                    value={entry.efficiency_potential}
                    onChange={e => updateCapEfficiency(entries, setEntries, cap.id, e.target.value)}
                    placeholder="0–100"
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <span className="text-xs text-gray-500">% Effizienzpotential</span>
                </div>
              )}
            </div>
          )
        })}
        {capabilities.length === 0 && <span className="text-xs text-gray-400">Keine Capabilities vorhanden.</span>}
      </div>
    </div>
  )

  const renderMaturitySelector = (
    ids: string[],
    setIds: (v: string[]) => void
  ) => (
    <div>
      <span className="block text-xs font-medium text-gray-600 mb-1">Maturitätsstufen</span>
      <div className="flex flex-wrap gap-2">
        {maturityLevels.map(ml => (
          <button key={ml.id} type="button"
            onClick={() => toggleMaturity(ids, setIds, ml.id)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              ids.includes(ml.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
            }`}>
            {ml.code} – {ml.title}
          </button>
        ))}
        {maturityLevels.length === 0 && <span className="text-xs text-gray-400">Keine Maturitätsstufen vorhanden.</span>}
      </div>
    </div>
  )

  const renderUcCard = (uc: AIUseCase) => (
    <div key={uc.id} className="bg-white rounded-xl border border-gray-200 p-4">
      {editId === uc.id ? (
        <div className="space-y-3">
          <input aria-label="Titel" value={editTitle} onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
          <textarea aria-label="Kurzbeschreibung" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
          <input aria-label="Link" value={editLink} onChange={e => setEditLink(e.target.value)} placeholder="https://…"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`edit-status-${uc.id}`} className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select id={`edit-status-${uc.id}`} value={editStatus} onChange={e => setEditStatus(e.target.value as AIUseCaseStatus | '')}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="">– Kein Status –</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`edit-avail-${uc.id}`} className="block text-xs font-medium text-gray-600 mb-1">Geplante Verfügbarkeit ab</label>
              <input id={`edit-avail-${uc.id}`} type="date" value={editAvailableFrom} onChange={e => setEditAvailableFrom(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>
          {renderCapabilitySelector(editCaps, setEditCaps, `edit-${uc.id}`)}
          {renderMaturitySelector(editMaturity, setEditMaturity)}
          <div className="flex gap-2">
            <button type="button" onClick={() => handleUpdate(uc.id)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">Speichern</button>
            <button type="button" onClick={() => setEditId(null)} className="text-sm text-gray-500">Abbrechen</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">{uc.title}</span>
              {uc.type === 'local' && (
                <span className="text-[9px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full font-medium">lokal</span>
              )}
              {uc.status && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[uc.status]}`}>{uc.status}</span>
              )}
              {uc.link && (
                <a href={uc.link} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700">
                  Link ↗
                </a>
              )}
            </div>
            {uc.available_from && (
              <p className="text-xs text-gray-500 mt-0.5">
                Verfügbar ab: {new Date(uc.available_from).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            )}
            {uc.description && <p className="text-xs text-gray-500 mt-1">{uc.description}</p>}
            {(maturityLinks[uc.id] ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(maturityLinks[uc.id] ?? []).map(mlId => {
                  const ml = maturityLevels.find(m => m.id === mlId)
                  if (!ml) return null
                  return (
                    <span key={mlId} className="inline-block px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] font-bold rounded">
                      {ml.code}
                    </span>
                  )
                })}
              </div>
            )}
            {(capLinks[uc.id] ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(capLinks[uc.id] ?? []).map(entry => (
                  <span key={entry.capability_id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: capColor(entry.capability_id) }} />
                    {capName(entry.capability_id)}
                    {entry.efficiency_potential && <span className="ml-1 text-gray-400">{entry.efficiency_potential}%</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {uc.type === 'local' && (
              <button type="button" onClick={() => handlePromoteToOfficial(uc)} className="text-xs text-green-600 hover:text-green-700 font-medium">
                ↑ Offiziell machen
              </button>
            )}
            <button type="button" onClick={() => startEdit(uc)} className="text-xs text-brand-600 hover:text-brand-700">Bearbeiten</button>
            <button type="button" onClick={() => handleDelete(uc)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
          </div>
        </div>
      )}
    </div>
  )

  const officialUCs = useCases.filter(uc => uc.type === 'official')
  const localUCs = useCases.filter(uc => uc.type === 'local')

  // Group local UCs by organization name
  const localByOrg: Record<string, AIUseCase[]> = {}
  localUCs.forEach(uc => {
    const art = allArts.find(a => a.id === uc.art_id)
    const org = orgs.find(o => o.id === art?.org_id)
    const key = org?.name ?? 'Unbekannte AO'
    localByOrg[key] = [...(localByOrg[key] ?? []), uc]
  })

  return (
    <>
      <Head><title>AI Use Cases – AI@DZ</title></Head>
      <AdminLayout title="AI Use Cases">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AI Use Cases</h1>
          <button type="button" onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            + Neuer Use Case
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Neuer AI Use Case</h2>
            <div>
              <label htmlFor="uc-title" className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
              <input id="uc-title" type="text" value={title} onChange={e => setTitle(e.target.value)} required
                placeholder="z.B. Code-Review Assistent" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label htmlFor="uc-desc" className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung</label>
              <textarea id="uc-desc" value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label htmlFor="uc-link" className="block text-xs font-medium text-gray-600 mb-1">Link auf weiterführende Informationen</label>
              <input id="uc-link" type="url" value={link} onChange={e => setLink(e.target.value)}
                placeholder="https://…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="uc-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select id="uc-status" value={status} onChange={e => setStatus(e.target.value as AIUseCaseStatus | '')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">– Kein Status –</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="uc-avail" className="block text-xs font-medium text-gray-600 mb-1">Geplante Verfügbarkeit ab</label>
                <input id="uc-avail" type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            {renderCapabilitySelector(selectedCaps, setSelectedCaps, 'new')}
            {renderMaturitySelector(selectedMaturity, setSelectedMaturity)}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                {saving ? 'Speichern…' : 'Speichern'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
            </div>
          </form>
        )}

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? <p className="text-gray-400 text-sm">Lädt…</p> : (
          <div className="space-y-6">
            {/* Offizielle Use Cases */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Offizielle Use Cases <span className="ml-1 font-normal normal-case text-gray-400">({officialUCs.length})</span>
              </h2>
              {officialUCs.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                  <p className="text-gray-500 text-sm">Noch keine offiziellen AI Use Cases vorhanden.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {officialUCs.map(uc => renderUcCard(uc))}
                </div>
              )}
            </div>

            {/* Lokale Use Cases (nach AO gruppiert) */}
            {localUCs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Lokale Use Cases <span className="ml-1 font-normal normal-case text-gray-400">({localUCs.length})</span>
                </h2>
                <div className="space-y-6">
                  {Object.entries(localByOrg).sort(([a], [b]) => a.localeCompare(b, 'de')).map(([orgName, ucs]) => (
                    <div key={orgName}>
                      <h3 className="text-xs font-semibold text-orange-600 mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                        {orgName} <span className="font-normal text-gray-400">({ucs.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {ucs.map(uc => renderUcCard(uc))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </>
  )
}
