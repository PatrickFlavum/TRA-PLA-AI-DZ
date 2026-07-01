import { useEffect, useState, useCallback } from 'react'
import type { GetStaticProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { CollapsibleSection } from '@/components/plan/CollapsibleSection'
import { RichTextEditor } from '@/components/plan/RichTextEditor'
import { TeamMemberTable } from '@/components/plan/TeamMemberTable'
import { CapabilitySliders } from '@/components/plan/CapabilitySliders'
import { StackedBar } from '@/components/plan/StackedBar'
import {
  loadARTByToken, updateART, loadOrganization,
  loadPlanVersions, createPlanVersion, checkInVersion,
  loadTeams, createTeam, updateTeam, deleteTeam,
  loadAllTeamMembers, createTeamMember, deleteTeamMember,
  loadAllTeamAllocations, saveTeamAllocations,
  loadEmployeeRoles, loadCapabilities, loadGuidanceModes,
  loadAIUseCases, loadAllUseCaseCapabilityLinks,
  loadARTUseCases, addUseCaseToART, removeUseCaseFromART, upsertARTUseCaseStatus,
  loadARTUseCaseDates, upsertARTUseCaseDateRow, deleteARTUseCaseDateRows,
  loadMaturityLevels, loadAllUseCaseMaturityLinks,
} from '@/lib/supabase'
import type {
  ART, Organization, PlanVersion, Team, TeamMember,
  EmployeeRole, BizDevOpsCapability, GuidanceMode,
  AIUseCase, AIUseCaseStatus, AIUseCaseCapability, AIUseCaseMaturityLevel,
  MaturityLevel, ARTUseCase, ARTUseCaseStatus, ARTUseCaseDateRow,
  CyberCriticality,
} from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

type TeamData = { team: Team; members: TeamMember[]; allocations: Record<string, number> }

type SummaryRow = {
  roleName: string
  internHC: number; internFTE: number; externHC: number; externFTE: number
  businessHC: number; businessFTE: number; itHC: number; itFTE: number
  totalHC: number; totalFTE: number
}

function buildSummary(members: TeamMember[], roles: EmployeeRole[]): SummaryRow[] {
  return roles.map(role => {
    const rm = members.filter(m => m.role_id === role.id)
    return {
      roleName: role.name,
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
            <th className="pb-1" aria-label="Unterkategorie"></th>
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

function fmtFTE(n: number) { return n.toFixed(1) }

function formatCHF(n: number | null) {
  if (n == null) return '–'
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
}

function quarterKey(dateStr: string): string {
  const d = new Date(dateStr)
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${q}`
}

function quarterLabel(key: string): string {
  const [year, q] = key.split('-')
  return `${q} ${year}`
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const router = useRouter()
  const token = router.query.token as string

  const [canEdit, setCanEdit] = useState(false)
  const [art, setArt] = useState<ART | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [versions, setVersions] = useState<PlanVersion[]>([])
  const [latestVersion, setLatestVersion] = useState<PlanVersion | null>(null)
  const [teamsData, setTeamsData] = useState<TeamData[]>([])
  const [roles, setRoles] = useState<EmployeeRole[]>([])
  const [capabilities, setCapabilities] = useState<BizDevOpsCapability[]>([])
  const [guidanceModes, setGuidanceModes] = useState<GuidanceMode[]>([])
  const [useCases, setUseCases] = useState<AIUseCase[]>([])
  const [useCaseCapLinks, setUseCaseCapLinks] = useState<AIUseCaseCapability[]>([])
  const [useCaseMaturityLinks, setUseCaseMaturityLinks] = useState<AIUseCaseMaturityLevel[]>([])
  const [maturityLevels, setMaturityLevels] = useState<MaturityLevel[]>([])
  const [artUseCases, setArtUseCases] = useState<ARTUseCase[]>([])
  const [artUseCaseDates, setArtUseCaseDates] = useState<ARTUseCaseDateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingIntro, setEditingIntro] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingFinanzen, setEditingFinanzen] = useState(false)
  const [editingUseCaseId, setEditingUseCaseId] = useState<string | null>(null)
  const [showAddUseCase, setShowAddUseCase] = useState(false)
  const [selectedUseCaseToAdd, setSelectedUseCaseToAdd] = useState('')
  const [missionStatement, setMissionStatement] = useState('')
  const [businessContext, setBusinessContext] = useState('')
  const [risks, setRisks] = useState('')
  const [guidanceModeId, setGuidanceModeId] = useState<string | null>(null)
  const [guidanceModeReason, setGuidanceModeReason] = useState('')
  const [artLeadership, setArtLeadership] = useState('')
  const [responsiblePerson, setResponsiblePerson] = useState('')
  const [cyberCriticality, setCyberCriticality] = useState<CyberCriticality | ''>('')
  const [cyberCriticalityReason, setCyberCriticalityReason] = useState('')
  const [currentMaturityLevelId, setCurrentMaturityLevelId] = useState<string | null>(null)
  const [budget2027, setBudget2027] = useState('')
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [changeDesc, setChangeDesc] = useState('')
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')

  const isDraft = latestVersion?.status === 'draft'
  const editable = canEdit && isDraft

  // Compute which maturity level is currently reached based on rollout_from dates ≤ today
  const todayStr = new Date().toISOString().split('T')[0]
  const reachedUseCaseIds = Array.from(new Set(
    artUseCaseDates.filter(d => d.rollout_from && d.rollout_from <= todayStr).map(d => d.use_case_id)
  ))
  const reachedMaturityIds = new Set(
    useCaseMaturityLinks.filter(l => reachedUseCaseIds.includes(l.use_case_id)).map(l => l.maturity_level_id)
  )
  // maturityLevels is sorted ascending by code – highest reached = last match
  const computedMaturityLevel = [...maturityLevels].filter(m => reachedMaturityIds.has(m.id)).pop() ?? maturityLevels[0] ?? null

  const loadData = useCallback(async () => {
    if (!token) return
    try {
      let a = await loadARTByToken(token, 'edit_token')
      let isEdit = true
      if (!a) { a = await loadARTByToken(token, 'readonly_token'); isEdit = false }
      if (!a) { setError('Transformationsplan nicht gefunden.'); setLoading(false); return }

      setCanEdit(isEdit); setArt(a)
      setMissionStatement(a.mission_statement ?? '')
      setBusinessContext(a.business_context ?? '')
      setRisks(a.risks ?? '')
      setGuidanceModeId(a.guidance_mode_id)
      setGuidanceModeReason(a.guidance_mode_reason ?? '')
      setArtLeadership(a.art_leadership ?? '')
      setResponsiblePerson(a.responsible_person ?? '')
      setCyberCriticality((a.cyber_criticality as CyberCriticality | '') ?? '')
      setCyberCriticalityReason(a.cyber_criticality_reason ?? '')
      setCurrentMaturityLevelId(a.current_maturity_level_id ?? null)
      setBudget2027(a.budget_2027 != null ? String(a.budget_2027) : '')

      const [o, v, teams, r, c, gm, uc, ucLinks, ucMatLinks, ml, auc, aucDates] = await Promise.all([
        loadOrganization(a.org_id), loadPlanVersions(a.id), loadTeams(a.id),
        loadEmployeeRoles(), loadCapabilities(), loadGuidanceModes(),
        loadAIUseCases(), loadAllUseCaseCapabilityLinks(), loadAllUseCaseMaturityLinks(),
        loadMaturityLevels(), loadARTUseCases(a.id), loadARTUseCaseDates(a.id),
      ])
      setOrg(o); setVersions(v); setLatestVersion(v[0] ?? null)
      setRoles(r); setCapabilities(c); setGuidanceModes(gm)
      setUseCases(uc); setUseCaseCapLinks(ucLinks)
      setUseCaseMaturityLinks(ucMatLinks); setMaturityLevels(ml)
      setArtUseCases(auc); setArtUseCaseDates(aucDates)

      const teamIds = teams.map(t => t.id)
      const [allMembers, allAllocs] = await Promise.all([loadAllTeamMembers(teamIds), loadAllTeamAllocations(teamIds)])
      setTeamsData(teams.map(t => ({
        team: t,
        members: allMembers.filter(m => m.team_id === t.id),
        allocations: allAllocs.filter(al => al.team_id === t.id)
          .reduce((acc, al) => ({ ...acc, [al.capability_id]: al.percentage }), {} as Record<string, number>),
      })))
    } catch { setError('Fehler beim Laden.') }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleSaveIntro = async () => {
    if (!art) return
    setSaving(true)
    try {
      const updates = {
        mission_statement: missionStatement,
        business_context: businessContext,
        risks,
        guidance_mode_id: guidanceModeId,
        guidance_mode_reason: guidanceModeReason || null,
        art_leadership: artLeadership || null,
        responsible_person: responsiblePerson || null,
        cyber_criticality: (cyberCriticality as CyberCriticality) || null,
        cyber_criticality_reason: cyberCriticalityReason || null,
        current_maturity_level_id: currentMaturityLevelId,
      }
      await updateART(art.id, updates)
      setArt({ ...art, ...updates })
      setEditingIntro(false)
    } catch { setError('Fehler beim Speichern.') }
    finally { setSaving(false) }
  }

  const handleCancelIntro = () => {
    setMissionStatement(art?.mission_statement ?? '')
    setBusinessContext(art?.business_context ?? '')
    setRisks(art?.risks ?? '')
    setGuidanceModeId(art?.guidance_mode_id ?? null)
    setGuidanceModeReason(art?.guidance_mode_reason ?? '')
    setArtLeadership(art?.art_leadership ?? '')
    setResponsiblePerson(art?.responsible_person ?? '')
    setCyberCriticality((art?.cyber_criticality as CyberCriticality | '') ?? '')
    setCyberCriticalityReason(art?.cyber_criticality_reason ?? '')
    setCurrentMaturityLevelId(art?.current_maturity_level_id ?? null)
    setEditingIntro(false)
  }

  const handleSaveFinanzen = async () => {
    if (!art) return
    setSaving(true)
    try {
      const b = budget2027.trim() ? parseFloat(budget2027) : null
      await updateART(art.id, { budget_2027: b })
      setArt({ ...art, budget_2027: b }); setEditingFinanzen(false)
    } catch { setError('Fehler beim Speichern.') }
    finally { setSaving(false) }
  }

  const handleNewVersion = async () => {
    if (!art) return
    try { const v = await createPlanVersion(art.id); setLatestVersion(v); setVersions(prev => [v, ...prev]) }
    catch { setError('Fehler beim Erstellen der neuen Version.') }
  }

  const handleCheckIn = async () => {
    if (!latestVersion || !changeDesc.trim()) return
    setSaving(true)
    try {
      const snapshot = {
        art: { name: art?.name, description: art?.description, mission_statement: missionStatement, business_context: businessContext, risks, budget_2027: art?.budget_2027 },
        teams: teamsData.map(td => ({
          name: td.team.name, description: td.team.description,
          members: td.members.map(m => ({ role: roles.find(r => r.id === m.role_id)?.name, type: m.type, category: m.category, fte: m.fte, headcount: m.headcount })),
          allocations: Object.entries(td.allocations).map(([capId, pct]) => ({ capability: capabilities.find(c => c.id === capId)?.name, percentage: pct })),
        })),
      }
      await checkInVersion(latestVersion.id, changeDesc.trim(), snapshot)
      setShowCheckIn(false); setChangeDesc(''); setEditingIntro(false); setEditingTeamId(null); setEditingFinanzen(false)
      loadData()
    } catch { setError('Fehler beim Einchecken.') }
    finally { setSaving(false) }
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!art || !newTeamName.trim()) return
    try {
      await createTeam({ art_id: art.id, name: newTeamName.trim(), description: newTeamDesc.trim() || null })
      setNewTeamName(''); setNewTeamDesc(''); setShowNewTeam(false); loadData()
    } catch { setError('Fehler beim Erstellen des Teams.') }
  }

  const handleSaveTeam = async (teamId: string, name: string, description: string | null) => {
    setSaving(true)
    try {
      await updateTeam(teamId, { name, description })
      const td = teamsData.find(t => t.team.id === teamId)
      if (td) {
        const total = Object.values(td.allocations).reduce((s, v) => s + v, 0)
        if (total === 100 || total === 0) {
          await saveTeamAllocations(teamId, Object.entries(td.allocations).filter(([, v]) => v > 0).map(([capability_id, percentage]) => ({ capability_id, percentage })))
        } else { setSaving(false); setError('Kapazitätsverteilung muss genau 100% ergeben (oder leer sein).'); return }
      }
      setEditingTeamId(null); loadData()
    } catch { setError('Fehler beim Speichern.') }
    finally { setSaving(false) }
  }

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Team «${teamName}» löschen?`)) return
    try { await deleteTeam(teamId); setEditingTeamId(null); loadData() } catch { setError('Fehler beim Löschen.') }
  }

  const handleAddMember = async (teamId: string, member: Pick<TeamMember, 'role_id' | 'type' | 'category' | 'fte' | 'headcount'>) => {
    try { await createTeamMember({ team_id: teamId, ...member }); loadData() } catch { setError('Fehler beim Hinzufügen.') }
  }

  const handleDeleteMember = async (memberId: string) => {
    try { await deleteTeamMember(memberId); loadData() } catch { setError('Fehler beim Löschen.') }
  }

  const handleAllocChange = (teamId: string, capId: string, value: number) => {
    setTeamsData(prev => prev.map(td => td.team.id !== teamId ? td : { ...td, allocations: { ...td.allocations, [capId]: value } }))
  }

  const handleAddUseCase = async () => {
    if (!art || !selectedUseCaseToAdd) return
    try {
      await addUseCaseToART(art.id, selectedUseCaseToAdd, teamsData.map(td => td.team.id))
      setSelectedUseCaseToAdd(''); setShowAddUseCase(false); loadData()
    } catch { setError('Fehler beim Hinzufügen des Use Case.') }
  }

  const handleRemoveUseCase = async (useCaseId: string, title: string) => {
    if (!art) return
    if (!confirm(`AI Use Case «${title}» aus diesem Transformationsplan entfernen?`)) return
    try { await removeUseCaseFromART(art.id, useCaseId); setEditingUseCaseId(null); loadData() }
    catch { setError('Fehler beim Entfernen.') }
  }

  const handleSaveUseCaseStatuses = async (
    useCaseId: string,
    rows: ARTUseCase[],
    dateRows: { teamId: string; capId: string; pilot_from: string | null; rollout_from: string | null; full_usage_from: string | null }[]
  ) => {
    if (!art) return
    setSaving(true)
    try {
      await Promise.all(rows.map(r => upsertARTUseCaseStatus({ art_id: art.id, use_case_id: useCaseId, team_id: r.team_id, status: r.status })))
      const plannedTeamIds = rows.filter(r => r.status === 'planned').map(r => r.team_id)
      const notPlannedTeamIds = rows.filter(r => r.status !== 'planned').map(r => r.team_id)
      await Promise.all(notPlannedTeamIds.map(teamId => deleteARTUseCaseDateRows(art.id, useCaseId, teamId)))
      const relevantDates = dateRows.filter(d => plannedTeamIds.includes(d.teamId))
      await Promise.all(relevantDates.map(d => upsertARTUseCaseDateRow({
        art_id: art.id, use_case_id: useCaseId, team_id: d.teamId, capability_id: d.capId,
        pilot_from: d.pilot_from, rollout_from: d.rollout_from, full_usage_from: d.full_usage_from,
      })))
      setEditingUseCaseId(null); loadData()
    } catch { setError('Fehler beim Speichern.') }
    finally { setSaving(false) }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const allMembers = teamsData.flatMap(td => td.members)
  const artSummary = buildSummary(allMembers, roles)
  const artTotals = sumTotals(artSummary)
  const selectedMode = guidanceModes.find(m => m.id === art?.guidance_mode_id)
  const selectedMaturityLevel = maturityLevels.find(m => m.id === art?.current_maturity_level_id)

  const artCapAllocation: Record<string, number> = {}
  if (teamsData.length > 0) {
    const totalFTE = teamsData.reduce((s, td) => s + td.members.reduce((ms, m) => ms + m.fte, 0), 0)
    if (totalFTE > 0) {
      capabilities.forEach(cap => {
        let capFTE = 0
        teamsData.forEach(td => { capFTE += (td.members.reduce((s, m) => s + m.fte, 0) * (td.allocations[cap.id] ?? 0)) / 100 })
        artCapAllocation[cap.id] = Math.round((capFTE / totalFTE) * 1000) / 10
      })
    }
  }

  const usedUseCaseIds = Array.from(new Set(artUseCases.map(u => u.use_case_id)))
  const availableUseCases = useCases.filter(uc => !usedUseCaseIds.includes(uc.id))

  // ─── Potentialanalyse ──────────────────────────────────────────────────────
  // For each (team, use_case, capability) with status=planned and full_usage_from set:
  // compute FTE savings = teamFTE * allocation% * efficiency_potential%
  // aggregate per quarter (2026–2030)

  const quarters: string[] = []
  for (let y = 2026; y <= 2030; y++) {
    for (let q = 1; q <= 4; q++) quarters.push(`${y}-Q${q}`)
  }

  type PotentialEntry = { teamId: string; quarterKey: string; fteSavings: number }
  const potentialEntries: PotentialEntry[] = []

  teamsData.forEach(td => {
    const teamFTE = td.members.reduce((s, m) => s + m.fte, 0)
    if (teamFTE === 0) return
    usedUseCaseIds.forEach(ucId => {
      const statusRow = artUseCases.find(u => u.use_case_id === ucId && u.team_id === td.team.id)
      if (!statusRow || statusRow.status !== 'planned') return
      const capLinks = useCaseCapLinks.filter(l => l.use_case_id === ucId)
      capLinks.forEach(link => {
        if (link.efficiency_potential == null || link.efficiency_potential === 0) return
        const dateRow = artUseCaseDates.find(
          d => d.use_case_id === ucId && d.team_id === td.team.id && d.capability_id === link.capability_id
        )
        if (!dateRow?.full_usage_from) return
        const fullDate = dateRow.full_usage_from
        const year = new Date(fullDate).getFullYear()
        if (year < 2026 || year > 2030) return
        const capFTE = teamFTE * (td.allocations[link.capability_id] ?? 0) / 100
        const fteSavings = capFTE * link.efficiency_potential / 100
        potentialEntries.push({ teamId: td.team.id, quarterKey: quarterKey(fullDate), fteSavings })
      })
    })
  })

  // Cumulative per quarter per team
  type QuarterTeamMap = Record<string, Record<string, number>> // quarterKey → teamId → cumulative FTE
  const cumulativeMap: QuarterTeamMap = {}
  quarters.forEach(qk => { cumulativeMap[qk] = {} })

  // Sort entries by quarter, then accumulate
  const sortedEntries = [...potentialEntries].sort((a, b) => a.quarterKey.localeCompare(b.quarterKey))
  const runningTotals: Record<string, number> = {}
  teamsData.forEach(td => { runningTotals[td.team.id] = 0 })

  quarters.forEach(qk => {
    sortedEntries.filter(e => e.quarterKey === qk).forEach(e => {
      runningTotals[e.teamId] = (runningTotals[e.teamId] ?? 0) + e.fteSavings
    })
    teamsData.forEach(td => { cumulativeMap[qk][td.team.id] = runningTotals[td.team.id] ?? 0 })
  })

  const hasAnyPotential = potentialEntries.length > 0

  // ─── Loading / error ──────────────────────────────────────────────────────

  if (loading) return (<><Head><title>Lädt…</title></Head><div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Lädt…</p></div></>)
  if (!art) return (<><Head><title>Nicht gefunden</title></Head><div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-600 text-sm">{error ?? 'Nicht gefunden.'}</p></div></>)

  // ─── Page ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Head><title>{art.name} – Transformationsplan – AI@DZ</title></Head>
      <div className="min-h-screen bg-gray-50 print:bg-white">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 print:hidden">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-brand-600 uppercase tracking-wide">AI@DZ</span>
            <div className="flex items-center gap-3">
              {canEdit && (isDraft
                ? <button type="button" onClick={() => setShowCheckIn(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">Version einchecken</button>
                : <button type="button" onClick={handleNewVersion} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">Neue Version erstellen</button>
              )}
              <button type="button" onClick={() => window.print()} className="px-4 py-2 border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Als PDF drucken</button>
            </div>
          </div>
          {canEdit && latestVersion && (
            <div className="max-w-5xl mx-auto px-4 pb-2">
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${isDraft ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                Version {latestVersion.version_number}{isDraft ? ' – Draft' : ''}</span>
              {!isDraft && <span className="text-xs text-gray-400 ml-2">Neue Version erstellen um zu bearbeiten.</span>}
            </div>
          )}
        </header>

        {/* Check-in modal */}
        {showCheckIn && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Version einchecken</h3>
              <label htmlFor="ci-desc" className="block text-xs font-medium text-gray-600 mb-1">Was wurde geändert? *</label>
              <textarea id="ci-desc" value={changeDesc} onChange={e => setChangeDesc(e.target.value)} rows={3} placeholder="Änderungen beschreiben…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowCheckIn(false); setChangeDesc('') }} className="px-4 py-2 text-sm text-gray-600">Abbrechen</button>
                <button type="button" onClick={handleCheckIn} disabled={!changeDesc.trim() || saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                  {saving ? 'Einchecken…' : 'Einchecken'}</button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-5xl mx-auto px-4 mt-4 no-print">
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}
              <button type="button" onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">×</button></p>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 py-6">

          {/* ══════ ÜBERSICHT ══════════════════════════════════════════════ */}
          <CollapsibleSection title="Übersicht" subtitle="Header, Kennzahlen, Business Context & Risiken" defaultOpen={true} hidePrintTitle>

            {/* ── Header Box ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
              <p className="text-sm text-gray-500 mb-2">{org?.name ?? ''}</p>
              <h2 className="text-xl font-bold text-gray-900">Transformationsplan {art.name}</h2>
              {art.description && <p className="text-sm text-gray-500 mt-1">{art.description}</p>}

              {art.mission_statement ? (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mission Statement / Beschreibung ART</h4>
                  <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: art.mission_statement }} />
                </div>
              ) : !editingIntro && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mission Statement / Beschreibung ART</h4>
                  <p className="text-xs text-gray-400 italic">Noch nicht beschrieben.</p>
                </div>
              )}
            </div>

            {/* ── ART-Leitung & Verantwortliche Person ── */}
            {(art.art_leadership || art.responsible_person) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {art.art_leadership && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">ART-Leitung</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{art.art_leadership}</p>
                  </div>
                )}
                {art.responsible_person && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Verantwortliche Person</p>
                    <p className="text-sm text-gray-900">{art.responsible_person}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── 4 KPI Boxes ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Teams</p>
                <p className="text-2xl font-bold text-gray-900">{teamsData.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Mitarbeitende</p>
                <p className="text-2xl font-bold text-gray-900">{fmtFTE(artTotals.totalFTE)} <span className="text-sm font-normal text-gray-400">FTE</span></p>
                <p className="text-xs text-gray-500">{artTotals.totalHC} HC</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Aktuelle AI-Maturität</p>
                {selectedMaturityLevel ? (
                  <>
                    <p className="text-xl font-bold text-gray-900">{selectedMaturityLevel.code}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedMaturityLevel.title}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-300">–</p>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Begleitungsmodus</p>
                <p className="text-base font-bold text-gray-900">{selectedMode ? `${selectedMode.letter} – ${selectedMode.title}` : '–'}</p>
                {art.guidance_mode_reason && (
                  <p className="text-xs text-gray-500 mt-1">{art.guidance_mode_reason}</p>
                )}
              </div>
            </div>

            {/* ── Business Context & Risiken ── */}
            {editingIntro ? (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mission Statement / Beschreibung ART</h4>
                  <RichTextEditor value={missionStatement} onChange={setMissionStatement} placeholder="Mission Statement / Beschreibung des ART…" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">ART-Leitung</h4>
                    <p className="text-[10px] text-gray-400 mb-2">Vorname Name, Rolle</p>
                    <textarea value={artLeadership} onChange={e => setArtLeadership(e.target.value)} rows={3}
                      placeholder="z.B. Max Muster, Chief Product Officer"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Verantwortliche Person für diesen Plan</h4>
                    <p className="text-[10px] text-gray-400 mb-2">Üblicherweise RTE des ART oder STE der AO</p>
                    <input type="text" value={responsiblePerson} onChange={e => setResponsiblePerson(e.target.value)}
                      placeholder="z.B. Anna Muster"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Business Context & Roadmap</h4>
                    <p className="text-[10px] text-gray-400 mb-2">Was kommt in den nächsten 1–5 Jahren auf diesen ART zu?</p>
                    <RichTextEditor value={businessContext} onChange={setBusinessContext} placeholder="Business Context…" />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Risiken & Störfaktoren</h4>
                    <p className="text-[10px] text-gray-400 mb-2">Was könnte die geplante Transformation gefährden?</p>
                    <RichTextEditor value={risks} onChange={setRisks} placeholder="Risiken…" />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cyber-Kritikalität</h4>
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      <label htmlFor="cyber-crit" className="block text-[10px] text-gray-400 mb-1">Einstufung</label>
                      <select id="cyber-crit" value={cyberCriticality} onChange={e => setCyberCriticality(e.target.value as CyberCriticality | '')}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                        <option value="">– Nicht gewählt –</option>
                        <option value="Hoch">Hoch</option>
                        <option value="Mittel">Mittel</option>
                        <option value="Tief">Tief</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label htmlFor="cyber-reason" className="block text-[10px] text-gray-400 mb-1">Begründung</label>
                      <textarea id="cyber-reason" value={cyberCriticalityReason} onChange={e => setCyberCriticalityReason(e.target.value)} rows={3}
                        placeholder="Begründung der Cyber-Kritikalitätseinstufung…"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Begleitungsmodus</h4>
                  <select aria-label="Begleitungsmodus" value={guidanceModeId ?? ''} onChange={e => setGuidanceModeId(e.target.value || null)}
                    className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">– Nicht gewählt –</option>
                    {guidanceModes.map(m => <option key={m.id} value={m.id}>{m.letter} – {m.title}</option>)}
                  </select>
                  <div className="mt-3">
                    <label htmlFor="guidance-reason" className="block text-[10px] text-gray-400 mb-1">Begründung</label>
                    <textarea id="guidance-reason" value={guidanceModeReason} onChange={e => setGuidanceModeReason(e.target.value)} rows={2}
                      placeholder="Begründung für die Wahl des Begleitungsmodus…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Aktuelle AI-Maturität</h4>
                  <p className="text-[10px] text-gray-400 mb-2">Bestimmend ist der Ersteinsatz (Einführung ab).</p>
                  <select aria-label="Aktuelle AI-Maturität" value={currentMaturityLevelId ?? ''} onChange={e => setCurrentMaturityLevelId(e.target.value || null)}
                    className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">– Nicht gewählt –</option>
                    {maturityLevels.map(m => <option key={m.id} value={m.id}>{m.code} – {m.title}</option>)}
                  </select>
                  {computedMaturityLevel && (
                    <p className="text-xs text-gray-400 mt-2">
                      Gemäss Transformationsplan ist die momentan erreichte Stufe: <span className="font-medium text-gray-600">{computedMaturityLevel.code} – {computedMaturityLevel.title}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2 no-print">
                  <button type="button" onClick={handleSaveIntro} disabled={saving}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                    {saving ? 'Speichern…' : 'Speichern'}</button>
                  <button type="button" onClick={handleCancelIntro} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Context & Roadmap</h4>
                    {art.business_context
                      ? <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: art.business_context }} />
                      : <p className="text-xs text-gray-400 italic">Noch nicht beschrieben.</p>}
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Risiken & Störfaktoren</h4>
                    {art.risks
                      ? <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: art.risks }} />
                      : <p className="text-xs text-gray-400 italic">Noch nicht beschrieben.</p>}
                  </div>
                </div>
                {(art.cyber_criticality || art.cyber_criticality_reason) && (
                  <div className="mt-3 bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cyber-Kritikalität</h4>
                    <div className="flex items-start gap-3">
                      {art.cyber_criticality && (
                        <span className={`inline-block shrink-0 px-3 py-1 rounded-full text-sm font-semibold ${
                          art.cyber_criticality === 'Hoch' ? 'bg-red-100 text-red-700' :
                          art.cyber_criticality === 'Mittel' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>{art.cyber_criticality}</span>
                      )}
                      {art.cyber_criticality_reason && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{art.cyber_criticality_reason}</p>
                      )}
                    </div>
                  </div>
                )}
                {editable && (
                  <button type="button" onClick={() => setEditingIntro(true)}
                    className="mt-4 px-4 py-2 border border-gray-200 text-sm text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print">
                    Bearbeiten</button>
                )}
              </>
            )}

            {/* ── Übersicht Mitarbeitende & FTE-Aufteilung ── */}
            <div className="mt-4 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Übersicht Mitarbeitende</h5>
                <SummaryTable rows={artSummary} totals={artTotals} />
              </div>
              {Object.keys(artCapAllocation).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">FTE-Aufteilung nach BizDevOps Capabilities (ART-Gesamt)</h5>
                  <StackedBar slices={capabilities
                    .map(cap => ({ label: cap.name, value: artCapAllocation[cap.id] ?? 0, color: cap.color ?? '#6366f1' }))} />
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* ══════ AKTUELLE TEAM-STRUKTUREN ══════════════════════════════ */}
          <CollapsibleSection title="Teams" subtitle="Teams, Mitarbeitende & BizDevOps Kapazitätsverteilung">
            <div className="space-y-4">
              {teamsData.map(td => {
                const isEditingThis = editingTeamId === td.team.id
                const teamSummary = buildSummary(td.members, roles)
                const teamTotals = sumTotals(teamSummary)
                const hasAnyAllocation = Object.values(td.allocations).some(v => v > 0)
                const allocSlices = capabilities
                  .map(cap => ({ label: cap.name, value: td.allocations[cap.id] ?? 0, color: cap.color ?? '#6366f1' }))

                return (
                  <div key={td.team.id} className="bg-white rounded-xl border border-gray-200 p-5 print-no-break">
                    {isEditingThis ? (
                      <TeamEditMode teamData={td} roles={roles} capabilities={capabilities} saving={saving}
                        onSave={handleSaveTeam} onDeleteTeam={handleDeleteTeam}
                        onAddMember={(m) => handleAddMember(td.team.id, m)} onDeleteMember={handleDeleteMember}
                        onAllocChange={(capId, val) => handleAllocChange(td.team.id, capId, val)} onClose={() => setEditingTeamId(null)} />
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-base font-semibold text-gray-900">{td.team.name}</h4>
                            {td.team.description && <p className="text-xs text-gray-500 mt-0.5">{td.team.description}</p>}
                          </div>
                          {editable && (
                            <button type="button" onClick={() => setEditingTeamId(td.team.id)}
                              className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print">Bearbeiten</button>
                          )}
                        </div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-2">Team-Zusammenstellung</h5>
                        <SummaryTable rows={teamSummary} totals={teamTotals} />
                        {hasAnyAllocation && (
                          <div className="mt-4"><h5 className="text-sm font-semibold text-gray-700 mb-2">BizDevOps Kapazitätsverteilung</h5><StackedBar slices={allocSlices} /></div>
                        )}
                        {(() => {
                          type UcRow = { ucTitle: string; capId: string; pilot_from: string | null; rollout_from: string | null; full_usage_from: string | null }
                          const plannedRows: UcRow[] = []
                          artUseCases
                            .filter(u => u.team_id === td.team.id && u.status === 'planned')
                            .forEach(u => {
                              const uc = useCases.find(x => x.id === u.use_case_id)
                              if (!uc) return
                              const capLinks = useCaseCapLinks.filter(l => l.use_case_id === u.use_case_id)
                              if (capLinks.length === 0) {
                                plannedRows.push({ ucTitle: uc.title, capId: '', pilot_from: null, rollout_from: null, full_usage_from: null })
                              } else {
                                capLinks.forEach(link => {
                                  const dr = artUseCaseDates.find(d => d.use_case_id === u.use_case_id && d.team_id === td.team.id && d.capability_id === link.capability_id)
                                  plannedRows.push({ ucTitle: uc.title, capId: link.capability_id, pilot_from: dr?.pilot_from ?? null, rollout_from: dr?.rollout_from ?? null, full_usage_from: dr?.full_usage_from ?? null })
                                })
                              }
                            })
                          const sorted = plannedRows.sort((a, b) => {
                            const cmp = (x: string | null, y: string | null) => (x ?? '9999') < (y ?? '9999') ? -1 : (x ?? '9999') > (y ?? '9999') ? 1 : 0
                            return cmp(a.pilot_from, b.pilot_from) || cmp(a.rollout_from, b.rollout_from) || cmp(a.full_usage_from, b.full_usage_from)
                          })
                          if (sorted.length === 0) return null
                          return (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-gray-700 mb-2">Geplante AI Use Cases</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-[10px] text-gray-400 border-b border-gray-100">
                                      <th className="pb-1 font-medium pr-3">Use Case</th>
                                      <th className="pb-1 font-medium pr-3">Capability</th>
                                      <th className="pb-1 font-medium pr-3">Prüfung ab</th>
                                      <th className="pb-1 font-medium pr-3">Einführung ab</th>
                                      <th className="pb-1 font-medium">Volle Nutzung ab</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sorted.map((row, i) => {
                                      const cap = capabilities.find(c => c.id === row.capId)
                                      return (
                                        <tr key={i} className="border-b border-gray-50">
                                          <td className="py-1 pr-3 text-gray-900">{row.ucTitle}</td>
                                          <td className="py-1 pr-3">
                                            {cap ? (
                                              <span className="inline-flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cap.color ?? '#6366f1' }} />
                                                {cap.name}
                                              </span>
                                            ) : <span className="text-gray-400">–</span>}
                                          </td>
                                          <td className="py-1 pr-3 text-gray-600">{fmtDate(row.pilot_from)}</td>
                                          <td className="py-1 pr-3 text-gray-600">{fmtDate(row.rollout_from)}</td>
                                          <td className="py-1 text-gray-600">{fmtDate(row.full_usage_from)}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-2">Bearbeitung siehe Use Case Planung</p>
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </div>
                )
              })}
              {teamsData.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Noch keine Teams erfasst.</p>}
              {editable && (showNewTeam ? (
                <form onSubmit={handleCreateTeam} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 no-print">
                  <h4 className="text-sm font-semibold text-gray-700">Neues Team</h4>
                  <div><label htmlFor="nt-name" className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                    <input id="nt-name" type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} required placeholder="z.B. Team Alpha"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
                  <div><label htmlFor="nt-desc" className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung</label>
                    <input id="nt-desc" type="text" value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg">Erstellen</button>
                    <button type="button" onClick={() => setShowNewTeam(false)} className="px-4 py-2 text-sm text-gray-600">Abbrechen</button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setShowNewTeam(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 rounded-xl transition-colors no-print">
                  + Neues Team hinzufügen</button>
              ))}
            </div>
          </CollapsibleSection>

          {/* ══════ USE CASE POTENTIALE ═══════════════════════════════════ */}
          <CollapsibleSection title="Use Case Potentiale" subtitle="Rangliste aller Use Cases nach geschätztem FTE-Potential">
            {(() => {
              type UcRankRow = {
                uc: AIUseCase
                capLinks: AIUseCaseCapability[]
                maturityCodes: string[]
                anzahlTeams: number
                anzahlHC: number
                anzahlFTE: number
                potentialFTE: number
                isRelevant: boolean
              }
              const rows: UcRankRow[] = useCases.map(uc => {
                const caps = useCaseCapLinks.filter(l => l.use_case_id === uc.id)
                const matCodes = useCaseMaturityLinks
                  .filter(l => l.use_case_id === uc.id)
                  .map(l => maturityLevels.find(m => m.id === l.maturity_level_id)?.code ?? '')
                  .filter(Boolean)
                  .sort()

                // Potential: sum over all teams × all capabilities
                let potentialFTE = 0
                teamsData.forEach(td => {
                  const teamFTE = td.members.reduce((s, m) => s + m.fte, 0)
                  caps.forEach(link => {
                    if (!link.efficiency_potential) return
                    const capFTE = teamFTE * (td.allocations[link.capability_id] ?? 0) / 100
                    potentialFTE += capFTE * link.efficiency_potential / 100
                  })
                })

                // Planned teams for this use case
                const plannedTeamIds = artUseCases
                  .filter(u => u.use_case_id === uc.id && u.status === 'planned')
                  .map(u => u.team_id)
                const plannedTeams = teamsData.filter(td => plannedTeamIds.includes(td.team.id))
                const anzahlHC = plannedTeams.reduce((s, td) => s + td.members.reduce((ms, m) => ms + m.headcount, 0), 0)
                const anzahlFTE = plannedTeams.reduce((s, td) => s + td.members.reduce((ms, m) => ms + m.fte, 0), 0)

                return {
                  uc, capLinks: caps, maturityCodes: matCodes,
                  anzahlTeams: plannedTeamIds.length,
                  anzahlHC, anzahlFTE,
                  potentialFTE,
                  isRelevant: potentialFTE > 0,
                }
              })

              const sorted = [...rows].sort((a, b) => {
                if (b.potentialFTE !== a.potentialFTE) return b.potentialFTE - a.potentialFTE
                return a.uc.title.localeCompare(b.uc.title, 'de')
              })

              if (sorted.length === 0) return (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-gray-400 text-sm">Noch keine AI Use Cases im System vorhanden.</p>
                </div>
              )

              const UC_STATUS_BADGE: Partial<Record<AIUseCaseStatus, string>> = {
                'Backlog': 'bg-gray-100 text-gray-600',
                'Lösungsexploration': 'bg-blue-50 text-blue-700',
                'Entwicklung': 'bg-amber-50 text-amber-700',
                'Rollout': 'bg-purple-50 text-purple-700',
                'In Betrieb': 'bg-green-50 text-green-700',
                'Abgebrochen': 'bg-red-50 text-red-600',
              }

              return (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] text-gray-400 border-b border-gray-200">
                          <th className="pb-2 font-medium pr-2">#</th>
                          <th className="pb-2 font-medium pr-3">Use Case</th>
                          <th className="pb-2 font-medium pr-3">Capabilities</th>
                          <th className="pb-2 font-medium pr-3">Maturität</th>
                          <th className="pb-2 font-medium pr-3">Status</th>
                          <th className="pb-2 font-medium pr-3">Verfügbar ab</th>
                          <th className="pb-2 font-medium text-center pr-2">Teams</th>
                          <th className="pb-2 font-medium text-center pr-2">HC / FTE</th>
                          <th className="pb-2 font-medium text-center bg-brand-50 text-brand-700 rounded-t px-2">Potential (FTE)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((row, i) => {
                          const gray = !row.isRelevant ? 'text-gray-300' : 'text-gray-800'
                          const subGray = !row.isRelevant ? 'text-gray-300' : 'text-gray-500'
                          return (
                            <tr key={row.uc.id} className={`border-b border-gray-50 ${!row.isRelevant ? 'opacity-50' : ''}`}>
                              <td className={`py-2 pr-2 font-medium tabular-nums ${gray}`}>{i + 1}</td>
                              <td className={`py-2 pr-3 font-medium ${gray}`}>
                                {row.uc.title}
                                {row.uc.description && <p className={`font-normal mt-0.5 ${subGray}`}>{row.uc.description}</p>}
                              </td>
                              <td className="py-2 pr-3">
                                <div className="flex flex-wrap gap-1">
                                  {row.capLinks.map(link => {
                                    const cap = capabilities.find(c => c.id === link.capability_id)
                                    if (!cap) return null
                                    return (
                                      <span key={link.capability_id} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${row.isRelevant ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-300'}`}>
                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: row.isRelevant ? (cap.color ?? '#6366f1') : '#d1d5db' }} />
                                        {cap.name}
                                        {link.efficiency_potential != null && <span className="ml-0.5 text-gray-400">{link.efficiency_potential}%</span>}
                                      </span>
                                    )
                                  })}
                                  {row.capLinks.length === 0 && <span className={subGray}>–</span>}
                                </div>
                              </td>
                              <td className="py-2 pr-3">
                                <div className="flex flex-wrap gap-1">
                                  {row.maturityCodes.map(code => (
                                    <span key={code} className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${row.isRelevant ? 'bg-brand-100 text-brand-700' : 'bg-gray-50 text-gray-300'}`}>{code}</span>
                                  ))}
                                  {row.maturityCodes.length === 0 && <span className={subGray}>–</span>}
                                </div>
                              </td>
                              <td className="py-2 pr-3">
                                {row.uc.status ? (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.isRelevant ? (UC_STATUS_BADGE[row.uc.status] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-50 text-gray-300'}`}>
                                    {row.uc.status}
                                  </span>
                                ) : <span className={subGray}>–</span>}
                              </td>
                              <td className={`py-2 pr-3 tabular-nums ${subGray}`}>
                                {row.uc.available_from ? fmtDate(row.uc.available_from) : '–'}
                              </td>
                              <td className={`py-2 pr-2 text-center tabular-nums ${gray}`}>{row.anzahlTeams}</td>
                              <td className={`py-2 pr-2 text-center tabular-nums ${subGray}`}>
                                {row.isRelevant && row.anzahlTeams > 0 ? `${row.anzahlHC} / ${fmtFTE(row.anzahlFTE)}` : '–'}
                              </td>
                              <td className={`py-2 text-center tabular-nums font-semibold px-2 ${row.isRelevant ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-300'}`}>
                                {row.potentialFTE > 0 ? fmtFTE(row.potentialFTE) : '0.0'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-3">
                    Potential = FTE je Capability × Allokation je Team × Effizienzpotential. Ausgegraut = keine passende Capability-Allokation oder kein Effizienzpotential erfasst.
                  </p>
                </div>
              )
            })()}
          </CollapsibleSection>

          {/* ══════ USE CASE PLANUNG ══════════════════════════════════════ */}
          <CollapsibleSection title="Use Case Planung" subtitle="Geplante Verwendungen von AI Use Cases pro Team">
            <div className="space-y-4">
              {usedUseCaseIds.map(ucId => {
                const uc = useCases.find(u => u.id === ucId)
                if (!uc) return null
                const capLinks = useCaseCapLinks.filter(l => l.use_case_id === ucId)
                const statusRows: ARTUseCase[] = teamsData.map(td => {
                  const existing = artUseCases.find(u => u.use_case_id === ucId && u.team_id === td.team.id)
                  return existing ?? {
                    id: `new-${ucId}-${td.team.id}`, art_id: art.id, use_case_id: ucId, team_id: td.team.id,
                    status: 'not_planned', created_at: '',
                  }
                })
                const isEditingThis = editingUseCaseId === ucId

                return (
                  <div key={ucId} className="bg-white rounded-xl border border-gray-200 p-5 print-no-break">
                    {isEditingThis ? (
                      <UseCaseEditMode
                        useCase={uc}
                        teams={teamsData.map(td => td.team)}
                        statusRows={statusRows}
                        capLinks={capLinks}
                        capabilities={capabilities}
                        existingDates={artUseCaseDates.filter(d => d.use_case_id === ucId)}
                        saving={saving}
                        onSave={(rows, dateRows) => handleSaveUseCaseStatuses(ucId, rows, dateRows)}
                        onRemove={() => handleRemoveUseCase(ucId, uc.title)}
                        onClose={() => setEditingUseCaseId(null)}
                      />
                    ) : (
                      <UseCaseView
                        useCase={uc}
                        teams={teamsData.map(td => td.team)}
                        statusRows={statusRows}
                        capabilities={capabilities}
                        capLinks={capLinks}
                        existingDates={artUseCaseDates.filter(d => d.use_case_id === ucId)}
                        editable={editable}
                        onEdit={() => setEditingUseCaseId(ucId)}
                      />
                    )}
                  </div>
                )
              })}
              {usedUseCaseIds.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Noch keine AI Use Cases geplant.</p>}

              {editable && (showAddUseCase ? (
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 no-print">
                  <h4 className="text-sm font-semibold text-gray-700">AI Use Case hinzufügen</h4>
                  {availableUseCases.length === 0 ? (
                    <p className="text-xs text-gray-400">Alle verfügbaren AI Use Cases sind bereits erfasst.</p>
                  ) : (
                    <select aria-label="AI Use Case auswählen" value={selectedUseCaseToAdd} onChange={e => setSelectedUseCaseToAdd(e.target.value)}
                      className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                      <option value="">– Use Case auswählen –</option>
                      {availableUseCases.map(uc => <option key={uc.id} value={uc.id}>{uc.title}</option>)}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAddUseCase} disabled={!selectedUseCaseToAdd}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">Hinzufügen</button>
                    <button type="button" onClick={() => { setShowAddUseCase(false); setSelectedUseCaseToAdd('') }} className="px-4 py-2 text-sm text-gray-600">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowAddUseCase(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 rounded-xl transition-colors no-print">
                  + AI Use Case hinzufügen</button>
              ))}
            </div>
          </CollapsibleSection>

          {/* ══════ POTENTIALANALYSE ══════════════════════════════════════ */}
          <CollapsibleSection title="Potentialanalyse" subtitle="Geschätztes FTE-Effizienzpotential nach Quartal (2026–2030)">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {!hasAnyPotential ? (
                <p className="text-gray-400 text-sm">Noch kein Potential berechenbar. Plane AI Use Cases mit Status «Geplant», Volle-Nutzung-Datum und Effizienzpotential pro Capability.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-4">
                    Kumulatives FTE-Einsparpotential pro Quartal, basierend auf den geplanten Use Cases, Volle-Nutzung-Daten und Effizienzpotentialen je Capability.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="pb-2 font-medium pr-4">Quartal</th>
                          {teamsData.map(td => (
                            <th key={td.team.id} className="pb-2 font-medium text-center px-2">{td.team.name}</th>
                          ))}
                          <th className="pb-2 font-medium text-center px-2 bg-brand-50 text-brand-700">ART Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quarters.map(qk => {
                          const teamVals = teamsData.map(td => cumulativeMap[qk]?.[td.team.id] ?? 0)
                          const total = teamVals.reduce((s, v) => s + v, 0)
                          const hasData = total > 0
                          return (
                            <tr key={qk} className={`border-b border-gray-50 ${!hasData ? 'text-gray-300' : ''}`}>
                              <td className="py-1.5 pr-4 font-medium">{quarterLabel(qk)}</td>
                              {teamVals.map((val, i) => (
                                <td key={i} className="py-1.5 text-center tabular-nums px-2">
                                  {val > 0 ? fmtFTE(val) : '–'}
                                </td>
                              ))}
                              <td className={`py-1.5 text-center tabular-nums font-semibold px-2 ${hasData ? 'bg-brand-50 text-brand-700' : 'bg-brand-50 text-gray-300'}`}>
                                {total > 0 ? fmtFTE(total) : '–'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-3">Einheit: FTE-Äquivalent (geschätzte Arbeitszeit-Ersparnis pro Quartal, kumulativ ab Volle-Nutzung-Datum).</p>
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* ══════ FINANZEN ══════════════════════════════════════════════ */}
          <CollapsibleSection title="Finanzen" subtitle="Budget & Kostenplanung">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {editingFinanzen ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="budget-2027" className="block text-xs font-medium text-gray-600 mb-1">Budget 2027 (CHF)</label>
                    <input id="budget-2027" type="number" step="1000" min="0" value={budget2027} onChange={e => setBudget2027(e.target.value)}
                      placeholder="z.B. 1500000" className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSaveFinanzen} disabled={saving}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                      {saving ? 'Speichern…' : 'Speichern'}</button>
                    <button type="button" onClick={() => { setBudget2027(art.budget_2027 != null ? String(art.budget_2027) : ''); setEditingFinanzen(false) }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Budget 2027</p>
                    <p className="text-xl font-bold text-gray-900">{formatCHF(art.budget_2027)}</p>
                  </div>
                  {editable && (
                    <button type="button" onClick={() => setEditingFinanzen(true)}
                      className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print">Bearbeiten</button>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* ══════ VERSIONSVERLAUF ═══════════════════════════════════════ */}
          <CollapsibleSection title="Versionsverlauf" subtitle="Alle bisherigen Versionen">
            {versions.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Versionen.</p> : (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="pb-2 font-medium">Version</th><th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Datum</th><th className="pb-2 font-medium">Beschreibung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map(v => (
                      <tr key={v.id} className="border-b border-gray-50">
                        <td className="py-2 font-medium">
                          {v.snapshot ? (
                            <a href={`/plan/version?token=${token}&v=${v.version_number}`} target="_blank" rel="noopener noreferrer"
                              className="text-brand-600 hover:text-brand-700 hover:underline">
                              v{v.version_number}
                            </a>
                          ) : (
                            <span className="text-gray-900">v{v.version_number}</span>
                          )}
                        </td>
                        <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${v.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          {v.status === 'draft' ? 'Draft' : 'Eingecheckt'}</span></td>
                        <td className="py-2 text-gray-600 text-xs">{new Date(v.checked_in_at ?? v.created_at).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="py-2 text-gray-600 text-xs">{v.change_description ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </>
  )
}

// ─── Team Edit Mode ─────────────────────────────────────────────────────────

type TeamEditModeProps = {
  teamData: TeamData; roles: EmployeeRole[]; capabilities: BizDevOpsCapability[]; saving: boolean
  onSave: (teamId: string, name: string, desc: string | null) => void
  onDeleteTeam: (id: string, name: string) => void
  onAddMember: (m: Pick<TeamMember, 'role_id' | 'type' | 'category' | 'fte' | 'headcount'>) => void
  onDeleteMember: (id: string) => void; onAllocChange: (capId: string, val: number) => void; onClose: () => void
}

function TeamEditMode({ teamData, roles, capabilities, saving, onSave, onDeleteTeam, onAddMember, onDeleteMember, onAllocChange, onClose }: TeamEditModeProps) {
  const { team, members, allocations } = teamData
  const [editName, setEditName] = useState(team.name)
  const [editDesc, setEditDesc] = useState(team.description ?? '')
  const totalAlloc = Object.values(allocations).reduce((s, v) => s + v, 0)
  const allocOk = totalAlloc === 100 || totalAlloc === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold text-gray-900">Team bearbeiten</h4>
        <button type="button" onClick={() => onDeleteTeam(team.id, team.name)} className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg">Team löschen</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div><label htmlFor={`tn-${team.id}`} className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input id={`tn-${team.id}`} value={editName} onChange={e => setEditName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" /></div>
        <div><label htmlFor={`td-${team.id}`} className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung</label>
          <input id={`td-${team.id}`} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" /></div>
      </div>
      <h5 className="text-xs font-semibold text-gray-600 mb-2">Mitarbeitende</h5>
      <TeamMemberTable members={members} roles={roles} onAdd={onAddMember} onDelete={onDeleteMember} />
      {capabilities.length > 0 && <div className="mt-6"><CapabilitySliders capabilities={capabilities} allocations={allocations} onChange={onAllocChange} /></div>}
      <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
        <button type="button" onClick={() => onSave(team.id, editName.trim() || team.name, editDesc.trim() || null)} disabled={saving || !allocOk}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">{saving ? 'Speichern…' : 'Speichern'}</button>
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
      </div>
    </div>
  )
}

// ─── AI Use Case shared status maps ─────────────────────────────────────────

const USE_CASE_STATUS_LABEL: Record<ARTUseCaseStatus, string> = {
  planned: 'Geplant',
  not_planned: 'Nicht geplant',
  not_needed: 'Nicht benötigt',
}

const USE_CASE_STATUS_BADGE: Record<ARTUseCaseStatus, string> = {
  planned: 'bg-blue-50 text-blue-700',
  not_planned: 'bg-gray-100 text-gray-500',
  not_needed: 'bg-amber-50 text-amber-700',
}

// ─── AI Use Case View ───────────────────────────────────────────────────────

type UseCaseViewProps = {
  useCase: AIUseCase
  teams: Team[]
  statusRows: ARTUseCase[]
  capabilities: BizDevOpsCapability[]
  capLinks: AIUseCaseCapability[]
  existingDates: ARTUseCaseDateRow[]
  editable: boolean
  onEdit: () => void
}

function UseCaseView({ useCase, teams, statusRows, capabilities, capLinks, existingDates, editable, onEdit }: UseCaseViewProps) {
  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? '–'
  const getCapName = (id: string) => capabilities.find(c => c.id === id)?.name ?? '–'
  const getCapColor = (id: string) => capabilities.find(c => c.id === id)?.color ?? '#6366f1'

  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-semibold text-gray-900">{useCase.title}</h4>
            {useCase.link && (
              <a href={useCase.link} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700">
                Weiterführende Informationen ↗
              </a>
            )}
          </div>
          {useCase.description && <p className="text-xs text-gray-500 mt-0.5">{useCase.description}</p>}
          {capLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {capLinks.map(link => (
                <span key={link.capability_id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getCapColor(link.capability_id) }} />
                  {getCapName(link.capability_id)}
                  {link.efficiency_potential != null && <span className="ml-0.5 text-gray-400">{link.efficiency_potential}%</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        {editable && (
          <button type="button" onClick={onEdit}
            className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print shrink-0 ml-3">
            Bearbeiten</button>
        )}
      </div>

      <div className="space-y-3">
        {statusRows.filter(r => r.status !== 'not_needed').map(r => {
          const teamDates = existingDates.filter(d => d.team_id === r.team_id)
          return (
            <div key={r.team_id}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-800">{getTeamName(r.team_id)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${USE_CASE_STATUS_BADGE[r.status]}`}>
                  {USE_CASE_STATUS_LABEL[r.status]}
                </span>
              </div>
              {r.status === 'planned' && capLinks.length > 0 && (
                <div className="ml-4 mt-1">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-[10px] text-gray-400 border-b border-gray-100">
                        <th className="pb-1 font-medium text-left">Capability</th>
                        <th className="pb-1 font-medium text-left">Prüfung ab</th>
                        <th className="pb-1 font-medium text-left">Einführung ab</th>
                        <th className="pb-1 font-medium text-left">Volle Nutzung ab</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capLinks.map(link => {
                        const dr = teamDates.find(d => d.capability_id === link.capability_id)
                        return (
                          <tr key={link.capability_id} className="border-b border-gray-50">
                            <td className="py-1 pr-4">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getCapColor(link.capability_id) }} />
                                {getCapName(link.capability_id)}
                              </span>
                            </td>
                            <td className="py-1 text-gray-600">{fmtDate(dr?.pilot_from ?? null)}</td>
                            <td className="py-1 text-gray-600">{fmtDate(dr?.rollout_from ?? null)}</td>
                            <td className="py-1 text-gray-600">{fmtDate(dr?.full_usage_from ?? null)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
        {statusRows.length === 0 && <p className="text-gray-400 text-xs">Keine Teams in diesem ART vorhanden.</p>}
      </div>
      {(() => {
        const notNeededTeams = statusRows.filter(r => r.status === 'not_needed')
        if (notNeededTeams.length === 0) return null
        return (
          <p className="text-xs text-gray-400 mt-3">
            Teams ohne Verwendung dieses Use Cases: {notNeededTeams.map(r => getTeamName(r.team_id)).join(', ')}
          </p>
        )
      })()}
    </>
  )
}

// ─── AI Use Case Edit Mode ──────────────────────────────────────────────────

type DateEntry = { capId: string; pilot_from: string; rollout_from: string; full_usage_from: string }
type TeamEditState = { teamId: string; status: ARTUseCaseStatus; useAllCaps: boolean; dates: DateEntry[] }

type UseCaseEditModeProps = {
  useCase: AIUseCase
  teams: Team[]
  statusRows: ARTUseCase[]
  capLinks: AIUseCaseCapability[]
  capabilities: BizDevOpsCapability[]
  existingDates: ARTUseCaseDateRow[]
  saving: boolean
  onSave: (rows: ARTUseCase[], dateRows: { teamId: string; capId: string; pilot_from: string | null; rollout_from: string | null; full_usage_from: string | null }[]) => void
  onRemove: () => void
  onClose: () => void
}

function UseCaseEditMode({ useCase, teams, statusRows, capLinks, capabilities, existingDates, saving, onSave, onRemove, onClose }: UseCaseEditModeProps) {
  const getCapName = (id: string) => capabilities.find(c => c.id === id)?.name ?? '–'
  const getCapColor = (id: string) => capabilities.find(c => c.id === id)?.color ?? '#6366f1'

  const buildInitialState = (): TeamEditState[] => {
    return statusRows.map(r => {
      const teamDates = existingDates.filter(d => d.team_id === r.team_id)
      const dates: DateEntry[] = capLinks.map(link => {
        const dr = teamDates.find(d => d.capability_id === link.capability_id)
        return { capId: link.capability_id, pilot_from: dr?.pilot_from ?? '', rollout_from: dr?.rollout_from ?? '', full_usage_from: dr?.full_usage_from ?? '' }
      })
      // Determine if all caps have the same dates (then useAllCaps = true)
      const allSame = dates.length <= 1 || dates.slice(1).every(d =>
        d.pilot_from === dates[0].pilot_from && d.rollout_from === dates[0].rollout_from && d.full_usage_from === dates[0].full_usage_from
      )
      return { teamId: r.team_id, status: r.status, useAllCaps: allSame, dates }
    })
  }

  const [teamStates, setTeamStates] = useState<TeamEditState[]>(buildInitialState)

  const updateStatus = (teamId: string, status: ARTUseCaseStatus) => {
    setTeamStates(prev => prev.map(s => s.teamId === teamId ? { ...s, status } : s))
  }

  const updateUseAllCaps = (teamId: string, val: boolean) => {
    setTeamStates(prev => prev.map(s => {
      if (s.teamId !== teamId) return s
      if (val && s.dates.length > 1) {
        const first = s.dates[0]
        return { ...s, useAllCaps: val, dates: s.dates.map(d => ({ ...d, pilot_from: first.pilot_from, rollout_from: first.rollout_from, full_usage_from: first.full_usage_from })) }
      }
      return { ...s, useAllCaps: val }
    }))
  }

  const updateDate = (teamId: string, capId: string, field: keyof Omit<DateEntry, 'capId'>, val: string) => {
    setTeamStates(prev => prev.map(s => {
      if (s.teamId !== teamId) return s
      if (s.useAllCaps) {
        // Sync all caps
        return { ...s, dates: s.dates.map(d => ({ ...d, [field]: val })) }
      }
      return { ...s, dates: s.dates.map(d => d.capId === capId ? { ...d, [field]: val } : d) }
    }))
  }

  const handleSave = () => {
    const rows: ARTUseCase[] = teamStates.map(s => ({
      id: statusRows.find(r => r.team_id === s.teamId)?.id ?? `new-${useCase.id}-${s.teamId}`,
      art_id: statusRows[0]?.art_id ?? '',
      use_case_id: useCase.id,
      team_id: s.teamId,
      status: s.status,
      created_at: '',
    }))
    const dateRows = teamStates.flatMap(s =>
      s.dates.map(d => ({
        teamId: s.teamId,
        capId: d.capId,
        pilot_from: d.pilot_from || null,
        rollout_from: d.rollout_from || null,
        full_usage_from: d.full_usage_from || null,
      }))
    )
    onSave(rows, dateRows)
  }

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? '–'

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold text-gray-900">{useCase.title}</h4>
          {useCase.description && <p className="text-xs text-gray-500 mt-0.5">{useCase.description}</p>}
        </div>
        <button type="button" onClick={onRemove}
          className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg shrink-0 ml-3">
          Use Case entfernen</button>
      </div>

      <div className="space-y-4">
        {teamStates.map(s => (
          <div key={s.teamId} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-3 mb-2">
              <label htmlFor={`uc-status-${useCase.id}-${s.teamId}`} className="text-sm font-medium text-gray-800 min-w-0">
                {getTeamName(s.teamId)}
              </label>
              <select id={`uc-status-${useCase.id}-${s.teamId}`} value={s.status}
                onChange={e => updateStatus(s.teamId, e.target.value as ARTUseCaseStatus)}
                className="px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="not_planned">Nicht geplant</option>
                <option value="planned">Geplant</option>
                <option value="not_needed">Nicht benötigt</option>
              </select>
            </div>

            {s.status === 'planned' && capLinks.length > 0 && (
              <div className="pl-2 mt-2">
                <p className="text-xs font-semibold text-gray-600 mb-2">Geplante Daten</p>
                {capLinks.length > 1 && (
                  <label className="flex items-center gap-2 mb-3 cursor-pointer">
                    <input type="checkbox" checked={s.useAllCaps}
                      onChange={e => updateUseAllCaps(s.teamId, e.target.checked)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-xs text-gray-600">Für alle Capabilities übernehmen</span>
                  </label>
                )}
                <div className="space-y-2">
                  {s.dates.map((d, idx) => {
                    const isDisabled = s.useAllCaps && idx > 0
                    return (
                      <div key={d.capId} className={`rounded p-2 ${isDisabled ? 'opacity-50' : 'bg-white border border-gray-100'}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCapColor(d.capId) }} />
                          <span className="text-xs font-medium text-gray-700">{getCapName(d.capId)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label htmlFor={`pilot-${useCase.id}-${s.teamId}-${d.capId}`} className="block text-[10px] text-gray-500 mb-0.5">Prüfung ab</label>
                            <input id={`pilot-${useCase.id}-${s.teamId}-${d.capId}`} type="date" value={d.pilot_from}
                              disabled={isDisabled}
                              onChange={e => updateDate(s.teamId, d.capId, 'pilot_from', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50" />
                          </div>
                          <div>
                            <label htmlFor={`rollout-${useCase.id}-${s.teamId}-${d.capId}`} className="block text-[10px] text-gray-500 mb-0.5">Einführung ab</label>
                            <input id={`rollout-${useCase.id}-${s.teamId}-${d.capId}`} type="date" value={d.rollout_from}
                              disabled={isDisabled}
                              onChange={e => updateDate(s.teamId, d.capId, 'rollout_from', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50" />
                          </div>
                          <div>
                            <label htmlFor={`full-${useCase.id}-${s.teamId}-${d.capId}`} className="block text-[10px] text-gray-500 mb-0.5">Volle Nutzung ab</label>
                            <input id={`full-${useCase.id}-${s.teamId}-${d.capId}`} type="date" value={d.full_usage_from}
                              disabled={isDisabled}
                              onChange={e => updateDate(s.teamId, d.capId, 'full_usage_from', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {teamStates.length === 0 && <p className="text-gray-400 text-xs">Keine Teams in diesem ART vorhanden.</p>}
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
          {saving ? 'Speichern…' : 'Speichern'}</button>
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
      </div>
    </div>
  )
}
