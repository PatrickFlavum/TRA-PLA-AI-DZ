import { useEffect, useState, useCallback } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { loadARTByToken, loadOrganization, loadPlanVersionByNumber, loadCapabilities } from '@/lib/supabase'
import type { ART, Organization, PlanVersion, BizDevOpsCapability } from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

type SnapshotMember = { role?: string; type: 'intern' | 'extern'; category: 'business' | 'it'; fte: number; headcount: number }
type SnapshotTeam = {
  name: string
  description?: string | null
  members: SnapshotMember[]
  allocations: { capability?: string; percentage: number }[]
}
type Snapshot = {
  art: {
    name?: string
    description?: string | null
    mission_statement?: string | null
    business_context?: string | null
    risks?: string | null
    budget_2027?: number | null
  }
  teams: SnapshotTeam[]
}

type SummaryRow = {
  roleName: string
  internHC: number; internFTE: number; externHC: number; externFTE: number
  businessHC: number; businessFTE: number; itHC: number; itFTE: number
  totalHC: number; totalFTE: number
}

function buildSummary(members: SnapshotMember[]): SummaryRow[] {
  const roleNames = Array.from(new Set(members.map(m => m.role ?? 'Unbekannt')))
  return roleNames.map(roleName => {
    const rm = members.filter(m => (m.role ?? 'Unbekannt') === roleName)
    return {
      roleName,
      internHC: rm.filter(m => m.type === 'intern').reduce((s, m) => s + m.headcount, 0),
      internFTE: rm.filter(m => m.type === 'intern').reduce((s, m) => s + m.fte, 0),
      externHC: rm.filter(m => m.type === 'extern').reduce((s, m) => s + m.headcount, 0),
      externFTE: rm.filter(m => m.type === 'extern').reduce((s, m) => s + m.fte, 0),
      businessHC: rm.filter(m => m.category === 'business').reduce((s, m) => s + m.headcount, 0),
      businessFTE: rm.filter(m => m.category === 'business').reduce((s, m) => s + m.fte, 0),
      itHC: rm.filter(m => m.category === 'it').reduce((s, m) => s + m.headcount, 0),
      itFTE: rm.filter(m => m.category === 'it').reduce((s, m) => s + m.fte, 0),
      totalHC: rm.reduce((s, m) => s + m.headcount, 0),
      totalFTE: rm.reduce((s, m) => s + m.fte, 0),
    }
  }).filter(r => r.totalHC > 0)
}

function sumTotals(rows: SummaryRow[]) {
  return {
    internHC: rows.reduce((s, r) => s + r.internHC, 0), internFTE: rows.reduce((s, r) => s + r.internFTE, 0),
    externHC: rows.reduce((s, r) => s + r.externHC, 0), externFTE: rows.reduce((s, r) => s + r.externFTE, 0),
    businessHC: rows.reduce((s, r) => s + r.businessHC, 0), businessFTE: rows.reduce((s, r) => s + r.businessFTE, 0),
    itHC: rows.reduce((s, r) => s + r.itHC, 0), itFTE: rows.reduce((s, r) => s + r.itFTE, 0),
    totalHC: rows.reduce((s, r) => s + r.totalHC, 0), totalFTE: rows.reduce((s, r) => s + r.totalFTE, 0),
  }
}

function fmtFTE(n: number) { return n.toFixed(1) }

function formatCHF(n: number | null | undefined) {
  if (n == null) return '–'
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(n)
}

function SummaryTable({ rows, totals }: { rows: SummaryRow[]; totals: ReturnType<typeof sumTotals> }) {
  if (rows.length === 0) return <p className="text-gray-400 text-xs py-2">Keine Mitarbeitenden erfasst.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2 font-medium">Rolle</th>
            <th className="pb-2 font-medium text-center" colSpan={2}>Intern</th>
            <th className="pb-2 font-medium text-center" colSpan={2}>Extern</th>
            <th className="pb-2 font-medium text-center" colSpan={2}>Business</th>
            <th className="pb-2 font-medium text-center" colSpan={2}>IT</th>
            <th className="pb-2 font-medium text-center bg-brand-50 text-brand-700 rounded-t" colSpan={2}>Total</th>
          </tr>
          <tr className="text-[10px] text-gray-400 border-b border-gray-100">
            <th className="pb-1"></th>
            {['HC','FTE','HC','FTE','HC','FTE','HC','FTE'].map((l, i) => (
              <th key={i} className="pb-1 text-center font-normal">{l}</th>
            ))}
            <th className="pb-1 text-center font-normal bg-brand-50 text-brand-600">HC</th>
            <th className="pb-1 text-center font-normal bg-brand-50 text-brand-600">FTE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.roleName} className="border-b border-gray-50">
              <td className="py-1.5 text-gray-900">{r.roleName}</td>
              <td className="text-center tabular-nums">{r.internHC}</td><td className="text-center tabular-nums">{fmtFTE(r.internFTE)}</td>
              <td className="text-center tabular-nums">{r.externHC}</td><td className="text-center tabular-nums">{fmtFTE(r.externFTE)}</td>
              <td className="text-center tabular-nums">{r.businessHC}</td><td className="text-center tabular-nums">{fmtFTE(r.businessFTE)}</td>
              <td className="text-center tabular-nums">{r.itHC}</td><td className="text-center tabular-nums">{fmtFTE(r.itFTE)}</td>
              <td className="text-center tabular-nums font-semibold bg-brand-50 text-brand-700">{r.totalHC}</td>
              <td className="text-center tabular-nums font-semibold bg-brand-50 text-brand-700">{fmtFTE(r.totalFTE)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-200 font-bold">
            <td className="py-1.5 text-gray-900">Total</td>
            <td className="text-center tabular-nums">{totals.internHC}</td><td className="text-center tabular-nums">{fmtFTE(totals.internFTE)}</td>
            <td className="text-center tabular-nums">{totals.externHC}</td><td className="text-center tabular-nums">{fmtFTE(totals.externFTE)}</td>
            <td className="text-center tabular-nums">{totals.businessHC}</td><td className="text-center tabular-nums">{fmtFTE(totals.businessFTE)}</td>
            <td className="text-center tabular-nums">{totals.itHC}</td><td className="text-center tabular-nums">{fmtFTE(totals.itFTE)}</td>
            <td className="text-center tabular-nums bg-brand-100 text-brand-800 rounded-b">{totals.totalHC}</td>
            <td className="text-center tabular-nums bg-brand-100 text-brand-800 rounded-b">{fmtFTE(totals.totalFTE)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function StackedBar({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const barSlices = slices.filter(s => s.value > 0)
  if (slices.length === 0) return null
  return (
    <div>
      <div className="w-full rounded-lg overflow-hidden flex bg-gray-100" style={{ height: 28 }}>
        {barSlices.map((sl, i) => (
          <div key={i} style={{ width: `${sl.value}%`, backgroundColor: sl.color }} title={`${sl.label}: ${sl.value}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: sl.color }} />
            <span className="text-xs text-gray-700">{sl.label}</span>
            <span className="text-xs text-gray-400 tabular-nums">{sl.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PlanVersionPage() {
  const router = useRouter()
  const token = router.query.token as string
  const versionParam = router.query.v as string

  const [art, setArt] = useState<ART | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [version, setVersion] = useState<PlanVersion | null>(null)
  const [capabilities, setCapabilities] = useState<BizDevOpsCapability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!token || !versionParam) return
    const versionNumber = parseInt(versionParam)
    if (isNaN(versionNumber)) { setError('Ungültige Versionsnummer.'); setLoading(false); return }
    try {
      let a = await loadARTByToken(token, 'edit_token')
      if (!a) a = await loadARTByToken(token, 'readonly_token')
      if (!a) { setError('Transformationsplan nicht gefunden.'); setLoading(false); return }
      setArt(a)

      const [o, v, c] = await Promise.all([
        loadOrganization(a.org_id),
        loadPlanVersionByNumber(a.id, versionNumber),
        loadCapabilities(),
      ])
      setOrg(o); setCapabilities(c)
      if (!v) { setError(`Version ${versionNumber} nicht gefunden.`); setLoading(false); return }
      setVersion(v)
    } catch { setError('Fehler beim Laden.') }
    finally { setLoading(false) }
  }, [token, versionParam])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return (<><Head><title>Lädt…</title></Head><div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Lädt…</p></div></>)
  if (error || !art || !version) return (<><Head><title>Nicht gefunden</title></Head><div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-600 text-sm">{error ?? 'Nicht gefunden.'}</p></div></>)

  if (!version.snapshot) {
    return (
      <>
        <Head><title>Version {version.version_number} – AI@DZ</title></Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <p className="text-gray-500 text-sm text-center">Version {version.version_number} ist noch ein Draft und wurde noch nicht eingecheckt – es liegt kein gespeicherter Stand vor.</p>
        </div>
      </>
    )
  }

  const snapshot = version.snapshot as Snapshot
  const allMembers = snapshot.teams.flatMap(t => t.members)
  const artSummary = buildSummary(allMembers)
  const artTotals = sumTotals(artSummary)

  const getColor = (name?: string) => capabilities.find(c => c.name === name)?.color ?? '#6366f1'

  const artCapAllocation: Record<string, number> = {}
  const totalFTE = snapshot.teams.reduce((s, t) => s + t.members.reduce((ms, m) => ms + m.fte, 0), 0)
  if (totalFTE > 0) {
    const capNames = Array.from(new Set(snapshot.teams.flatMap(t => t.allocations.map(a => a.capability).filter(Boolean) as string[])))
    capNames.forEach(capName => {
      let capFTE = 0
      snapshot.teams.forEach(t => {
        const teamFTE = t.members.reduce((s, m) => s + m.fte, 0)
        const pct = t.allocations.find(a => a.capability === capName)?.percentage ?? 0
        capFTE += (teamFTE * pct) / 100
      })
      artCapAllocation[capName] = Math.round((capFTE / totalFTE) * 1000) / 10
    })
  }

  return (
    <>
      <Head><title>{snapshot.art.name ?? art.name} – Version {version.version_number} – AI@DZ</title></Head>
      <div className="min-h-screen bg-gray-50 print:bg-white">
        <header className="bg-white border-b border-gray-200 print:hidden">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-brand-600 uppercase tracking-wide">AI@DZ</span>
            <button type="button" onClick={() => window.print()} className="px-4 py-2 border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Als PDF drucken</button>
          </div>
          <div className="max-w-5xl mx-auto px-4 pb-2">
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
              Historische Ansicht – Version {version.version_number} (eingecheckt am {version.checked_in_at ? new Date(version.checked_in_at).toLocaleDateString('de-CH') : '–'})
            </span>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <p className="text-sm text-gray-500 mb-2">{org?.name ?? ''}</p>
            <h2 className="text-xl font-bold text-gray-900">Transformationsplan {snapshot.art.name ?? art.name}</h2>
            {snapshot.art.description && <p className="text-sm text-gray-500 mt-1">{snapshot.art.description}</p>}

            {snapshot.art.mission_statement && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mission Statement / Beschreibung ART</h4>
                <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: snapshot.art.mission_statement }} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Teams</p>
              <p className="text-2xl font-bold text-gray-900">{snapshot.teams.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Mitarbeitende</p>
              <p className="text-2xl font-bold text-gray-900">{fmtFTE(artTotals.totalFTE)} <span className="text-sm font-normal text-gray-400">FTE</span></p>
              <p className="text-xs text-gray-500">{artTotals.totalHC} HC</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Budget 2027</p>
              <p className="text-2xl font-bold text-gray-900">{formatCHF(snapshot.art.budget_2027)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {snapshot.art.business_context && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Context & Roadmap</h4>
                <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: snapshot.art.business_context }} />
              </div>
            )}
            {snapshot.art.risks && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Risiken & Störfaktoren</h4>
                <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: snapshot.art.risks }} />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h5 className="text-sm font-semibold text-gray-700 mb-2">Übersicht Mitarbeitende</h5>
            <SummaryTable rows={artSummary} totals={artTotals} />
          </div>

          {Object.keys(artCapAllocation).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h5 className="text-sm font-semibold text-gray-700 mb-2">FTE-Aufteilung nach BizDevOps Capabilities (ART-Gesamt)</h5>
              <StackedBar slices={Object.entries(artCapAllocation).map(([name, value]) => ({ label: name, value, color: getColor(name) }))} />
            </div>
          )}

          <h2 className="text-base font-bold text-gray-900 pb-3 mb-4 border-b border-gray-200">Aktuelle Team-Strukturen</h2>
          <div className="space-y-4">
            {snapshot.teams.map((team, i) => {
              const teamSummary = buildSummary(team.members)
              const teamTotals = sumTotals(teamSummary)
              const allocSlices = team.allocations.filter(a => a.capability).map(a => ({ label: a.capability as string, value: a.percentage, color: getColor(a.capability) }))
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 print-no-break">
                  <h4 className="text-base font-semibold text-gray-900">{team.name}</h4>
                  {team.description && <p className="text-xs text-gray-500 mt-0.5 mb-3">{team.description}</p>}
                  <h5 className="text-sm font-semibold text-gray-700 mb-2 mt-3">Team-Zusammenstellung</h5>
                  <SummaryTable rows={teamSummary} totals={teamTotals} />
                  {allocSlices.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">BizDevOps Kapazitätsverteilung</h5>
                      <StackedBar slices={allocSlices} />
                    </div>
                  )}
                </div>
              )
            })}
            {snapshot.teams.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Keine Teams in dieser Version.</p>}
          </div>
        </div>
      </div>
    </>
  )
}
