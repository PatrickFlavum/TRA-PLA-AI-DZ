import { createClient } from '@supabase/supabase-js'
import type {
  Organization, ART, EmployeeRole, BizDevOpsCapability,
  PlanVersion, Team, TeamMember, TeamCapabilityAllocation,
  GuidanceMode, MaturityLevel, AIUseCase, AIUseCaseCapability,
  AIUseCaseMaturityLevel, ARTUseCase, ARTUseCaseStatus, ARTUseCaseDateRow,
  ARTUseCaseRating, BusinessDivision,
} from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ─── Business Divisions (IT-Geschäftsbereiche) ────────────────────────────────

export async function loadBusinessDivisions(): Promise<BusinessDivision[]> {
  const { data, error } = await supabase
    .from('business_divisions')
    .select('*')
    .order('title')
  if (error) throw error
  return (data ?? []) as BusinessDivision[]
}

export async function createBusinessDivision(
  params: Pick<BusinessDivision, 'title' | 'description'>
): Promise<BusinessDivision> {
  const { data, error } = await supabase
    .from('business_divisions')
    .insert(params)
    .select()
    .single()
  if (error) throw error
  return data as BusinessDivision
}

export async function updateBusinessDivision(
  id: string,
  params: Pick<BusinessDivision, 'title' | 'description'>
): Promise<void> {
  const { error } = await supabase
    .from('business_divisions')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteBusinessDivision(id: string): Promise<void> {
  const { error } = await supabase
    .from('business_divisions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Organizations ────────────────────────────────────────────────────────────

export async function loadOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as Organization[]
}

export async function loadOrganization(id: string): Promise<Organization | null> {
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()
  return data as Organization | null
}

export async function createOrganization(
  params: Pick<Organization, 'name' | 'description'>
): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .insert(params)
    .select()
    .single()
  if (error) throw error
  return data as Organization
}

export async function updateOrganization(
  id: string,
  params: Partial<Pick<Organization, 'name' | 'description' | 'business_division_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteOrganization(id: string): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── ARTs ─────────────────────────────────────────────────────────────────────

export async function loadARTs(orgId: string): Promise<ART[]> {
  const { data, error } = await supabase
    .from('arts')
    .select('*')
    .eq('org_id', orgId)
    .order('name')
  if (error) throw error
  return (data ?? []) as ART[]
}

export async function loadART(id: string): Promise<ART | null> {
  const { data } = await supabase
    .from('arts')
    .select('*')
    .eq('id', id)
    .single()
  return data as ART | null
}

export async function loadARTByToken(token: string, field: 'edit_token' | 'readonly_token'): Promise<ART | null> {
  const { data } = await supabase
    .from('arts')
    .select('*')
    .eq(field, token)
    .single()
  return data as ART | null
}

export async function createART(
  params: Pick<ART, 'org_id' | 'name' | 'description'>
): Promise<ART> {
  const edit_token = generateUUID()
  const readonly_token = generateUUID()
  const { data, error } = await supabase
    .from('arts')
    .insert({ ...params, edit_token, readonly_token })
    .select()
    .single()
  if (error) throw error
  return data as ART
}

export async function updateART(
  id: string,
  params: Partial<Pick<ART, 'name' | 'description' | 'mission_statement' | 'business_context' | 'risks' | 'budget_2027' | 'guidance_mode_id' | 'art_leadership' | 'responsible_person' | 'cyber_criticality' | 'cyber_criticality_reason' | 'guidance_mode_reason' | 'current_maturity_level_id' | 'planned_approach'>>
): Promise<void> {
  const { error } = await supabase
    .from('arts')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteART(id: string): Promise<void> {
  const { error } = await supabase
    .from('arts')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Employee Roles ──────────────────────────────────────────────────────────

export async function loadEmployeeRoles(): Promise<EmployeeRole[]> {
  const { data, error } = await supabase
    .from('employee_roles')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as EmployeeRole[]
}

export async function createEmployeeRole(name: string): Promise<EmployeeRole> {
  const { data: maxData } = await supabase
    .from('employee_roles')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const sort_order = (maxData?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('employee_roles')
    .insert({ name, sort_order })
    .select()
    .single()
  if (error) throw error
  return data as EmployeeRole
}

export async function updateEmployeeRole(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('employee_roles')
    .update({ name })
    .eq('id', id)
  if (error) throw error
}

export async function deleteEmployeeRole(id: string): Promise<void> {
  const { error } = await supabase
    .from('employee_roles')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── BizDevOps Capabilities ─────────────────────────────────────────────────

export async function loadCapabilities(): Promise<BizDevOpsCapability[]> {
  const { data, error } = await supabase
    .from('bizdevops_capabilities')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as BizDevOpsCapability[]
}

export async function createCapability(name: string, color: string | null = null): Promise<BizDevOpsCapability> {
  const { data: maxData } = await supabase
    .from('bizdevops_capabilities')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const sort_order = (maxData?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('bizdevops_capabilities')
    .insert({ name, color, sort_order })
    .select()
    .single()
  if (error) throw error
  return data as BizDevOpsCapability
}

export async function updateCapability(id: string, params: { name: string; color: string | null; sort_order: number }): Promise<void> {
  const { error } = await supabase
    .from('bizdevops_capabilities')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteCapability(id: string): Promise<void> {
  const { error } = await supabase
    .from('bizdevops_capabilities')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Plan Versions ──────────────────────────────────────────────────────────

export async function loadPlanVersions(artId: string): Promise<PlanVersion[]> {
  const { data, error } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('art_id', artId)
    .order('version_number', { ascending: false })
  if (error) throw error
  return (data ?? []) as PlanVersion[]
}

export async function loadPlanVersionByNumber(artId: string, versionNumber: number): Promise<PlanVersion | null> {
  const { data } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('art_id', artId)
    .eq('version_number', versionNumber)
    .single()
  return data as PlanVersion | null
}

export async function loadLatestVersion(artId: string): Promise<PlanVersion | null> {
  const { data } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('art_id', artId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()
  return data as PlanVersion | null
}

export async function createPlanVersion(artId: string): Promise<PlanVersion> {
  const latest = await loadLatestVersion(artId)
  const version_number = (latest?.version_number ?? 0) + 1

  const { data, error } = await supabase
    .from('plan_versions')
    .insert({ art_id: artId, version_number, status: 'draft' })
    .select()
    .single()
  if (error) throw error
  return data as PlanVersion
}

export async function checkInVersion(id: string, changeDescription: string, snapshot: any): Promise<void> {
  const { error } = await supabase
    .from('plan_versions')
    .update({
      status: 'checked_in',
      change_description: changeDescription,
      snapshot,
      checked_in_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

// ─── Teams ──────────────────────────────────────────────────────────────────

export async function loadTeams(artId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('art_id', artId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as Team[]
}

export async function createTeam(
  params: Pick<Team, 'art_id' | 'name' | 'description'>
): Promise<Team> {
  const { data: maxData } = await supabase
    .from('teams')
    .select('sort_order')
    .eq('art_id', params.art_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const sort_order = (maxData?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('teams')
    .insert({ ...params, sort_order })
    .select()
    .single()
  if (error) throw error
  return data as Team
}

export async function updateTeam(
  id: string,
  params: Partial<Pick<Team, 'name' | 'description'>>
): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Team Members ───────────────────────────────────────────────────────────

export async function loadTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
  if (error) throw error
  return (data ?? []) as TeamMember[]
}

export async function loadAllTeamMembers(teamIds: string[]): Promise<TeamMember[]> {
  if (teamIds.length === 0) return []
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .in('team_id', teamIds)
  if (error) throw error
  return (data ?? []) as TeamMember[]
}

export async function createTeamMember(
  params: Pick<TeamMember, 'team_id' | 'role_id' | 'type' | 'category' | 'fte' | 'headcount'>
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .insert(params)
    .select()
    .single()
  if (error) throw error
  return data as TeamMember
}

export async function updateTeamMember(
  id: string,
  params: Partial<Pick<TeamMember, 'role_id' | 'type' | 'category' | 'fte' | 'headcount'>>
): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Team Capability Allocations ────────────────────────────────────────────

export async function loadTeamAllocations(teamId: string): Promise<TeamCapabilityAllocation[]> {
  const { data, error } = await supabase
    .from('team_capability_allocations')
    .select('*')
    .eq('team_id', teamId)
  if (error) throw error
  return (data ?? []) as TeamCapabilityAllocation[]
}

export async function loadAllTeamAllocations(teamIds: string[]): Promise<TeamCapabilityAllocation[]> {
  if (teamIds.length === 0) return []
  const { data, error } = await supabase
    .from('team_capability_allocations')
    .select('*')
    .in('team_id', teamIds)
  if (error) throw error
  return (data ?? []) as TeamCapabilityAllocation[]
}

export async function upsertTeamAllocation(
  teamId: string,
  capabilityId: string,
  percentage: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('team_capability_allocations')
    .select('id')
    .eq('team_id', teamId)
    .eq('capability_id', capabilityId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('team_capability_allocations')
      .update({ percentage })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('team_capability_allocations')
      .insert({ team_id: teamId, capability_id: capabilityId, percentage })
    if (error) throw error
  }
}

export async function saveTeamAllocations(
  teamId: string,
  allocations: { capability_id: string; percentage: number }[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('team_capability_allocations')
    .delete()
    .eq('team_id', teamId)
  if (delError) throw delError

  if (allocations.length > 0) {
    const rows = allocations.map(a => ({ team_id: teamId, ...a }))
    const { error } = await supabase
      .from('team_capability_allocations')
      .insert(rows)
    if (error) throw error
  }
}

// ─── Guidance Modes (Begleitungsmodi) ───────────────────────────────────

export async function loadGuidanceModes(): Promise<GuidanceMode[]> {
  const { data, error } = await supabase
    .from('guidance_modes')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as GuidanceMode[]
}

export async function createGuidanceMode(
  params: Pick<GuidanceMode, 'letter' | 'title' | 'description'>
): Promise<GuidanceMode> {
  const { data: maxData } = await supabase
    .from('guidance_modes')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const sort_order = (maxData?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('guidance_modes')
    .insert({ ...params, sort_order })
    .select()
    .single()
  if (error) throw error
  return data as GuidanceMode
}

export async function updateGuidanceMode(
  id: string,
  params: Partial<Pick<GuidanceMode, 'letter' | 'title' | 'description'>>
): Promise<void> {
  const { error } = await supabase
    .from('guidance_modes')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteGuidanceMode(id: string): Promise<void> {
  const { error } = await supabase
    .from('guidance_modes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Maturity Levels (Maturitätsstufen) ─────────────────────────────────

export async function loadMaturityLevels(): Promise<MaturityLevel[]> {
  const { data, error } = await supabase
    .from('maturity_levels')
    .select('*')
    .order('code', { ascending: true })
  if (error) throw error
  return (data ?? []) as MaturityLevel[]
}

export async function createMaturityLevel(
  params: Pick<MaturityLevel, 'code' | 'title' | 'description'>
): Promise<MaturityLevel> {
  const { data, error } = await supabase
    .from('maturity_levels')
    .insert(params)
    .select()
    .single()
  if (error) throw error
  return data as MaturityLevel
}

export async function updateMaturityLevel(
  id: string,
  params: Pick<MaturityLevel, 'code' | 'title' | 'description'>
): Promise<void> {
  const { error } = await supabase
    .from('maturity_levels')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteMaturityLevel(id: string): Promise<void> {
  const { error } = await supabase
    .from('maturity_levels')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── AI Use Cases ─────────────────────────────────────────────────────────

export async function loadAIUseCases(): Promise<AIUseCase[]> {
  const { data, error } = await supabase
    .from('ai_use_cases')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as AIUseCase[]
}

export async function createAIUseCase(
  params: Pick<AIUseCase, 'title' | 'description' | 'link' | 'status' | 'available_from'>
): Promise<AIUseCase> {
  const { data: maxData } = await supabase
    .from('ai_use_cases')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const sort_order = (maxData?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('ai_use_cases')
    .insert({ ...params, sort_order })
    .select()
    .single()
  if (error) throw error
  return data as AIUseCase
}

export async function updateAIUseCase(
  id: string,
  params: Partial<Pick<AIUseCase, 'title' | 'description' | 'link' | 'status' | 'available_from'>>
): Promise<void> {
  const { error } = await supabase
    .from('ai_use_cases')
    .update(params)
    .eq('id', id)
  if (error) throw error
}

export async function deleteAIUseCase(id: string): Promise<void> {
  const { error } = await supabase
    .from('ai_use_cases')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── AI Use Case ↔ Capability Links (with efficiency potential) ──────────

export async function loadAllUseCaseCapabilityLinks(): Promise<AIUseCaseCapability[]> {
  const { data, error } = await supabase
    .from('ai_use_case_capabilities')
    .select('*')
  if (error) throw error
  return (data ?? []) as AIUseCaseCapability[]
}

export async function saveUseCaseCapabilities(
  useCaseId: string,
  entries: { capability_id: string; efficiency_potential: number | null }[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('ai_use_case_capabilities')
    .delete()
    .eq('use_case_id', useCaseId)
  if (delError) throw delError

  if (entries.length > 0) {
    const rows = entries.map(e => ({ use_case_id: useCaseId, ...e }))
    const { error } = await supabase
      .from('ai_use_case_capabilities')
      .insert(rows)
    if (error) throw error
  }
}

// ─── AI Use Case ↔ Maturity Level Links ─────────────────────────────────

export async function loadAllUseCaseMaturityLinks(): Promise<AIUseCaseMaturityLevel[]> {
  const { data, error } = await supabase
    .from('ai_use_case_maturity_levels')
    .select('*')
  if (error) throw error
  return (data ?? []) as AIUseCaseMaturityLevel[]
}

export async function saveUseCaseMaturityLevels(useCaseId: string, maturityLevelIds: string[]): Promise<void> {
  const { error: delError } = await supabase
    .from('ai_use_case_maturity_levels')
    .delete()
    .eq('use_case_id', useCaseId)
  if (delError) throw delError

  if (maturityLevelIds.length > 0) {
    const rows = maturityLevelIds.map(maturity_level_id => ({ use_case_id: useCaseId, maturity_level_id }))
    const { error } = await supabase
      .from('ai_use_case_maturity_levels')
      .insert(rows)
    if (error) throw error
  }
}

// ─── AI Use Case Planning (pro ART + Use Case + Team) ───────────────────

export async function loadARTUseCases(artId: string): Promise<ARTUseCase[]> {
  const { data, error } = await supabase
    .from('art_ai_use_cases')
    .select('*')
    .eq('art_id', artId)
  if (error) throw error
  return (data ?? []) as ARTUseCase[]
}

export async function addUseCaseToART(artId: string, useCaseId: string, teamIds: string[]): Promise<void> {
  if (teamIds.length === 0) return
  const rows = teamIds.map(team_id => ({ art_id: artId, use_case_id: useCaseId, team_id, status: 'not_planned' as const }))
  const { error } = await supabase
    .from('art_ai_use_cases')
    .upsert(rows, { onConflict: 'art_id,use_case_id,team_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function removeUseCaseFromART(artId: string, useCaseId: string): Promise<void> {
  const { error } = await supabase
    .from('art_ai_use_cases')
    .delete()
    .eq('art_id', artId)
    .eq('use_case_id', useCaseId)
  if (error) throw error
}

export async function upsertARTUseCaseStatus(params: {
  art_id: string
  use_case_id: string
  team_id: string
  status: ARTUseCaseStatus
}): Promise<void> {
  const { error } = await supabase
    .from('art_ai_use_cases')
    .upsert(params, { onConflict: 'art_id,use_case_id,team_id' })
  if (error) throw error
}

// ─── AI Use Case Date Planning (pro ART + Use Case + Team + Capability) ──

export async function loadARTUseCaseDates(artId: string): Promise<ARTUseCaseDateRow[]> {
  const { data, error } = await supabase
    .from('art_ai_use_case_dates')
    .select('*')
    .eq('art_id', artId)
  if (error) throw error
  return (data ?? []) as ARTUseCaseDateRow[]
}

export async function upsertARTUseCaseDateRow(params: {
  art_id: string
  use_case_id: string
  team_id: string
  capability_id: string
  pilot_from: string | null
  rollout_from: string | null
  full_usage_from: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('art_ai_use_case_dates')
    .upsert(params, { onConflict: 'art_id,use_case_id,team_id,capability_id' })
  if (error) throw error
}

export async function deleteARTUseCaseDateRows(artId: string, useCaseId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('art_ai_use_case_dates')
    .delete()
    .eq('art_id', artId)
    .eq('use_case_id', useCaseId)
    .eq('team_id', teamId)
  if (error) throw error
}

// ─── ART Use Case Ratings (Nutzen / Skalierbarkeit / Akzeptanz) ───────────

export async function loadARTUseCaseRatings(artId: string): Promise<ARTUseCaseRating[]> {
  const { data, error } = await supabase
    .from('art_use_case_ratings')
    .select('*')
    .eq('art_id', artId)
  if (error) throw error
  return (data ?? []) as ARTUseCaseRating[]
}

export async function upsertARTUseCaseRating(params: {
  art_id: string
  use_case_id: string
  nutzen: number
  skalierbarkeit: number
  akzeptanz: number
}): Promise<void> {
  const { error } = await supabase
    .from('art_use_case_ratings')
    .upsert(params, { onConflict: 'art_id,use_case_id' })
  if (error) throw error
}
