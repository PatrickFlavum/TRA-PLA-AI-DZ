import { useEffect, useState, useCallback, Fragment } from 'react'
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
  loadAIUseCasesForPlan, loadAllUseCaseCapabilityLinks,
  createLocalAIUseCase, updateAIUseCase, deleteAIUseCase,
  saveUseCaseCapabilities, saveUseCaseMaturityLevels,
  loadARTUseCases, addUseCaseToART, removeUseCaseFromART, upsertARTUseCaseStatus,
  loadARTUseCaseDates, upsertARTUseCaseDateRow, deleteARTUseCaseDateRows,
  loadMaturityLevels, loadAllUseCaseMaturityLinks,
  loadARTUseCaseRatings, upsertARTUseCaseRating,
  loadBusinessDivisions,
  loadQualityChecklistItems, loadARTQualityChecklistCompletions,
  setARTQualityChecklistCompletion,
  loadARTStandortbestimmung, upsertARTStandortbestimmung,
  loadStandortbestimmungDimensionen,
  loadARTTimelineEntries, createARTTimelineEntry, deleteARTTimelineEntry,
  loadTeamTypes, loadTeamTeamTypesByTeamIds, setTeamTeamTypes as saveTeamTeamTypes,
  loadAllUseCaseTeamTypeLinks,
} from '@/lib/supabase'
import type {
  ART, Organization, PlanVersion, Team, TeamMember,
  EmployeeRole, BizDevOpsCapability, GuidanceMode,
  AIUseCase, AIUseCaseStatus, AIUseCaseCapability, AIUseCaseMaturityLevel,
  MaturityLevel, ARTUseCase, ARTUseCaseStatus, ARTUseCaseDateRow,
  CyberCriticality, ARTUseCaseRating, BusinessDivision,
  QualityChecklistItem, ARTQualityChecklistCompletion,
  ARTStandortbestimmung, StandortbestimmungColor,
  StandortbestimmungDimension, ARTTimelineEntry,
  TeamType, TeamTeamType, AIUseCaseTeamType,
} from '@/types/database'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

type TeamData = { team: Team; members: TeamMember[]; allocations: Record<string, number> }

type LocalCapEntry = { capability_id: string; efficiency_potential: string }
function parseLocalCaps(entries: LocalCapEntry[]) {
  return entries.map(e => ({
    capability_id: e.capability_id,
    efficiency_potential: e.efficiency_potential.trim() ? parseInt(e.efficiency_potential, 10) : null,
  }))
}

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
          <tr className="text-left text-gray-600 border-b border-gray-200">
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
  const [artUseCaseRatings, setArtUseCaseRatings] = useState<ARTUseCaseRating[]>([])
  const [businessDivisions, setBusinessDivisions] = useState<BusinessDivision[]>([])
  const [checklistItems, setChecklistItems] = useState<QualityChecklistItem[]>([])
  const [checklistCompletions, setChecklistCompletions] = useState<ARTQualityChecklistCompletion[]>([])
  const [standortbestimmung, setStandortbestimmung] = useState<ARTStandortbestimmung[]>([])
  const [sbDimensions, setSbDimensions] = useState<StandortbestimmungDimension[]>([])
  const [editingStandortbestimmung, setEditingStandortbestimmung] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingIntro, setEditingIntro] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set())
  const toggleTeamExpand = (id: string) => setExpandedTeamIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const [expandedUseCaseIds, setExpandedUseCaseIds] = useState<Set<string>>(new Set())
  const toggleUseCaseExpand = (id: string) => setExpandedUseCaseIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
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
  const [artName, setArtName] = useState('')
  const [detailUseCaseId, setDetailUseCaseId] = useState<string | null>(null)
  const [editingPotentiale, setEditingPotentiale] = useState(false)
  const [ratingEdits, setRatingEdits] = useState<Record<string, { nutzen: number; skalierbarkeit: number; akzeptanz: number }>>({})
  const [editPlannedApproach, setEditPlannedApproach] = useState('')
  const [editingPlannedApproach, setEditingPlannedApproach] = useState(false)
  const [editingArtPotentials, setEditingArtPotentials] = useState(false)
  const [editBenefitPotential, setEditBenefitPotential] = useState('')
  const [editScalingPotential, setEditScalingPotential] = useState('')
  const [editGeneralAcceptance, setEditGeneralAcceptance] = useState('')
  const [budget2027, setBudget2027] = useState('')
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [changeDesc, setChangeDesc] = useState('')
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')

  // Local UC management
  const [showLocalUcModal, setShowLocalUcModal] = useState(false)
  const [newLocalUcTitle, setNewLocalUcTitle] = useState('')
  const [newLocalUcDesc, setNewLocalUcDesc] = useState('')
  const [newLocalUcLink, setNewLocalUcLink] = useState('')
  const [newLocalUcStatus, setNewLocalUcStatus] = useState<AIUseCaseStatus | ''>('')
  const [newLocalUcAvailFrom, setNewLocalUcAvailFrom] = useState('')
  const [newLocalUcCaps, setNewLocalUcCaps] = useState<LocalCapEntry[]>([])
  const [newLocalUcMaturity, setNewLocalUcMaturity] = useState<string[]>([])
  const [editingLocalUcId, setEditingLocalUcId] = useState<string | null>(null)
  const [editLocalUcTitle, setEditLocalUcTitle] = useState('')
  const [editLocalUcDesc, setEditLocalUcDesc] = useState('')
  const [editLocalUcLink, setEditLocalUcLink] = useState('')
  const [editLocalUcStatus, setEditLocalUcStatus] = useState<AIUseCaseStatus | ''>('')
  const [editLocalUcAvailFrom, setEditLocalUcAvailFrom] = useState('')
  const [editLocalUcCaps, setEditLocalUcCaps] = useState<LocalCapEntry[]>([])
  const [editLocalUcMaturity, setEditLocalUcMaturity] = useState<string[]>([])

  const [teamTypes, setTeamTypes] = useState<TeamType[]>([])
  const [teamTeamTypes, setTeamTeamTypes] = useState<TeamTeamType[]>([])
  const [useCaseTeamTypeLinks, setUseCaseTeamTypeLinks] = useState<AIUseCaseTeamType[]>([])

  // Timeline entries
  const [timelineEntries, setTimelineEntries] = useState<ARTTimelineEntry[]>([])
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [tlTitle, setTlTitle] = useState('')
  const [tlFrom, setTlFrom] = useState('')
  const [tlUntil, setTlUntil] = useState('')

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
      setArtName(a.name)
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
      setEditPlannedApproach(a.planned_approach ?? '')
      setBudget2027(a.budget_2027 != null ? String(a.budget_2027) : '')

      const [o, v, teams, r, c, gm, uc, ucLinks, ucMatLinks, ml, auc, aucDates, ratings, divs] = await Promise.all([
        loadOrganization(a.org_id), loadPlanVersions(a.id), loadTeams(a.id),
        loadEmployeeRoles(), loadCapabilities(), loadGuidanceModes(),
        loadAIUseCasesForPlan(a.id), loadAllUseCaseCapabilityLinks(), loadAllUseCaseMaturityLinks(),
        loadMaturityLevels(), loadARTUseCases(a.id), loadARTUseCaseDates(a.id),
        loadARTUseCaseRatings(a.id), loadBusinessDivisions(),
      ])
      setOrg(o); setVersions(v); setLatestVersion(v[0] ?? null)
      setRoles(r); setCapabilities(c); setGuidanceModes(gm)
      setUseCases(uc); setUseCaseCapLinks(ucLinks)
      setUseCaseMaturityLinks(ucMatLinks); setMaturityLevels(ml)
      setArtUseCases(auc); setArtUseCaseDates(aucDates)
      setArtUseCaseRatings(ratings); setBusinessDivisions(divs)

      // Optionale Tabellen – laden fehlertolerant damit fehlende DB-Tabellen die Seite nicht blockieren
      const [qcItems, qcCompletions, sb, sbDims, tlEntries, tt, ucTtLinks] = await Promise.all([
        loadQualityChecklistItems().catch(() => []),
        loadARTQualityChecklistCompletions(a.id).catch(() => []),
        loadARTStandortbestimmung(a.id).catch(() => []),
        loadStandortbestimmungDimensionen().catch(() => []),
        loadARTTimelineEntries(a.id).catch(() => []),
        loadTeamTypes().catch(() => []),
        loadAllUseCaseTeamTypeLinks().catch(() => []),
      ])
      setChecklistItems(qcItems)
      setChecklistCompletions(qcCompletions)
      setStandortbestimmung(sb)
      setSbDimensions(sbDims)
      setTimelineEntries(tlEntries)
      setTeamTypes(tt)
      setUseCaseTeamTypeLinks(ucTtLinks)

      const teamIds = teams.map(t => t.id)
      const [allMembers, allAllocs, ttt] = await Promise.all([loadAllTeamMembers(teamIds), loadAllTeamAllocations(teamIds), loadTeamTeamTypesByTeamIds(teamIds).catch(() => [])])
      setTeamTeamTypes(ttt)
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
        name: artName || art.name,
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
    setArtName(art?.name ?? '')
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

  const handleEnterPotentialeEdit = () => {
    const init: Record<string, { nutzen: number; skalierbarkeit: number; akzeptanz: number }> = {}
    useCases.forEach(uc => {
      const r = artUseCaseRatings.find(x => x.use_case_id === uc.id)
      init[uc.id] = { nutzen: r?.nutzen ?? 1, skalierbarkeit: r?.skalierbarkeit ?? 1, akzeptanz: r?.akzeptanz ?? 1 }
    })
    setRatingEdits(init)
    setEditPlannedApproach(art?.planned_approach ?? '')
    setEditingPotentiale(true)
  }

  const handleSavePotentiale = async () => {
    if (!art) return
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(ratingEdits).map(([use_case_id, vals]) =>
          upsertARTUseCaseRating({ art_id: art.id, use_case_id, ...vals })
        )
      )
      await updateART(art.id, { planned_approach: editPlannedApproach || null })
      setArtUseCaseRatings(
        Object.entries(ratingEdits).map(([use_case_id, vals]) => ({
          id: '', art_id: art.id, use_case_id, ...vals, created_at: '',
        }))
      )
      setArt({ ...art, planned_approach: editPlannedApproach || null })
      setEditingPotentiale(false)
    } catch { setError('Fehler beim Speichern.') }
    finally { setSaving(false) }
  }

  const handleSavePlannedApproach = async () => {
    if (!art) return
    setSaving(true)
    try {
      await updateART(art.id, { planned_approach: editPlannedApproach || null })
      setArt({ ...art, planned_approach: editPlannedApproach || null })
      setEditingPlannedApproach(false)
    } catch { setError('Fehler beim Speichern.') }
    setSaving(false)
  }

  const handleSaveArtPotentials = async () => {
    if (!art) return
    setSaving(true)
    try {
      await updateART(art.id, {
        general_benefit_potential: editBenefitPotential || null,
        general_scaling_potential: editScalingPotential || null,
        general_acceptance: editGeneralAcceptance || null,
      })
      setArt({ ...art,
        general_benefit_potential: editBenefitPotential || null,
        general_scaling_potential: editScalingPotential || null,
        general_acceptance: editGeneralAcceptance || null,
      })
      setEditingArtPotentials(false)
    } catch { setError('Fehler beim Speichern.') }
    setSaving(false)
  }

  const handleCancelPotentialeEdit = () => {
    setEditingPotentiale(false)
    setEditPlannedApproach(art?.planned_approach ?? '')
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

  const handleSaveTeam = async (teamId: string, name: string, description: string | null, challenges: string | null, typeIds: string[]) => {
    setSaving(true)
    try {
      await updateTeam(teamId, { name, description, challenges })
      await saveTeamTeamTypes(teamId, typeIds)
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

  const handleCreateLocalUc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!art || !newLocalUcTitle.trim()) return
    setSaving(true)
    try {
      const uc = await createLocalAIUseCase(art.id, {
        title: newLocalUcTitle.trim(),
        description: newLocalUcDesc.trim() || null,
        link: newLocalUcLink.trim() || null,
        status: (newLocalUcStatus as AIUseCaseStatus) || null,
        available_from: newLocalUcAvailFrom || null,
      })
      await Promise.all([
        saveUseCaseCapabilities(uc.id, parseLocalCaps(newLocalUcCaps)),
        saveUseCaseMaturityLevels(uc.id, newLocalUcMaturity),
      ])
      setNewLocalUcTitle(''); setNewLocalUcDesc(''); setNewLocalUcLink('')
      setNewLocalUcStatus(''); setNewLocalUcAvailFrom(''); setNewLocalUcCaps([]); setNewLocalUcMaturity([])
      setShowLocalUcModal(false)
      await loadData()
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const startEditLocalUc = (uc: AIUseCase) => {
    setEditingLocalUcId(uc.id)
    setEditLocalUcTitle(uc.title)
    setEditLocalUcDesc(uc.description ?? '')
    setEditLocalUcLink(uc.link ?? '')
    setEditLocalUcStatus(uc.status ?? '')
    setEditLocalUcAvailFrom(uc.available_from ?? '')
    setEditLocalUcCaps(
      useCaseCapLinks
        .filter(l => l.use_case_id === uc.id)
        .map(l => ({ capability_id: l.capability_id, efficiency_potential: l.efficiency_potential != null ? String(l.efficiency_potential) : '' }))
    )
    setEditLocalUcMaturity(useCaseMaturityLinks.filter(l => l.use_case_id === uc.id).map(l => l.maturity_level_id))
  }

  const handleUpdateLocalUc = async (id: string) => {
    if (!editLocalUcTitle.trim()) return
    try {
      await updateAIUseCase(id, {
        title: editLocalUcTitle.trim(),
        description: editLocalUcDesc.trim() || null,
        link: editLocalUcLink.trim() || null,
        status: (editLocalUcStatus as AIUseCaseStatus) || null,
        available_from: editLocalUcAvailFrom || null,
      })
      await Promise.all([
        saveUseCaseCapabilities(id, parseLocalCaps(editLocalUcCaps)),
        saveUseCaseMaturityLevels(id, editLocalUcMaturity),
      ])
      setShowLocalUcModal(false)
      setEditingLocalUcId(null)
      await loadData()
    } catch { /* silent */ }
  }

  const handleDeleteLocalUc = async (uc: AIUseCase) => {
    if (!confirm(`Lokalen Use Case «${uc.title}» löschen?`)) return
    try {
      await deleteAIUseCase(uc.id)
      setUseCases(prev => prev.filter(u => u.id !== uc.id))
    } catch { /* silent */ }
  }

  const handleCreateTimelineEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!art || !tlTitle.trim() || !tlFrom || !tlUntil) return
    try {
      const entry = await createARTTimelineEntry(art.id, { title: tlTitle.trim(), date_from: tlFrom, date_until: tlUntil })
      setTimelineEntries(prev => [...prev, entry].sort((a, b) => a.date_from < b.date_from ? -1 : a.date_from > b.date_from ? 1 : a.date_until < b.date_until ? -1 : 1))
      setTlTitle(''); setTlFrom(''); setTlUntil(''); setShowTimelineModal(false)
    } catch { /* silent */ }
  }

  const handleDeleteTimelineEntry = async (id: string, title: string) => {
    if (!confirm(`Eintrag «${title}» löschen?`)) return
    try {
      await deleteARTTimelineEntry(id)
      setTimelineEntries(prev => prev.filter(e => e.id !== id))
    } catch { /* silent */ }
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
  const orgDivision = businessDivisions.find(d => d.id === org?.business_division_id)

  const totalFTEAll = artTotals.totalFTE
  const internPct = totalFTEAll > 0 ? Math.round((artTotals.internFTE / totalFTEAll) * 100) : null
  const externPct = totalFTEAll > 0 ? Math.round((artTotals.externFTE / totalFTEAll) * 100) : null
  const itPct = totalFTEAll > 0 ? Math.round((artTotals.itFTE / totalFTEAll) * 100) : null
  const businessPct = totalFTEAll > 0 ? Math.round((artTotals.businessFTE / totalFTEAll) * 100) : null

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

  if (loading) return (<><Head><title>Lädt…</title></Head><div className="min-h-screen bg-gray-150 flex items-center justify-center"><p className="text-gray-400 text-sm">Lädt…</p></div></>)
  if (!art) return (<><Head><title>Nicht gefunden</title></Head><div className="min-h-screen bg-gray-150 flex items-center justify-center"><p className="text-red-600 text-sm">{error ?? 'Nicht gefunden.'}</p></div></>)

  // ─── Page ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Head><title>{art.name} – Transformationsplan – AI@DZ</title></Head>
      <div className="min-h-screen bg-gray-150 print:bg-white">

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

        {/* Use Case Detail Modal */}
        {detailUseCaseId && (() => {
          const uc = useCases.find(u => u.id === detailUseCaseId)
          if (!uc) return null
          const caps = useCaseCapLinks.filter(l => l.use_case_id === uc.id)
          const matLinks = useCaseMaturityLinks.filter(l => l.use_case_id === uc.id)
          const UC_STATUS_BADGE_MODAL: Partial<Record<AIUseCaseStatus, string>> = {
            'In Backlog': 'bg-gray-100 text-gray-600',
            'In Lösungsexploration': 'bg-blue-50 text-blue-700',
            'In Entwicklung': 'bg-amber-50 text-amber-700',
            'Im Rollout': 'bg-purple-50 text-purple-700',
            'In Betrieb': 'bg-green-50 text-green-700',
            'Abgebrochen': 'bg-red-50 text-red-600',
          }
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4"
              onClick={e => { if (e.target === e.currentTarget) setDetailUseCaseId(null) }}>
              <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 pr-4">{uc.title}</h3>
                  <div className="flex items-center gap-3 shrink-0">
                    {uc.type === 'local' && canEdit && (
                      <button type="button"
                        onClick={() => { startEditLocalUc(uc); setDetailUseCaseId(null); setShowLocalUcModal(true) }}
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                        Bearbeiten
                      </button>
                    )}
                    <button type="button" onClick={() => setDetailUseCaseId(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                  </div>
                </div>
                {uc.description && <p className="text-sm text-gray-700 mb-4">{uc.description}</p>}
                <div className="space-y-3">
                  {(uc.status || uc.available_from) && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {uc.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${UC_STATUS_BADGE_MODAL[uc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {uc.status}
                        </span>
                      )}
                      {uc.available_from && (
                        <span className="text-xs text-gray-600">Verfügbar ab: {fmtDate(uc.available_from)}</span>
                      )}
                    </div>
                  )}
                  {uc.link && (
                    <a href={uc.link} target="_blank" rel="noopener noreferrer"
                      className="inline-block text-sm text-brand-600 hover:text-brand-700">
                      Weiterführende Informationen ↗
                    </a>
                  )}
                  {caps.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Capabilities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {caps.map(link => {
                          const cap = capabilities.find(c => c.id === link.capability_id)
                          if (!cap) return null
                          return (
                            <span key={link.capability_id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cap.color ?? '#6366f1' }} />
                              {cap.name}
                              {link.efficiency_potential != null && <span className="ml-0.5 text-gray-400">{link.efficiency_potential}%</span>}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {matLinks.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Maturitätsstufen</p>
                      <div className="flex flex-wrap gap-1.5">
                        {matLinks.map(l => {
                          const ml = maturityLevels.find(m => m.id === l.maturity_level_id)
                          if (!ml) return null
                          return (
                            <span key={l.maturity_level_id} className="inline-block px-2 py-0.5 text-xs font-bold rounded bg-brand-100 text-brand-700">
                              {ml.code} – {ml.title}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Local UC Create/Edit Modal */}
        {showLocalUcModal && art && (() => {
          const isEdit = editingLocalUcId !== null
          const STATUS_OPTIONS_LOCAL: AIUseCaseStatus[] = ['In Backlog', 'In Lösungsexploration', 'In Entwicklung', 'Im Rollout', 'In Betrieb', 'Abgebrochen']
          const title = isEdit ? editLocalUcTitle : newLocalUcTitle
          const setTitle = isEdit ? setEditLocalUcTitle : setNewLocalUcTitle
          const desc = isEdit ? editLocalUcDesc : newLocalUcDesc
          const setDesc = isEdit ? setEditLocalUcDesc : setNewLocalUcDesc
          const link = isEdit ? editLocalUcLink : newLocalUcLink
          const setLink = isEdit ? setEditLocalUcLink : setNewLocalUcLink
          const status = isEdit ? editLocalUcStatus : newLocalUcStatus
          const setStatus = isEdit ? setEditLocalUcStatus : setNewLocalUcStatus
          const availFrom = isEdit ? editLocalUcAvailFrom : newLocalUcAvailFrom
          const setAvailFrom = isEdit ? setEditLocalUcAvailFrom : setNewLocalUcAvailFrom
          const caps = isEdit ? editLocalUcCaps : newLocalUcCaps
          const setCaps = isEdit ? setEditLocalUcCaps : setNewLocalUcCaps
          const maturity = isEdit ? editLocalUcMaturity : newLocalUcMaturity
          const setMaturity = isEdit ? setEditLocalUcMaturity : setNewLocalUcMaturity

          const toggleCap = (capId: string) =>
            setCaps(prev => prev.some(e => e.capability_id === capId)
              ? prev.filter(e => e.capability_id !== capId)
              : [...prev, { capability_id: capId, efficiency_potential: '' }])
          const updateCapEff = (capId: string, val: string) =>
            setCaps(prev => prev.map(e => e.capability_id === capId ? { ...e, efficiency_potential: val } : e))
          const toggleMat = (id: string) =>
            setMaturity(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

          const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault()
            if (isEdit) {
              handleUpdateLocalUc(editingLocalUcId!)
            } else {
              handleCreateLocalUc(e)
            }
          }

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4"
              onClick={e => { if (e.target === e.currentTarget) setShowLocalUcModal(false) }}>
              <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    {isEdit ? 'Lokalen Use Case bearbeiten' : 'Lokalen Use Case erfassen'}
                  </h3>
                  <button type="button" onClick={() => setShowLocalUcModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">×</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="luc-title" className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                    <input id="luc-title" type="text" value={title} onChange={e => setTitle(e.target.value)} required
                      placeholder="z.B. Automatische Protokollierung"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label htmlFor="luc-desc" className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung</label>
                    <textarea id="luc-desc" value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label htmlFor="luc-link" className="block text-xs font-medium text-gray-600 mb-1">Link auf weiterführende Informationen</label>
                    <input id="luc-link" type="url" value={link} onChange={e => setLink(e.target.value)}
                      placeholder="https://…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="luc-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select id="luc-status" value={status} onChange={e => setStatus(e.target.value as AIUseCaseStatus | '')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="">– Kein Status –</option>
                        {STATUS_OPTIONS_LOCAL.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="luc-avail" className="block text-xs font-medium text-gray-600 mb-1">Verfügbar ab</label>
                      <input id="luc-avail" type="date" value={availFrom} onChange={e => setAvailFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-600 mb-1">BizDevOps Capabilities & Effizienzpotential</span>
                    <div className="space-y-2">
                      {capabilities.map(cap => {
                        const entry = caps.find(e => e.capability_id === cap.id)
                        return (
                          <div key={cap.id} className="flex items-center gap-2">
                            <button type="button" onClick={() => toggleCap(cap.id)}
                              className={`px-2.5 py-1 rounded-full text-xs border transition-colors whitespace-nowrap ${entry ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                              {cap.name}
                            </button>
                            {entry && (
                              <div className="flex items-center gap-1">
                                <input id={`luc-eff-${cap.id}`} type="number" min="0" max="100"
                                  value={entry.efficiency_potential}
                                  onChange={e => updateCapEff(cap.id, e.target.value)}
                                  placeholder="0–100"
                                  className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-600 mb-1">Maturitätsstufen</span>
                    <div className="flex flex-wrap gap-2">
                      {maturityLevels.map(ml => (
                        <button key={ml.id} type="button" onClick={() => toggleMat(ml.id)}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${maturity.includes(ml.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                          {ml.code} – {ml.title}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={saving}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                      {saving ? 'Speichern…' : 'Speichern'}
                    </button>
                    <button type="button" onClick={() => setShowLocalUcModal(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
                    {isEdit && (
                      <button type="button" onClick={() => handleDeleteLocalUc(useCases.find(u => u.id === editingLocalUcId)!)}
                        className="ml-auto px-4 py-2 text-sm text-red-400 hover:text-red-600">Löschen</button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )
        })()}

        {/* Timeline Entry Modal */}
        {showTimelineModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowTimelineModal(false) }}>
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Eintrag hinzufügen</h3>
                <button type="button" onClick={() => setShowTimelineModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">×</button>
              </div>
              <form onSubmit={handleCreateTimelineEntry} className="space-y-3">
                <div>
                  <label htmlFor="tl-title" className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                  <input id="tl-title" type="text" value={tlTitle} onChange={e => setTlTitle(e.target.value)} required
                    placeholder="z.B. Kickoff, Phase 1…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tl-from" className="block text-xs font-medium text-gray-600 mb-1">Von *</label>
                    <input id="tl-from" type="date" value={tlFrom} onChange={e => setTlFrom(e.target.value)} required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label htmlFor="tl-until" className="block text-xs font-medium text-gray-600 mb-1">Bis *</label>
                    <input id="tl-until" type="date" value={tlUntil} onChange={e => setTlUntil(e.target.value)} required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>
                {tlFrom && tlUntil && (
                  <p className="text-[10px] text-gray-400">
                    {tlFrom === tlUntil ? '◆ Wird als Meilenstein angezeigt' : '▬ Wird als Balken angezeigt'}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="submit"
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg">
                    Hinzufügen
                  </button>
                  <button type="button" onClick={() => setShowTimelineModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
                </div>
              </form>
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

          {/* ══════ HEADER ══════════════════════════════════════════════ */}
          <CollapsibleSection title="Der ART im Überblick" subtitle="Nützliche Zahlen, Daten und Fakten zum ART" defaultOpen={true} hidePrintTitle>

            {/* ── Zeile 1: Titelbox + ART-Leitung ── */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Titelbox */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-600 mb-1">
                  {org?.description ?? org?.name ?? ''}
                  {orgDivision && <><span className="mx-1.5 text-gray-300">•</span>{orgDivision.title}</>}
                </p>
                <h2 className="font-bold text-gray-900" style={{ fontSize: '1.625rem', lineHeight: '2rem' }}>{art.name}</h2>
                {art.mission_statement && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {editingIntro && <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Mission Statement / Beschreibung ART</h4>}
                    <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: art.mission_statement }} />
                  </div>
                )}
              </div>

              {/* ART-Leitung + Lead/Ansprechperson + Begleitungsmodus */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">ART-Leitung</p>
                {art.art_leadership
                  ? <p className="text-sm text-gray-900 whitespace-pre-wrap">{art.art_leadership}</p>
                  : <p className="text-xs text-gray-300">–</p>}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Lead / Ansprechperson für diesen Plan</p>
                  {art.responsible_person
                    ? <p className="text-sm text-gray-900">{art.responsible_person}</p>
                    : <p className="text-xs text-gray-300">–</p>}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Begleitungsmodus</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedMode ? `${selectedMode.letter} – ${selectedMode.title}` : <span className="text-gray-300 font-normal">–</span>}</p>
                  {art.guidance_mode_reason && <p className="text-xs text-gray-500 mt-1">{art.guidance_mode_reason}</p>}
                </div>
              </div>
            </div>

            {/* ── Zeile 2: Kombinierte KPI-Box ── */}
            <div className="bg-white rounded-xl border border-gray-200 mb-4 flex items-stretch divide-x divide-gray-100">
              {/* Links: AI-Maturität */}
              <div className="flex flex-col items-center px-8 pt-5 pb-5 shrink-0 min-w-[10rem]">
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-3 text-center">Aktuelle AI-Maturität</p>
                {selectedMaturityLevel ? (
                  <>
                    <p className="text-5xl font-bold text-gray-900 leading-none">{selectedMaturityLevel.code}</p>
                    <p className="text-xs text-gray-600 mt-2 text-center leading-snug">{selectedMaturityLevel.title}</p>
                  </>
                ) : <p className="text-5xl font-bold text-gray-200 leading-none">–</p>}
              </div>

              {/* Mitte: Teams + Head Count */}
              <div className="flex items-stretch justify-center divide-x divide-gray-100 shrink-0">
                <div className="flex flex-col items-center px-10 pt-5 pb-5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-3">Teams</p>
                  <p className="text-5xl font-bold text-gray-900 leading-none">{teamsData.length}</p>
                </div>
                <div className="flex flex-col items-center px-10 pt-5 pb-5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-3">Head Count</p>
                  <p className="text-5xl font-bold text-gray-900 leading-none">{artTotals.totalHC}</p>
                </div>
              </div>

              {/* Rechts: 100%-Balken */}
              <div className="flex-1 flex flex-col justify-start gap-5 px-8 pt-5 pb-5">
                <div>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="uppercase tracking-wide text-gray-600">Internalisierungsrate</span>
                    {internPct !== null && <span className="text-gray-600">{internPct}% intern · {externPct}% extern</span>}
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex bg-gray-300">
                    {internPct !== null ? (
                      <div className="bg-gray-900 h-full" style={{ width: `${internPct}%` }} />
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="uppercase tracking-wide text-gray-600">Verteilung intern</span>
                    {itPct !== null && <span className="text-gray-600">{itPct}% IT · {businessPct}% Business</span>}
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex bg-gray-300">
                    {itPct !== null ? (
                      <div className="bg-gray-900 h-full" style={{ width: `${itPct}%` }} />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Business Context & Risiken ── */}
            {editingIntro ? (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Name des ART</h4>
                  <input type="text" value={artName} onChange={e => setArtName(e.target.value)}
                    placeholder="ART-Name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Mission Statement / Beschreibung ART</h4>
                  <RichTextEditor value={missionStatement} onChange={setMissionStatement} placeholder="Mission Statement / Beschreibung des ART…" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">ART-Leitung</h4>
                    <p className="text-[10px] text-gray-400 mb-2">Vorname Name, Rolle</p>
                    <textarea value={artLeadership} onChange={e => setArtLeadership(e.target.value)} rows={3}
                      placeholder="z.B. Max Muster, Chief Product Officer"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Lead / Ansprechperson für Plan</h4>
                      <p className="text-[10px] text-gray-400 mb-2">Üblicherweise RTE des ART oder STE der AO</p>
                      <input type="text" value={responsiblePerson} onChange={e => setResponsiblePerson(e.target.value)}
                        placeholder="z.B. Anna Muster"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <div className="pt-3 border-t border-gray-100">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Begleitungsmodus</h4>
                      <select aria-label="Begleitungsmodus" value={guidanceModeId ?? ''} onChange={e => setGuidanceModeId(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
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
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Business Context & Roadmap</h4>
                    <p className="text-[10px] text-gray-400 mb-2">Was kommt in den nächsten 1–5 Jahren auf diesen ART zu?</p>
                    <RichTextEditor value={businessContext} onChange={setBusinessContext} placeholder="Business Context…" />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Risiken & Störfaktoren</h4>
                    <p className="text-[10px] text-gray-400 mb-2">Was könnte die geplante Transformation gefährden?</p>
                    <RichTextEditor value={risks} onChange={setRisks} placeholder="Risiken…" />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Cyber-Kritikalität</h4>
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
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Aktuelle AI-Maturität</h4>
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
                <div className="space-y-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Business Context & Roadmap</h4>
                    {art.business_context
                      ? <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: art.business_context }} />
                      : <p className="text-xs text-gray-400 italic">Noch nicht beschrieben.</p>}
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Risiken & Störfaktoren</h4>
                    {art.risks
                      ? <div className="rich-text-content text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: art.risks }} />
                      : <p className="text-xs text-gray-400 italic">Noch nicht beschrieben.</p>}
                  </div>
                </div>
                {(art.cyber_criticality || art.cyber_criticality_reason) && (
                  <div className="mt-3 bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Cyber-Kritikalität</h4>
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

          </CollapsibleSection>

          {/* ══════ STANDORTBESTIMMUNG ════════════════════════════════════ */}
          <CollapsibleSection title="Standortbestimmung Transformation" subtitle="Aktueller Zustand der 10 Faktoren für eine erfolgreiche Transformation">
            {(() => {
              const sbMap = new Map(standortbestimmung.map(s => [s.dimension_key, s]))
              const isEditing = editingStandortbestimmung
              const COLOR_LABEL: Record<StandortbestimmungColor, string> = {
                gruen: 'Bereit / Auf Kurs',
                gelb:  'Zusätzliche Massnahmen notwendig',
                rot:   'Show-Stopper / schwerwiegende Hindernisse',
              }
              const COLOR_BG: Record<StandortbestimmungColor, string> = {
                gruen: 'bg-green-500', gelb: 'bg-yellow-400', rot: 'bg-red-500',
              }
              const COLOR_RING: Record<StandortbestimmungColor, string> = {
                gruen: 'ring-green-500', gelb: 'ring-yellow-400', rot: 'ring-red-500',
              }
              const handleColor = async (dimKey: string, color: StandortbestimmungColor | null) => {
                if (!art) return
                const current = sbMap.get(dimKey)
                const newColor = current?.color === color ? null : color
                setStandortbestimmung(prev => {
                  const existing = prev.find(s => s.dimension_key === dimKey)
                  if (existing) return prev.map(s => s.dimension_key === dimKey ? { ...s, color: newColor } : s)
                  return [...prev, { id: '', art_id: art.id, dimension_key: dimKey, color: newColor, reason: null, created_at: '' }]
                })
                try { await upsertARTStandortbestimmung({ art_id: art.id, dimension_key: dimKey, color: newColor, reason: current?.reason ?? null }) }
                catch { loadData() }
              }
              const handleReason = async (dimKey: string, reason: string) => {
                if (!art) return
                const current = sbMap.get(dimKey)
                setStandortbestimmung(prev => {
                  const existing = prev.find(s => s.dimension_key === dimKey)
                  if (existing) return prev.map(s => s.dimension_key === dimKey ? { ...s, reason } : s)
                  return [...prev, { id: '', art_id: art.id, dimension_key: dimKey, color: null, reason, created_at: '' }]
                })
                try { await upsertARTStandortbestimmung({ art_id: art.id, dimension_key: dimKey, color: current?.color ?? null, reason: reason || null }) }
                catch { loadData() }
              }
              return (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Kopfzeile mit Legende / Bearbeiten-Button */}
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-6">
                    {(['gruen', 'gelb', 'rot'] as StandortbestimmungColor[]).map(c => (
                      <span key={c} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className={`w-3 h-3 rounded-full ${COLOR_BG[c]}`} />
                        {COLOR_LABEL[c]}
                      </span>
                    ))}
                    {isEditing && (
                      <span className="text-xs text-gray-400">Nochmals klicken hebt die Auswahl auf</span>
                    )}
                    {editable && (
                      <div className="ml-auto no-print">
                        {isEditing ? (
                          <button type="button" onClick={() => setEditingStandortbestimmung(false)}
                            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg">
                            Fertig
                          </button>
                        ) : (
                          <button type="button" onClick={() => setEditingStandortbestimmung(true)}
                            className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg">
                            Bearbeiten
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-600 border-b border-gray-100">
                        <th className="px-5 py-2 font-medium w-1/2">Dimension</th>
                        <th className="px-4 py-2 font-medium w-1/2">Begründung</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sbDimensions.length === 0 ? (
                        <tr><td colSpan={2} className="px-5 py-6 text-sm text-gray-400 italic text-center">
                          Keine Dimensionen erfasst. Im Admin-Bereich unter «Standortbestimmung» können diese angelegt werden.
                        </td></tr>
                      ) : sbDimensions.map(dim => {
                        const entry = sbMap.get(dim.id)
                        const color = entry?.color ?? null
                        return (
                          <tr key={dim.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 align-top w-1/2">
                              <div className="flex items-start gap-3">
                                {isEditing ? (
                                  <div className="flex flex-col gap-1.5 pt-0.5 shrink-0">
                                    {(['gruen', 'gelb', 'rot'] as StandortbestimmungColor[]).map(c => (
                                      <button
                                        key={c}
                                        type="button"
                                        title={COLOR_LABEL[c]}
                                        onClick={() => handleColor(dim.id, c)}
                                        className={`w-5 h-5 rounded-full transition-all ${COLOR_BG[c]} ${
                                          color === c
                                            ? `ring-2 ring-offset-1 ${COLOR_RING[c]} scale-110`
                                            : 'opacity-25 hover:opacity-60'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="pt-1 shrink-0">
                                    {color ? (
                                      <span className={`block w-4 h-4 rounded-full ${COLOR_BG[color]}`} title={COLOR_LABEL[color]} />
                                    ) : (
                                      <span className="block w-4 h-4 rounded-full bg-gray-200" title="Keine Bewertung" />
                                    )}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900">{dim.title}</p>
                                  {isEditing && dim.leitfragen && (
                                    <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap leading-relaxed">{dim.leitfragen}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              {isEditing ? (
                                <textarea
                                  value={entry?.reason ?? ''}
                                  onChange={e => handleReason(dim.id, e.target.value)}
                                  onBlur={e => handleReason(dim.id, e.target.value)}
                                  rows={4}
                                  placeholder="Begründung…"
                                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                                />
                              ) : (
                                <p className="text-sm text-gray-600 leading-relaxed">
                                  {entry?.reason || <span className="text-gray-300 italic">–</span>}
                                </p>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </CollapsibleSection>

          {/* ══════ AKTUELLE TEAM-STRUKTUREN ══════════════════════════════ */}
          <CollapsibleSection title="Diagnose Teil 1 – Teamsicht" subtitle="Teams, Rollen und Kapazitätsverteilung">
            <div className="space-y-4">
              {teamsData.map(td => {
                const isEditingThis = editingTeamId === td.team.id
                const teamSummary = buildSummary(td.members, roles)
                const teamTotals = sumTotals(teamSummary)
                const hasAnyAllocation = Object.values(td.allocations).some(v => v > 0)
                const allocSlices = capabilities
                  .map(cap => ({ label: cap.name, value: td.allocations[cap.id] ?? 0, color: cap.color ?? '#6366f1' }))

                const isExpanded = expandedTeamIds.has(td.team.id)
                return (
                  <div key={td.team.id} className="bg-white rounded-xl border border-gray-200 p-5 print-no-break">
                    {isEditingThis ? (
                      <TeamEditMode teamData={td} roles={roles} capabilities={capabilities} saving={saving}
                        teamTypes={teamTypes} initTypeIds={teamTeamTypes.filter(x => x.team_id === td.team.id).map(x => x.team_type_id)}
                        onSave={handleSaveTeam} onDeleteTeam={handleDeleteTeam}
                        onAddMember={(m) => handleAddMember(td.team.id, m)} onDeleteMember={handleDeleteMember}
                        onAllocChange={(capId, val) => handleAllocChange(td.team.id, capId, val)} onClose={() => setEditingTeamId(null)} />
                    ) : (
                      <>
                        <div className="flex items-start justify-between cursor-pointer" onClick={() => toggleTeamExpand(td.team.id)}>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-base font-semibold text-gray-900">{td.team.name}</h4>
                              {teamTeamTypes.filter(ttt => ttt.team_id === td.team.id).map(ttt => {
                                const typ = teamTypes.find(x => x.id === ttt.team_type_id)
                                if (!typ) return null
                                return (
                                  <span key={ttt.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                                    style={{ backgroundColor: typ.color ?? '#6366f1' }}>
                                    {typ.name}
                                  </span>
                                )
                              })}
                            </div>
                            {td.team.description && <p className="text-xs text-gray-600 mt-0.5">{td.team.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {editable && (
                              <button type="button" onClick={e => { e.stopPropagation(); toggleTeamExpand(td.team.id); setEditingTeamId(td.team.id) }}
                                className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print">Bearbeiten</button>
                            )}
                            <span className={`text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </span>
                          </div>
                        </div>
                        {isExpanded && <>
                        <h5 className="text-sm font-semibold text-gray-700 mt-6 mb-2">Team-Zusammenstellung</h5>
                        <SummaryTable rows={teamSummary} totals={teamTotals} />
                        {hasAnyAllocation && (
                          <div className="mt-6"><h5 className="text-sm font-semibold text-gray-700 mb-2">Kapazitätsverteilung auf Capabilities</h5><StackedBar slices={allocSlices} /></div>
                        )}
                        {td.team.challenges && (
                          <div className="mt-6">
                            <h5 className="text-sm font-semibold text-gray-700 mb-1">Aktuelle Herausforderungen/Chancen im Workflow dieses Teams</h5>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{td.team.challenges}</p>
                          </div>
                        )}
                        {/* Geplante AI Use Cases – ausgeblendet, ggf. später wieder aktivieren
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
                            <div className="mt-6">
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
                        */}
                        </>}
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
                  className="w-full py-3 border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600 rounded-xl transition-colors no-print">
                  + Neues Team hinzufügen</button>
              ))}
            </div>
          </CollapsibleSection>


          {/* ══════ USE CASE POTENTIALE ═══════════════════════════════════ */}
          <CollapsibleSection title="Diagnose Teil 2 – Potenziale" subtitle="Use Case Bewertungen und Potenzialbeschreibungen">
            {(() => {
              type UcRankRow = {
                uc: AIUseCase
                anzahlTeams: number; anzahlHC: number
                nutzen: number; skalierbarkeit: number; akzeptanz: number; prioScore: number
                hasRating: boolean
              }
              const rows: UcRankRow[] = useCases.map(uc => {
                const notNeededTeamIds = artUseCases.filter(u => u.use_case_id === uc.id && u.status === 'not_needed').map(u => u.team_id)
                const ucCapIds = useCaseCapLinks.filter(l => l.use_case_id === uc.id).map(l => l.capability_id)
                const eligibleTeams = teamsData.filter(td => {
                  if (notNeededTeamIds.includes(td.team.id)) return false
                  if (ucCapIds.length === 0) return true
                  return ucCapIds.some(capId => (td.allocations[capId] ?? 0) > 0)
                })
                const anzahlHC = eligibleTeams.reduce((s, td) => s + td.members.reduce((ms, m) => ms + m.headcount, 0), 0)
                const rating = artUseCaseRatings.find(r => r.use_case_id === uc.id)
                const nutzen = rating?.nutzen ?? 1
                const skalierbarkeit = rating?.skalierbarkeit ?? 1
                const akzeptanz = rating?.akzeptanz ?? 1
                return {
                  uc, anzahlTeams: eligibleTeams.length, anzahlHC,
                  nutzen, skalierbarkeit, akzeptanz, prioScore: nutzen * skalierbarkeit * akzeptanz,
                  hasRating: !!rating,
                }
              })

              const viewSorted = [...rows].sort((a, b) => b.prioScore !== a.prioScore ? b.prioScore - a.prioScore : a.uc.title.localeCompare(b.uc.title, 'de'))

              if (viewSorted.length === 0) return (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-gray-400 text-sm">Noch keine AI Use Cases im System vorhanden.</p>
                </div>
              )

              const UC_STATUS_SHORT: Partial<Record<AIUseCaseStatus, string>> = {
                'In Lösungsexploration': 'Lösungsexpl.',
                'In Entwicklung': 'In Entwicklg.',
              }

              const displayRows = viewSorted

              return (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-1 no-print">
                    <h5 className="text-sm font-semibold text-gray-700">Bewertung Use Cases</h5>
                    {editable && !editingPotentiale && (
                      <button type="button" onClick={handleEnterPotentialeEdit}
                        className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg">
                        Bearbeiten
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mb-3">Prio = Nutzen × Skalierbarkeit × Akzeptanz (je 1–5)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] text-gray-400 border-b border-gray-200">
                          <th className="pb-2 font-medium text-center bg-brand-50 text-brand-700 rounded-t px-2 pr-3">Prio</th>
                          <th className="pb-2 font-medium pr-3">Use Case</th>
                          <th className="pb-2 font-medium pr-3">Status</th>
                          <th className="pb-2 font-medium pr-3">Verfügbar ab</th>
                          <th className="pb-2 font-medium text-center pr-2">Max. betroffene Teams</th>
                          <th className="pb-2 font-medium text-center pr-2">Max. betroffene MA</th>
                          <th className="pb-2 font-medium text-center pr-1 bg-sky-50 text-sky-600 rounded-tl">Bewertung Nutzen</th>
                          <th className="pb-2 font-medium text-center pr-1 bg-sky-50 text-sky-600">Bewertung Skalierb.</th>
                          <th className="pb-2 font-medium text-center pr-2 bg-sky-50 text-sky-600">Bewertung Akzept.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.map((row, i) => {
                          if (editingPotentiale) {
                            const e = ratingEdits[row.uc.id] ?? { nutzen: row.nutzen, skalierbarkeit: row.skalierbarkeit, akzeptanz: row.akzeptanz }
                            const liveScore = e.nutzen * e.skalierbarkeit * e.akzeptanz
                            const setField = (field: 'nutzen' | 'skalierbarkeit' | 'akzeptanz', val: number) =>
                              setRatingEdits(prev => ({ ...prev, [row.uc.id]: { ...(prev[row.uc.id] ?? e), [field]: val } }))
                            return (
                              <tr key={row.uc.id} className="border-b border-gray-50">
                                <td className="py-1.5 text-center tabular-nums font-semibold px-3 bg-brand-50 text-brand-700">{liveScore}</td>
                                <td className="py-1.5 pr-3">
                                  <span className="font-medium text-gray-800">{row.uc.title}</span>
                                  {row.uc.type === 'local' && (
                                    <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full font-medium">lokal</span>
                                  )}
                                </td>
                                <td className="py-1.5 pr-3">
                                  {row.uc.status
                                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">{UC_STATUS_SHORT[row.uc.status] ?? row.uc.status}</span>
                                    : <span className="text-gray-400">–</span>}
                                </td>
                                <td className="py-1.5 pr-3 tabular-nums text-gray-600">{row.uc.available_from ? fmtDate(row.uc.available_from) : '–'}</td>
                                <td className="py-1.5 pr-2 text-center tabular-nums text-gray-800">{row.anzahlTeams}</td>
                                <td className="py-1.5 pr-2 text-center tabular-nums text-gray-600">{row.anzahlHC > 0 ? row.anzahlHC : '–'}</td>
                                <td className="py-1 pr-1 bg-sky-50">
                                  <select aria-label="Nutzen" value={e.nutzen} onChange={ev => setField('nutzen', Number(ev.target.value))}
                                    className="w-14 px-1 py-0.5 border border-sky-200 rounded text-xs bg-white text-center focus:outline-none focus:ring-1 focus:ring-sky-400">
                                    {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </td>
                                <td className="py-1 pr-1 bg-sky-50">
                                  <select aria-label="Skalierbarkeit" value={e.skalierbarkeit} onChange={ev => setField('skalierbarkeit', Number(ev.target.value))}
                                    className="w-14 px-1 py-0.5 border border-sky-200 rounded text-xs bg-white text-center focus:outline-none focus:ring-1 focus:ring-sky-400">
                                    {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </td>
                                <td className="py-1 pr-2 bg-sky-50">
                                  <select aria-label="Akzeptanz" value={e.akzeptanz} onChange={ev => setField('akzeptanz', Number(ev.target.value))}
                                    className="w-14 px-1 py-0.5 border border-sky-200 rounded text-xs bg-white text-center focus:outline-none focus:ring-1 focus:ring-sky-400">
                                    {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <tr key={row.uc.id} className="border-b border-gray-50">
                              <td className={`py-2 text-center tabular-nums font-semibold px-3 pr-3 ${row.hasRating ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-300'}`}>{row.prioScore}</td>
                              <td className="py-2 pr-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button type="button" onClick={() => setDetailUseCaseId(row.uc.id)}
                                    className="font-medium text-brand-600 hover:text-brand-700 hover:underline text-left">
                                    {row.uc.title}
                                  </button>
                                  {row.uc.type === 'local' && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full font-medium whitespace-nowrap">lokal</span>
                                  )}
                                  {useCaseTeamTypeLinks.filter(l => l.use_case_id === row.uc.id).map(l => {
                                    const tt = teamTypes.find(t => t.id === l.team_type_id)
                                    if (!tt) return null
                                    return (
                                      <span key={l.team_type_id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-white whitespace-nowrap"
                                        style={{ backgroundColor: tt.color ?? '#6366f1' }}>
                                        {tt.name}
                                      </span>
                                    )
                                  })}
                                </div>
                              </td>
                              <td className="py-2 pr-3">
                                {row.uc.status
                                  ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">{UC_STATUS_SHORT[row.uc.status] ?? row.uc.status}</span>
                                  : <span className="text-gray-400">–</span>}
                              </td>
                              <td className="py-2 pr-3 tabular-nums text-gray-600">{row.uc.available_from ? fmtDate(row.uc.available_from) : '–'}</td>
                              <td className="py-2 pr-2 text-center tabular-nums text-gray-800">{row.anzahlTeams}</td>
                              <td className="py-2 pr-2 text-center tabular-nums text-gray-600">{row.anzahlHC > 0 ? row.anzahlHC : '–'}</td>
                              <td className={`py-2 pr-1 text-center tabular-nums font-medium bg-sky-50 ${row.hasRating ? 'text-sky-700' : 'text-gray-300'}`}>{row.nutzen}</td>
                              <td className={`py-2 pr-1 text-center tabular-nums font-medium bg-sky-50 ${row.hasRating ? 'text-sky-700' : 'text-gray-300'}`}>{row.skalierbarkeit}</td>
                              <td className={`py-2 pr-2 text-center tabular-nums font-medium bg-sky-50 ${row.hasRating ? 'text-sky-700' : 'text-gray-300'}`}>{row.akzeptanz}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {editable && !editingPotentiale && (
                    <div className="mt-3 no-print">
                      <button type="button"
                        onClick={() => { setEditingLocalUcId(null); setNewLocalUcTitle(''); setNewLocalUcDesc(''); setNewLocalUcLink(''); setNewLocalUcStatus(''); setNewLocalUcAvailFrom(''); setNewLocalUcCaps([]); setNewLocalUcMaturity([]); setShowLocalUcModal(true) }}
                        className="px-3 py-1.5 border border-dashed border-gray-300 text-xs text-brand-600 hover:border-brand-400 hover:bg-brand-50 font-medium rounded-lg">
                        + Lokaler Use Case erfassen
                      </button>
                    </div>
                  )}

                  {editingPotentiale && (
                    <div className="flex gap-2 mt-4 no-print">
                      <button type="button" onClick={handleSavePotentiale} disabled={saving}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                        {saving ? 'Speichern…' : 'Speichern'}
                      </button>
                      <button type="button" onClick={handleCancelPotentialeEdit}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ── Generelle Potenzialfelder ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4 no-print">
                <h5 className="text-sm font-semibold text-gray-700">Generelle Einschätzungen</h5>
                {editable && !editingArtPotentials && (
                  <button type="button"
                    onClick={() => {
                      setEditBenefitPotential(art?.general_benefit_potential ?? '')
                      setEditScalingPotential(art?.general_scaling_potential ?? '')
                      setEditGeneralAcceptance(art?.general_acceptance ?? '')
                      setEditingArtPotentials(true)
                    }}
                    className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print">
                    Bearbeiten
                  </button>
                )}
              </div>
              <div className="space-y-5">
                {([
                  { label: 'Generelles Nutzenpotenzial', hint: 'Wie wird gesamtheitlich der pot. Nutzen von AI in diesem ART bewertet?', val: editingArtPotentials ? editBenefitPotential : art?.general_benefit_potential, set: setEditBenefitPotential },
                  { label: 'Generelles Skalierungspotenzial', hint: 'Wie wird gesamtheitlich der pot. Skalierung – also Wiederverwendung von AI Use Cases – in diesem ART bewertet?', val: editingArtPotentials ? editScalingPotential : art?.general_scaling_potential, set: setEditScalingPotential },
                  { label: 'Generelle Akzeptanz', hint: 'Wie wird generelle Akzeptanz von AI im ART bewertet?', val: editingArtPotentials ? editGeneralAcceptance : art?.general_acceptance, set: setEditGeneralAcceptance },
                ] as { label: string; hint: string; val: string | null | undefined; set: (v: string) => void }[]).map(field => (
                  <div key={field.label}>
                    <p className="text-xs font-semibold text-gray-700 mb-1">{field.label}</p>
                    {editingArtPotentials ? (
                      <>
                        <p className="text-[10px] text-gray-400 mb-1">{field.hint}</p>
                        <textarea value={field.val ?? ''} onChange={e => field.set(e.target.value)} rows={3}
                          placeholder={`${field.label}…`}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      </>
                    ) : field.val ? (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{field.val}</p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Noch nicht beschrieben.</p>
                    )}
                  </div>
                ))}
              </div>
              {editingArtPotentials && (
                <div className="flex gap-2 mt-4 no-print">
                  <button type="button" onClick={handleSaveArtPotentials} disabled={saving}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                    {saving ? 'Speichern…' : 'Speichern'}
                  </button>
                  <button type="button" onClick={() => setEditingArtPotentials(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* ══════ USE CASE PLANUNG ══════════════════════════════════════ */}
          <CollapsibleSection title="Planung Teil 1 – Use Case Erprobung & Nutzung" subtitle="Geplante Verwendungen von AI Use Cases pro Team">
            <div className="space-y-4">
              {(() => {
                const sortedUsedUcIds = [...usedUseCaseIds].sort((a, b) => {
                  const ra = artUseCaseRatings.find(r => r.use_case_id === a)
                  const rb = artUseCaseRatings.find(r => r.use_case_id === b)
                  const sa = (ra?.nutzen ?? 1) * (ra?.skalierbarkeit ?? 1) * (ra?.akzeptanz ?? 1)
                  const sb = (rb?.nutzen ?? 1) * (rb?.skalierbarkeit ?? 1) * (rb?.akzeptanz ?? 1)
                  if (sb !== sa) return sb - sa
                  const ta = useCases.find(u => u.id === a)?.title ?? ''
                  const tb = useCases.find(u => u.id === b)?.title ?? ''
                  return ta.localeCompare(tb, 'de')
                })
                return sortedUsedUcIds.map(ucId => {
                  const uc = useCases.find(u => u.id === ucId)
                  if (!uc) return null
                  const capLinks = useCaseCapLinks.filter(l => l.use_case_id === ucId)
                  const statusRows: ARTUseCase[] = teamsData.map(td => {
                    const existing = artUseCases.find(u => u.use_case_id === ucId && u.team_id === td.team.id)
                    return existing ?? { id: `new-${ucId}-${td.team.id}`, art_id: art.id, use_case_id: ucId, team_id: td.team.id, status: 'not_planned', created_at: '' }
                  })
                  const isEditingThis = editingUseCaseId === ucId
                  const isExpanded = expandedUseCaseIds.has(ucId)
                  const getTeamName = (id: string) => teamsData.find(td => td.team.id === id)?.team.name ?? '–'
                  const getCapName = (id: string) => capabilities.find(c => c.id === id)?.name ?? '–'
                  const getCapColor = (id: string) => capabilities.find(c => c.id === id)?.color ?? '#6366f1'
                  const existingDates = artUseCaseDates.filter(d => d.use_case_id === ucId)

                  return (
                    <div key={ucId} className="bg-white rounded-xl border border-gray-200 p-5 print-no-break">
                      <div
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => !isEditingThis && toggleUseCaseExpand(ucId)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-semibold text-gray-900">Use Case {uc.title}</h4>
                            {useCaseTeamTypeLinks.filter(l => l.use_case_id === ucId).map(l => {
                              const tt = teamTypes.find(t => t.id === l.team_type_id)
                              if (!tt) return null
                              return (
                                <span key={l.team_type_id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                                  style={{ backgroundColor: tt.color ?? '#6366f1' }}>
                                  {tt.name}
                                </span>
                              )
                            })}
                          </div>
                          {!isExpanded && !isEditingThis && uc.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{uc.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {!isEditingThis && editable && (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setExpandedUseCaseIds(prev => { const n = new Set(prev); n.add(ucId); return n }); setEditingUseCaseId(ucId) }}
                              className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print">
                              Bearbeiten
                            </button>
                          )}
                          {!isEditingThis && (
                            <span className={`text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </span>
                          )}
                        </div>
                      </div>
                      {(isExpanded || isEditingThis) && (
                        <div className="mt-4">
                          {(isExpanded && !isEditingThis && uc.description) && (
                            <p className="text-xs text-gray-500 mb-3">{uc.description}</p>
                          )}
                          <UseCasePlanTable
                            key={isEditingThis ? 'edit' : 'view'}
                            useCase={uc}
                            teams={teamsData.map(td => td.team)}
                            statusRows={statusRows}
                            capLinks={capLinks}
                            capabilities={capabilities}
                            existingDates={existingDates}
                            editable={editable}
                            isEditing={isEditingThis}
                            saving={saving}
                            onEdit={() => { setExpandedUseCaseIds(prev => { const n = new Set(prev); n.add(ucId); return n }); setEditingUseCaseId(ucId) }}
                            onSave={(rows, dateRows) => handleSaveUseCaseStatuses(ucId, rows, dateRows)}
                            onRemove={() => handleRemoveUseCase(ucId, uc.title)}
                            onClose={() => setEditingUseCaseId(null)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
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
                  className="w-full py-3 border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600 rounded-xl transition-colors no-print">
                  + AI Use Case hinzufügen</button>
              ))}
            </div>
          </CollapsibleSection>

          {/* ══════ ROADMAP ═══════════════════════════════════════════════ */}
          <CollapsibleSection title="Planung Teil 2 – Roadmap" subtitle="Zeitplan mit Meilensteinen und Übersicht über die Erprobung, Einführung und Nutzung der Use Cases">
            <div className="space-y-5">

            {/* ── Geplantes Vorgehen ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2 no-print">
                <h5 className="text-sm font-semibold text-gray-700">Geplantes Vorgehen</h5>
                {editable && !editingPlannedApproach && (
                  <button type="button"
                    onClick={() => { setEditPlannedApproach(art?.planned_approach ?? ''); setEditingPlannedApproach(true) }}
                    className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print">
                    Bearbeiten
                  </button>
                )}
              </div>
              {editingPlannedApproach ? (
                <>
                  <p className="text-[10px] text-gray-400 mb-2">Wie ist das grundlegende Vorgehen geplant – Use Case mit der höchsten Prio zuerst, oder gleich mehrere Use Cases gleichzeitig angehen? Welche werden konkret angegangen, welche (noch) nicht?</p>
                  <textarea value={editPlannedApproach} onChange={e => setEditPlannedApproach(e.target.value)} rows={5}
                    placeholder="Beschreibung des geplanten Vorgehens…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  <div className="flex gap-2 mt-3 no-print">
                    <button type="button" onClick={handleSavePlannedApproach} disabled={saving}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
                      {saving ? 'Speichern…' : 'Speichern'}
                    </button>
                    <button type="button" onClick={() => setEditingPlannedApproach(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
                  </div>
                </>
              ) : art.planned_approach ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{art.planned_approach}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">Noch nicht beschrieben.</p>
              )}
            </div>

            {(() => {
              const sqEnd = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0)

              type RmDates = { pilotFrom: Date | null; rolloutFrom: Date | null; fullUsageFrom: Date | null }
              type RmCapRow = { capId: string; capName: string } & RmDates
              type RmUcEntry = { ucId: string; rank: number; ucTitle: string; showSingle: boolean; singleDates: RmDates; capRows: RmCapRow[] }
              type RmTeamGroup = { teamId: string; teamName: string; useCases: RmUcEntry[] }

              const pd = (s: string | null) => s ? new Date(s) : null

              const sortedUcIds = useCases
                .filter(uc => artUseCases.some(u => u.use_case_id === uc.id && u.status === 'planned'))
                .map(uc => {
                  const r = artUseCaseRatings.find(x => x.use_case_id === uc.id)
                  return { uc, score: (r?.nutzen ?? 1) * (r?.skalierbarkeit ?? 1) * (r?.akzeptanz ?? 1) }
                })
                .sort((a, b) => b.score - a.score || a.uc.title.localeCompare(b.uc.title, 'de'))
                .map(x => x.uc.id)

              const teamGroups: RmTeamGroup[] = []
              teamsData.forEach(td => {
                const ucEntries: RmUcEntry[] = []
                sortedUcIds.forEach((ucId, rank) => {
                  if (!artUseCases.find(u => u.use_case_id === ucId && u.team_id === td.team.id && u.status === 'planned')) return
                  const uc = useCases.find(u => u.id === ucId)!
                  const capRows: RmCapRow[] = artUseCaseDates
                    .filter(d => d.use_case_id === ucId && d.team_id === td.team.id && (d.pilot_from || d.rollout_from || d.full_usage_from))
                    .map(d => ({
                      capId: d.capability_id,
                      capName: capabilities.find(c => c.id === d.capability_id)?.name ?? '–',
                      pilotFrom: pd(d.pilot_from), rolloutFrom: pd(d.rollout_from), fullUsageFrom: pd(d.full_usage_from),
                    }))
                  if (capRows.length === 0) return
                  const allSame = capRows.length === 1 || capRows.every(r =>
                    r.pilotFrom?.toISOString() === capRows[0].pilotFrom?.toISOString() &&
                    r.rolloutFrom?.toISOString() === capRows[0].rolloutFrom?.toISOString() &&
                    r.fullUsageFrom?.toISOString() === capRows[0].fullUsageFrom?.toISOString()
                  )
                  ucEntries.push({
                    ucId, rank: rank + 1, ucTitle: uc.title, showSingle: allSame,
                    singleDates: { pilotFrom: capRows[0].pilotFrom, rolloutFrom: capRows[0].rolloutFrom, fullUsageFrom: capRows[0].fullUsageFrom },
                    capRows: allSame ? [] : capRows,
                  })
                })
                if (ucEntries.length > 0) teamGroups.push({ teamId: td.team.id, teamName: td.team.name, useCases: ucEntries })
              })

              // Fixed range: Q1 2026 – Q4 2028
              const rangeStart = new Date(2026, 0, 1)
              const rangeEnd   = new Date(2028, 11, 31)
              const totalMs    = rangeEnd.getTime() - rangeStart.getTime()
              const toPct = (d: Date | null): number | null => {
                if (!d) return null
                return Math.max(0, Math.min(100, ((d.getTime() - rangeStart.getTime()) / totalMs) * 100))
              }

              const quarters: Array<{ label: string; pct: number; width: number }> = []
              let cur = new Date(rangeStart)
              while (cur <= rangeEnd) {
                const qEnd = sqEnd(new Date(cur))
                const pct = ((cur.getTime() - rangeStart.getTime()) / totalMs) * 100
                const endMs = Math.min(qEnd.getTime(), rangeEnd.getTime())
                quarters.push({
                  label: `Q${Math.floor(cur.getMonth() / 3) + 1} ${cur.getFullYear()}`,
                  pct, width: ((endMs - cur.getTime()) / totalMs) * 100,
                })
                cur = new Date(qEnd.getFullYear(), qEnd.getMonth() + 1, 1)
              }

              // ART maturity milestones: per planned UC → lowest maturity level → earliest rollout date
              const lMap = new Map(maturityLevels.map(l => [l.id, l]))
              const levelFirstDate = new Map<string, { code: string; title: string; date: Date }>()
              for (const ucId of sortedUcIds) {
                const ucRollDates = artUseCaseDates.filter(d => d.use_case_id === ucId && d.rollout_from)
                if (ucRollDates.length === 0) continue
                const earliest = new Date(Math.min(...ucRollDates.map(d => new Date(d.rollout_from!).getTime())))
                const levels = useCaseMaturityLinks
                  .filter(l => l.use_case_id === ucId)
                  .map(l => lMap.get(l.maturity_level_id))
                  .filter((l): l is MaturityLevel => !!l)
                  .sort((a, b) => a.code.localeCompare(b.code))
                if (levels.length === 0) continue
                const lowest = levels[0]
                const ex = levelFirstDate.get(lowest.code)
                if (!ex || earliest < ex.date) levelFirstDate.set(lowest.code, { code: lowest.code, title: lowest.title, date: earliest })
              }
              const matMilestones = [...levelFirstDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
              // Prepend the ART's current maturity level as baseline before the first use-case milestone
              const currentArtLevel = art.current_maturity_level_id ? lMap.get(art.current_maturity_level_id) : null
              if (currentArtLevel) {
                matMilestones.unshift({ code: currentArtLevel.code, title: currentArtLevel.title, date: rangeStart })
              }
              const allMatCodes = [...new Set(maturityLevels.map(l => l.code))].sort()
              const matBg = ['bg-violet-200', 'bg-violet-300', 'bg-violet-400', 'bg-violet-500', 'bg-violet-600', 'bg-violet-700']
              const matTx = ['text-violet-900', 'text-violet-900', 'text-violet-900', 'text-white', 'text-white', 'text-white']

              const GanttBar = ({ dates }: { dates: RmDates }) => {
                const erpStart  = toPct(dates.pilotFrom)
                const erpEnd    = toPct(dates.rolloutFrom) ?? toPct(dates.fullUsageFrom)
                const einfStart = toPct(dates.rolloutFrom)
                const einfEnd   = toPct(dates.fullUsageFrom)
                const vollStart = toPct(dates.fullUsageFrom)
                return (
                  <div className="flex-1 relative h-5 bg-gray-50 rounded">
                    {quarters.slice(1).map((q, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-l border-gray-200" style={{ left: `${q.pct}%` }} />
                    ))}
                    {erpStart !== null && (
                      <div className="absolute top-0.5 bottom-0.5 bg-sky-300 rounded-sm" style={{
                        left: `${erpStart}%`,
                        width: erpEnd !== null && erpEnd > erpStart ? `${erpEnd - erpStart}%` : '1.5%',
                      }} />
                    )}
                    {einfStart !== null && einfEnd !== null && einfEnd > einfStart && (
                      <div className="absolute top-0.5 bottom-0.5 bg-brand-500 rounded-sm" style={{ left: `${einfStart}%`, width: `${einfEnd - einfStart}%` }} />
                    )}
                    {vollStart !== null && 100 > vollStart && (
                      <div className="absolute top-0.5 bottom-0.5 bg-blue-800 rounded-sm" style={{ left: `${vollStart}%`, width: `${100 - vollStart}%` }} />
                    )}
                  </div>
                )
              }

              return (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex flex-wrap gap-5 mb-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5"><span className="text-gray-800 text-sm leading-none select-none">◆</span><span>Meilenstein</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-4 h-3 rounded-sm bg-gray-600" /><span>Übergeordnete Phase</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-4 h-3 rounded-sm bg-sky-300" /><span>Erprobung</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-4 h-3 rounded-sm bg-brand-500" /><span>Einführung</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-4 h-3 rounded-sm bg-blue-800" /><span>Vollnutzung</span></div>
                  </div>

                  <div className="flex mb-1">
                    <div className="w-44 shrink-0" />
                    <div className="flex-1 relative h-5">
                      {quarters.map((q, i) => (
                        <div key={i} className="absolute text-[10px] text-gray-400 font-medium text-center truncate"
                          style={{ left: `${q.pct}%`, width: `${q.width}%` }}>
                          {q.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ART Maturity Bar */}
                  {matMilestones.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 mt-1">
                      <div className="w-44 shrink-0 text-xs font-semibold text-gray-900 text-right pr-3">ART-Maturität</div>
                      <div className="flex-1 relative h-6 rounded overflow-hidden bg-gray-100">
                        {quarters.slice(1).map((q, i) => (
                          <div key={i} className="absolute top-0 bottom-0 border-l border-white/50 z-10" style={{ left: `${q.pct}%` }} />
                        ))}
                        {matMilestones.map((m, i) => {
                          const startPct = Math.max(0, toPct(m.date) ?? 0)
                          const nextDate = matMilestones[i + 1]?.date
                          const endPct = nextDate ? Math.min(100, toPct(nextDate) ?? 100) : 100
                          if (endPct <= startPct) return null
                          const cIdx = allMatCodes.indexOf(m.code)
                          const bg = matBg[Math.min(cIdx, matBg.length - 1)]
                          const tx = matTx[Math.min(cIdx, matTx.length - 1)]
                          return (
                            <div key={m.code}
                              className={`absolute top-0 bottom-0 flex items-center justify-start overflow-hidden ${bg}`}
                              style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}>
                              <span className={`text-[10px] font-bold truncate pl-1.5 ${tx}`}>{m.code}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom timeline entries (milestones / phases) */}
                  {timelineEntries.length > 0 && (
                    <div className="flex items-center gap-2 mb-1 mt-1">
                      <div className="w-44 shrink-0 text-xs font-semibold text-gray-900 text-right pr-3 truncate">Übergeordnetes</div>
                      <div className="flex-1" />
                    </div>
                  )}
                  {timelineEntries.map(entry => {
                    const isMilestone = entry.date_from === entry.date_until
                    const fromDate = new Date(entry.date_from)
                    const untilDate = new Date(entry.date_until)
                    return (
                      <div key={entry.id} className="flex items-center gap-2 mb-1 group">
                        <div className="w-44 shrink-0 relative text-xs text-gray-700 text-right pr-3 truncate">
                          {entry.title}
                          {editable && (
                            <button type="button" title="Löschen"
                              onClick={() => handleDeleteTimelineEntry(entry.id, entry.title)}
                              className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs leading-none no-print transition-opacity">×</button>
                          )}
                        </div>
                        <div className="flex-1 relative h-5 bg-gray-50 rounded">
                          {quarters.slice(1).map((q, i) => (
                            <div key={i} className="absolute top-0 bottom-0 border-l border-gray-200" style={{ left: `${q.pct}%` }} />
                          ))}
                          {isMilestone ? (() => {
                            const pct = toPct(fromDate)
                            return pct !== null ? (
                              <div className="absolute" style={{ left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
                                <span className="text-gray-900 text-base leading-none select-none">◆</span>
                              </div>
                            ) : null
                          })() : (() => {
                            const startPct = toPct(fromDate)
                            const endPct = toPct(untilDate)
                            return startPct !== null && endPct !== null ? (
                              <div className="absolute top-0.5 bottom-0.5 bg-gray-600 rounded-sm"
                                style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0.5)}%` }} />
                            ) : null
                          })()}
                        </div>
                      </div>
                    )
                  })}
                  {editable && (
                    <div className="flex items-center gap-2 mb-3 no-print">
                      <div className="w-44 shrink-0 flex justify-end pr-3">
                        <button type="button" onClick={() => { setTlTitle(''); setTlFrom(''); setTlUntil(''); setShowTimelineModal(true) }}
                          className="text-[10px] text-brand-500 hover:text-brand-700 border border-dashed border-gray-300 hover:border-brand-400 rounded px-2 py-0.5 transition-colors">
                          + Eintrag
                        </button>
                      </div>
                      <div className="flex-1" />
                    </div>
                  )}

                  {teamGroups.length === 0 && timelineEntries.length === 0 && (
                    <p className="text-gray-400 text-sm py-2">Noch keine Zeitplanungen erfasst.</p>
                  )}
                  {teamGroups.map((tg, ti) => (
                    <div key={tg.teamId} className={ti > 0 ? 'mt-4' : ''}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-44 shrink-0 text-xs font-semibold text-gray-900 text-right pr-3 truncate">{tg.teamName}</div>
                        <div className="flex-1" />
                      </div>
                      {tg.useCases.map(ucEntry => (
                        <div key={ucEntry.ucId}>
                          {ucEntry.showSingle ? (
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-44 shrink-0 text-xs text-gray-700 text-right pr-3 truncate">{ucEntry.ucTitle}</div>
                              <GanttBar dates={ucEntry.singleDates} />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center mb-0.5">
                                <div className="w-44 shrink-0 text-xs text-gray-700 text-right pr-3 truncate">{ucEntry.ucTitle}</div>
                                <div className="flex-1" />
                              </div>
                              {ucEntry.capRows.map(cap => (
                                <div key={cap.capId} className="flex items-center gap-2 mb-1">
                                  <div className="w-44 shrink-0 text-[10px] text-gray-600 text-right pr-3 pl-3 truncate">{cap.capName}</div>
                                  <GanttBar dates={cap} />
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )
            })()}

            </div>
          </CollapsibleSection>

          {/* ══════ POTENTIALANALYSE (ausgeblendet) ══════════════════════ */}
          {false && <CollapsibleSection title="Potentialanalyse" subtitle="Geschätztes FTE-Effizienzpotential nach Quartal (2026–2030)">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {!hasAnyPotential ? (
                <p className="text-gray-400 text-sm">Noch kein Potential berechenbar. Plane AI Use Cases mit Status «Geplant», Volle-Nutzung-Datum und Effizienzpotential pro Capability.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mb-4">
                    Kumulatives FTE-Einsparpotential pro Quartal, basierend auf den geplanten Use Cases, Volle-Nutzung-Daten und Effizienzpotentialen je Capability.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-600 border-b border-gray-200">
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
          </CollapsibleSection>}

          {/* ══════ FINANZEN (ausgeblendet) ═══════════════════════════════ */}
          {false && <CollapsibleSection title="Finanzen" subtitle="Budget & Kostenplanung">
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
                    <button type="button" onClick={() => { setBudget2027(art?.budget_2027 != null ? String(art?.budget_2027) : ''); setEditingFinanzen(false) }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Budget 2027</p>
                    <p className="text-xl font-bold text-gray-900">{formatCHF(art?.budget_2027 ?? null)}</p>
                  </div>
                  {editable && (
                    <button type="button" onClick={() => setEditingFinanzen(true)}
                      className="px-3 py-1.5 border border-gray-200 text-xs text-brand-600 hover:bg-brand-50 font-medium rounded-lg no-print">Bearbeiten</button>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>}

          {/* ══════ OPTIONALE VERTIEFUNGEN & SPEZIFIKA ════════════════════ */}
          <CollapsibleSection title="Optionale Vertiefung: Technologie- & Plattform-Tiefe" subtitle="Plattformarchitektur, Tool-Stack und technische Abhängigkeiten">
            <p className="text-sm text-gray-400 italic">Noch kein Inhalt erfasst.</p>
          </CollapsibleSection>

          <CollapsibleSection title="Optionale Vertiefung: Sourcing- & Zusammenarbeitsmodell" subtitle="Make-or-Buy, Partner, Lieferantenstruktur und Kollaborationsmodell">
            <p className="text-sm text-gray-400 italic">Noch kein Inhalt erfasst.</p>
          </CollapsibleSection>

          <CollapsibleSection title="Optionale Vertiefung: Skill-Matrix & Workforce (WFM)" subtitle="Kompetenzanforderungen, Lückenanalyse und Personalplanung">
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <SummaryTable rows={artSummary} totals={artTotals} />
              </div>
              {Object.keys(artCapAllocation).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Verteilung der Arbeitsleistung – gesamter ART</h5>
                  <StackedBar slices={capabilities
                    .map(cap => ({ label: cap.name, value: artCapAllocation[cap.id] ?? 0, color: cap.color ?? '#6366f1' }))} />
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Optionale Vertiefung: Ökonomie-Vorschau (qualitativ)" subtitle="Erwarteter Nutzen, Einsparpotenziale und Investitionsrahmen">
            <p className="text-sm text-gray-400 italic">Noch kein Inhalt erfasst.</p>
          </CollapsibleSection>

          <CollapsibleSection title="Optionale Vertiefung: Wirkungsmodell & Metriken" subtitle="Wirkungskette, KPIs und Erfolgsmessung">
            <p className="text-sm text-gray-400 italic">Noch kein Inhalt erfasst.</p>
          </CollapsibleSection>

          <CollapsibleSection title="Optionale Vertiefung: Governance- & Security" subtitle="Steuerungsmodell, Verantwortlichkeiten und Sicherheitsanforderungen">
            <p className="text-sm text-gray-400 italic">Noch kein Inhalt erfasst.</p>
          </CollapsibleSection>

          <CollapsibleSection title="SES-Spezifika: Enabler-/Service-Track" subtitle="SES-spezifische Enabler, Service-Tracks und Querschnittsthemen">
            <p className="text-sm text-gray-400 italic">Noch kein Inhalt erfasst.</p>
          </CollapsibleSection>

          <CollapsibleSection title="Qualitäts-Checkliste" subtitle="Vollständigkeit und Qualitätssicherung des Transformationsplans">
            {checklistItems.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Noch keine Checklisten-Einträge vorhanden. Im Admin-Bereich können diese erfasst werden.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {checklistItems.map(item => {
                  const completion = checklistCompletions.find(c => c.checklist_item_id === item.id)
                  const isChecked = !!completion
                  const handleToggle = async () => {
                    if (!art || !editable) return
                    const newChecked = !isChecked
                    setChecklistCompletions(prev =>
                      newChecked
                        ? [...prev, { id: '', art_id: art.id, checklist_item_id: item.id, completed_at: new Date().toISOString(), created_at: new Date().toISOString() }]
                        : prev.filter(c => c.checklist_item_id !== item.id)
                    )
                    try {
                      await setARTQualityChecklistCompletion(art.id, item.id, newChecked)
                      const updated = await loadARTQualityChecklistCompletions(art.id)
                      setChecklistCompletions(updated)
                    } catch { loadData() }
                  }
                  return (
                    <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                      <div className="flex-shrink-0 pt-0.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={editable ? handleToggle : undefined}
                          readOnly={!editable}
                          className={`w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 ${editable ? 'cursor-pointer' : 'cursor-default'}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isChecked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-gray-600 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      {completion && (
                        <div className="shrink-0 text-right">
                          <span className="text-xs text-gray-400">
                            {new Date(completion.completed_at).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CollapsibleSection>

          {/* ══════ VERSIONSVERLAUF ═══════════════════════════════════════ */}
          <CollapsibleSection title="Versionsverlauf" subtitle="Alle bisherigen Versionen">
            {versions.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Versionen.</p> : (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
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
  teamTypes: TeamType[]; initTypeIds: string[]
  onSave: (teamId: string, name: string, desc: string | null, challenges: string | null, typeIds: string[]) => void
  onDeleteTeam: (id: string, name: string) => void
  onAddMember: (m: Pick<TeamMember, 'role_id' | 'type' | 'category' | 'fte' | 'headcount'>) => void
  onDeleteMember: (id: string) => void; onAllocChange: (capId: string, val: number) => void; onClose: () => void
}

function TeamEditMode({ teamData, roles, capabilities, saving, teamTypes, initTypeIds, onSave, onDeleteTeam, onAddMember, onDeleteMember, onAllocChange, onClose }: TeamEditModeProps) {
  const { team, members, allocations } = teamData
  const [editName, setEditName] = useState(team.name)
  const [editDesc, setEditDesc] = useState(team.description ?? '')
  const [editChallenges, setEditChallenges] = useState(team.challenges ?? '')
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>(initTypeIds)
  const totalAlloc = Object.values(allocations).reduce((s, v) => s + v, 0)
  const allocOk = totalAlloc === 100 || totalAlloc === 0

  const toggleType = (id: string) => setSelectedTypeIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold text-gray-900">Team bearbeiten</h4>
        <button type="button" onClick={() => onDeleteTeam(team.id, team.name)} className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg">Team löschen</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><label htmlFor={`tn-${team.id}`} className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input id={`tn-${team.id}`} value={editName} onChange={e => setEditName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" /></div>
        <div><label htmlFor={`td-${team.id}`} className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung</label>
          <input id={`td-${team.id}`} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" /></div>
      </div>
      {teamTypes.length > 0 && (
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-2">Teamtyp</label>
          <div className="flex flex-wrap gap-2">
            {teamTypes.map(tt => {
              const checked = selectedTypeIds.includes(tt.id)
              return (
                <button key={tt.id} type="button" onClick={() => toggleType(tt.id)}
                  className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium border transition-all ${checked ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                  style={checked ? { backgroundColor: tt.color ?? '#6366f1', borderColor: tt.color ?? '#6366f1' } : {}}>
                  {!checked && <span className="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: tt.color ?? '#6366f1' }} />}
                  {tt.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <h5 className="text-xs font-semibold text-gray-600 mb-2">Mitarbeitende</h5>
      <TeamMemberTable members={members} roles={roles} onAdd={onAddMember} onDelete={onDeleteMember} />
      {capabilities.length > 0 && <div className="mt-6"><CapabilitySliders capabilities={capabilities} allocations={allocations} onChange={onAllocChange} /></div>}
      <div className="mt-5">
        <label htmlFor={`tc-${team.id}`} className="block text-xs font-medium text-gray-600 mb-1">Aktuelle Herausforderungen/Chancen im Workflow dieses Teams</label>
        <textarea id={`tc-${team.id}`} value={editChallenges} onChange={e => setEditChallenges(e.target.value)} rows={3} placeholder="Optional"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y" />
      </div>
      <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
        <button type="button" onClick={() => onSave(team.id, editName.trim() || team.name, editDesc.trim() || null, editChallenges.trim() || null, selectedTypeIds)} disabled={saving || !allocOk}
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
  not_planned: 'bg-gray-100 text-gray-600',
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
          {useCase.description && <p className="text-xs text-gray-600 mt-0.5">{useCase.description}</p>}
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
          {useCase.description && <p className="text-xs text-gray-600 mt-0.5">{useCase.description}</p>}
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
                            <label htmlFor={`pilot-${useCase.id}-${s.teamId}-${d.capId}`} className="block text-[10px] text-gray-600 mb-0.5">Prüfung ab</label>
                            <input id={`pilot-${useCase.id}-${s.teamId}-${d.capId}`} type="date" value={d.pilot_from}
                              disabled={isDisabled}
                              onChange={e => updateDate(s.teamId, d.capId, 'pilot_from', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50" />
                          </div>
                          <div>
                            <label htmlFor={`rollout-${useCase.id}-${s.teamId}-${d.capId}`} className="block text-[10px] text-gray-600 mb-0.5">Einführung ab</label>
                            <input id={`rollout-${useCase.id}-${s.teamId}-${d.capId}`} type="date" value={d.rollout_from}
                              disabled={isDisabled}
                              onChange={e => updateDate(s.teamId, d.capId, 'rollout_from', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50" />
                          </div>
                          <div>
                            <label htmlFor={`full-${useCase.id}-${s.teamId}-${d.capId}`} className="block text-[10px] text-gray-600 mb-0.5">Volle Nutzung ab</label>
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

// ─── Use Case Plan Table ─────────────────────────────────────────────────────

type PlanRow = {
  teamId: string
  status: ARTUseCaseStatus
  useAllCaps: boolean
  allDates: { pilot_from: string; rollout_from: string; full_usage_from: string }
  capDates: Record<string, { pilot_from: string; rollout_from: string; full_usage_from: string }>
}

type UseCasePlanTableProps = {
  useCase: AIUseCase
  teams: Team[]
  statusRows: ARTUseCase[]
  capLinks: AIUseCaseCapability[]
  capabilities: BizDevOpsCapability[]
  existingDates: ARTUseCaseDateRow[]
  editable: boolean
  isEditing: boolean
  saving: boolean
  onEdit: () => void
  onSave: (rows: ARTUseCase[], dateRows: { teamId: string; capId: string; pilot_from: string | null; rollout_from: string | null; full_usage_from: string | null }[]) => void
  onRemove: () => void
  onClose: () => void
}

const PLAN_STATUS_BADGE: Record<ARTUseCaseStatus, string> = {
  planned: 'bg-blue-50 text-blue-700',
  not_planned: 'bg-amber-50 text-amber-700',
  not_needed: 'bg-gray-50 text-gray-400',
}
const PLAN_STATUS_LABEL: Record<ARTUseCaseStatus, string> = {
  planned: 'Geplant',
  not_planned: 'Nicht geplant',
  not_needed: 'Nicht benötigt',
}

function UseCasePlanTable({
  useCase, teams, statusRows, capLinks, capabilities, existingDates,
  editable, isEditing, saving, onEdit, onSave, onRemove, onClose,
}: UseCasePlanTableProps) {
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const multiCap = capLinks.length > 1
  const hasCaps = capLinks.length > 0

  const getCapName = (id: string) => capabilities.find(c => c.id === id)?.name ?? '–'
  const getCapColor = (id: string) => capabilities.find(c => c.id === id)?.color ?? '#6366f1'

  const buildRows = (): PlanRow[] => sortedTeams.map(team => {
    const sr = statusRows.find(r => r.team_id === team.id)
    const status: ARTUseCaseStatus = sr?.status ?? 'not_planned'
    const tDates = existingDates.filter(d => d.team_id === team.id)

    const capDates: Record<string, { pilot_from: string; rollout_from: string; full_usage_from: string }> = {}
    capLinks.forEach(link => {
      const d = tDates.find(dd => dd.capability_id === link.capability_id)
      capDates[link.capability_id] = {
        pilot_from: d?.pilot_from ?? '',
        rollout_from: d?.rollout_from ?? '',
        full_usage_from: d?.full_usage_from ?? '',
      }
    })

    const capVals = Object.values(capDates)
    const allSame = capVals.length <= 1 || capVals.every(v =>
      v.pilot_from === capVals[0].pilot_from &&
      v.rollout_from === capVals[0].rollout_from &&
      v.full_usage_from === capVals[0].full_usage_from
    )
    const firstCapId = capLinks[0]?.capability_id
    const allDates = firstCapId
      ? capDates[firstCapId]
      : { pilot_from: '', rollout_from: '', full_usage_from: '' }

    return { teamId: team.id, status, useAllCaps: allSame, allDates, capDates }
  })

  const [rows, setRows] = useState<PlanRow[]>(() => buildRows())

  const setStatus = (teamId: string, status: ARTUseCaseStatus) =>
    setRows(prev => prev.map(r => r.teamId !== teamId ? r : { ...r, status }))

  const setUseAllCaps = (teamId: string, val: boolean) =>
    setRows(prev => prev.map(r => r.teamId !== teamId ? r : {
      ...r, useAllCaps: val,
      capDates: val
        ? Object.fromEntries(Object.keys(r.capDates).map(k => [k, { ...r.allDates }]))
        : r.capDates,
    }))

  const setAllDate = (teamId: string, field: 'pilot_from' | 'rollout_from' | 'full_usage_from', val: string) =>
    setRows(prev => prev.map(r => {
      if (r.teamId !== teamId) return r
      const newAll = { ...r.allDates, [field]: val }
      return {
        ...r, allDates: newAll,
        capDates: r.useAllCaps
          ? Object.fromEntries(Object.keys(r.capDates).map(k => [k, { ...newAll }]))
          : r.capDates,
      }
    }))

  const setCapDate = (teamId: string, capId: string, field: 'pilot_from' | 'rollout_from' | 'full_usage_from', val: string) =>
    setRows(prev => prev.map(r => r.teamId !== teamId ? r : {
      ...r, capDates: { ...r.capDates, [capId]: { ...r.capDates[capId], [field]: val } },
    }))

  const handleSave = () => {
    const artRows: ARTUseCase[] = rows.map(r => ({
      id: statusRows.find(sr => sr.team_id === r.teamId)?.id ?? `new-${useCase.id}-${r.teamId}`,
      art_id: statusRows.find(sr => sr.team_id === r.teamId)?.art_id ?? '',
      use_case_id: useCase.id,
      team_id: r.teamId,
      status: r.status,
      created_at: '',
    }))
    const dateRows: { teamId: string; capId: string; pilot_from: string | null; rollout_from: string | null; full_usage_from: string | null }[] = []
    rows.forEach(r => {
      if (r.status !== 'planned' || !hasCaps) return
      capLinks.forEach(link => {
        const d = r.useAllCaps ? r.allDates : r.capDates[link.capability_id]
        dateRows.push({
          teamId: r.teamId, capId: link.capability_id,
          pilot_from: d?.pilot_from || null,
          rollout_from: d?.rollout_from || null,
          full_usage_from: d?.full_usage_from || null,
        })
      })
    })
    onSave(artRows, dateRows)
  }

  const di = (val: string, onChange: (v: string) => void, hasError?: boolean) => (
    <input type="date" value={val} onChange={e => onChange(e.target.value)}
      className={`w-32 px-1.5 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 ${hasError ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200 focus:ring-brand-500'}`} />
  )

  const getDatesErr = (d: { pilot_from: string; rollout_from: string; full_usage_from: string }) => ({
    rollout_from: !!(d.pilot_from && d.rollout_from && d.pilot_from > d.rollout_from),
    full_usage_from: !!(d.rollout_from && d.full_usage_from && d.rollout_from > d.full_usage_from),
  })

  const hasValidationErrors = rows.some(r => {
    if (r.status !== 'planned' || !hasCaps) return false
    const check = (d: { pilot_from: string; rollout_from: string; full_usage_from: string }) => {
      const e = getDatesErr(d); return e.rollout_from || e.full_usage_from
    }
    return r.useAllCaps
      ? check(r.allDates)
      : capLinks.some(link => check(r.capDates[link.capability_id] ?? { pilot_from: '', rollout_from: '', full_usage_from: '' }))
  })

  const isConflict = (date: string | null | undefined) =>
    !!(date && useCase.available_from && date < useCase.available_from)

  // ── View mode ────────────────────────────────────────────────────────────────
  if (!isEditing) {
    const viewRows = buildRows()
    return (
      <div>
        {(useCase.status || useCase.available_from) && (
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
            {useCase.status && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-gray-400">Status:</span>
                <span className="font-medium text-gray-800">{useCase.status}</span>
              </span>
            )}
            {useCase.available_from && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-gray-400">Verfügbar ab:</span>
                <span className="font-medium text-gray-800">{fmtDate(useCase.available_from)}</span>
              </span>
            )}
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 font-semibold">Team</th>
                <th className="px-4 py-2.5 font-semibold">Planungsstatus</th>
                {hasCaps && <>
                  <th className="px-4 py-2.5 font-semibold">Prüfung ab</th>
                  <th className="px-4 py-2.5 font-semibold">Einführung ab</th>
                  <th className="px-4 py-2.5 font-semibold">Volle Nutzung ab</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {viewRows.map((row, ri) => {
                const team = sortedTeams.find(t => t.id === row.teamId)!
                const isPlanned = row.status === 'planned'
                const isNotNeeded = row.status === 'not_needed'
                const borderClass = ri < viewRows.length - 1 ? 'border-b border-gray-100' : ''
                const tDates = existingDates.filter(d => d.team_id === row.teamId)
                const capVals = capLinks.map(link => tDates.find(d => d.capability_id === link.capability_id))
                const uniformDates = capVals.length <= 1 || capVals.every(d =>
                  (d?.pilot_from ?? null) === (capVals[0]?.pilot_from ?? null) &&
                  (d?.rollout_from ?? null) === (capVals[0]?.rollout_from ?? null) &&
                  (d?.full_usage_from ?? null) === (capVals[0]?.full_usage_from ?? null)
                )

                if (!isPlanned || !hasCaps) {
                  return (
                    <tr key={row.teamId} className={`${borderClass} ${isNotNeeded ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{team.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${PLAN_STATUS_BADGE[row.status]}`}>
                          {PLAN_STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      {hasCaps && <td colSpan={3} className="px-4 py-2.5 text-gray-300">–</td>}
                    </tr>
                  )
                }

                if (uniformDates) {
                  const firstD = capVals[0]
                  return (
                    <tr key={row.teamId} className={`${borderClass} bg-blue-50/20`}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{team.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${PLAN_STATUS_BADGE['planned']}`}>Geplant</span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-gray-700">{fmtDate(firstD?.pilot_from ?? null)}</td>
                      <td className={`px-4 py-2.5 tabular-nums font-medium ${isConflict(firstD?.rollout_from) ? 'text-red-600' : 'text-gray-700'}`}>{fmtDate(firstD?.rollout_from ?? null)}</td>
                      <td className={`px-4 py-2.5 tabular-nums font-medium ${isConflict(firstD?.full_usage_from) ? 'text-red-600' : 'text-gray-700'}`}>{fmtDate(firstD?.full_usage_from ?? null)}</td>
                    </tr>
                  )
                }

                return (
                  <Fragment key={row.teamId}>
                    <tr className="bg-blue-50/20">
                      <td className="px-4 pt-2.5 pb-1 font-medium text-gray-900">{team.name}</td>
                      <td className="px-4 pt-2.5 pb-1">
                        <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${PLAN_STATUS_BADGE['planned']}`}>Geplant</span>
                      </td>
                      {hasCaps && <td colSpan={3} />}
                    </tr>
                    {capLinks.map((link, ci) => {
                      const d = tDates.find(dd => dd.capability_id === link.capability_id)
                      const isLastCap = ci === capLinks.length - 1
                      return (
                        <tr key={`${row.teamId}-${link.capability_id}`}
                          className={`bg-blue-50/10 ${isLastCap && ri < viewRows.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <td className="px-4 pb-2 pl-8 text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getCapColor(link.capability_id) }} />
                              {getCapName(link.capability_id)}
                            </span>
                          </td>
                          <td />
                          <td className="pb-2 px-4 tabular-nums text-gray-600">{fmtDate(d?.pilot_from ?? null)}</td>
                          <td className={`pb-2 px-4 tabular-nums font-medium ${isConflict(d?.rollout_from) ? 'text-red-600' : 'text-gray-600'}`}>{fmtDate(d?.rollout_from ?? null)}</td>
                          <td className={`pb-2 px-4 tabular-nums font-medium ${isConflict(d?.full_usage_from) ? 'text-red-600' : 'text-gray-600'}`}>{fmtDate(d?.full_usage_from ?? null)}</td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
        {useCase.status && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-gray-400">Status:</span>
            <span className="font-medium text-gray-800">{useCase.status}</span>
          </span>
        )}
        {useCase.available_from && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-gray-400">Verfügbar ab:</span>
            <span className="font-medium text-gray-800">{fmtDate(useCase.available_from)}</span>
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-gray-500 bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 font-semibold">Team</th>
              <th className="px-4 py-2.5 font-semibold">Planungsstatus</th>
              {multiCap && <th className="px-4 py-2.5 font-semibold">Capabilities</th>}
              {hasCaps && <>
                <th className="px-4 py-2.5 font-semibold">Prüfung ab</th>
                <th className="px-4 py-2.5 font-semibold">Einführung ab</th>
                <th className="px-4 py-2.5 font-semibold">Volle Nutzung ab</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const team = sortedTeams.find(t => t.id === row.teamId)!
              const isPlanned = row.status === 'planned'
              const showPerCap = isPlanned && hasCaps && !row.useAllCaps
              const borderClass = (ri < rows.length - 1 && !showPerCap) ? 'border-b border-gray-100' : ''
              return (
                <Fragment key={row.teamId}>
                  <tr className={borderClass}>
                    <td className="px-4 py-2 font-medium text-gray-900 align-top">{team.name}</td>
                    <td className="px-4 py-2 align-top">
                      <select value={row.status} title="Planungsstatus"
                        onChange={e => setStatus(row.teamId, e.target.value as ARTUseCaseStatus)}
                        className="w-36 px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                        <option value="planned">Geplant</option>
                        <option value="not_planned">Nicht geplant</option>
                        <option value="not_needed">Nicht benötigt</option>
                      </select>
                    </td>
                    {multiCap && (
                      <td className="px-4 py-2 align-top">
                        {isPlanned && (
                          <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer select-none whitespace-nowrap">
                            <input type="checkbox" checked={row.useAllCaps}
                              onChange={e => setUseAllCaps(row.teamId, e.target.checked)}
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                            Gleich für alle
                          </label>
                        )}
                      </td>
                    )}
                    {isPlanned && hasCaps && row.useAllCaps && (() => {
                      const err = getDatesErr(row.allDates)
                      return <>
                        <td className="px-4 py-2 align-top">{di(row.allDates.pilot_from, v => setAllDate(row.teamId, 'pilot_from', v))}</td>
                        <td className="px-4 py-2 align-top">{di(row.allDates.rollout_from, v => setAllDate(row.teamId, 'rollout_from', v), err.rollout_from)}</td>
                        <td className="px-4 py-2 align-top">{di(row.allDates.full_usage_from, v => setAllDate(row.teamId, 'full_usage_from', v), err.full_usage_from)}</td>
                      </>
                    })()}
                    {(!isPlanned || !hasCaps) && hasCaps && (
                      <td colSpan={3} className="px-4 py-2 text-gray-300">–</td>
                    )}
                    {isPlanned && hasCaps && !row.useAllCaps && (
                      <td colSpan={3} />
                    )}
                  </tr>
                  {showPerCap && capLinks.map((link, ci) => (
                    <tr key={`${row.teamId}-${link.capability_id}`}
                      className={`bg-gray-50/50 ${ci === capLinks.length - 1 && ri < rows.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <td className="px-4 py-1.5 pl-8 text-gray-500 align-middle">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getCapColor(link.capability_id) }} />
                          {getCapName(link.capability_id)}
                        </span>
                      </td>
                      {multiCap && <td />}
                      {(() => {
                        const cd = row.capDates[link.capability_id] ?? { pilot_from: '', rollout_from: '', full_usage_from: '' }
                        const err = getDatesErr(cd)
                        return <>
                          <td className="py-1.5 px-4 align-middle">{di(cd.pilot_from, v => setCapDate(row.teamId, link.capability_id, 'pilot_from', v))}</td>
                          <td className="py-1.5 px-4 align-middle">{di(cd.rollout_from, v => setCapDate(row.teamId, link.capability_id, 'rollout_from', v), err.rollout_from)}</td>
                          <td className="py-1.5 px-4 align-middle">{di(cd.full_usage_from, v => setCapDate(row.teamId, link.capability_id, 'full_usage_from', v), err.full_usage_from)}</td>
                        </>
                      })()}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3 no-print flex-wrap">
        <button type="button" onClick={handleSave} disabled={saving || hasValidationErrors}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Abbrechen</button>
        {hasValidationErrors && (
          <span className="text-xs text-red-500">Datumsreihenfolge prüfen: Prüfung ab → Einführung ab → Volle Nutzung ab</span>
        )}
        <button type="button" onClick={onRemove}
          className="ml-auto px-4 py-2 text-sm text-red-400 hover:text-red-600">Use Case entfernen</button>
      </div>
    </div>
  )
}
