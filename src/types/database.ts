export type BusinessDivision = {
  id: string
  title: string
  description: string | null
  created_at: string
}

export type Organization = {
  id: string
  name: string
  description: string | null
  business_division_id: string | null
  created_at: string
}

export type CyberCriticality = 'Hoch' | 'Mittel' | 'Tief'

export type ART = {
  id: string
  org_id: string
  name: string
  description: string | null
  edit_token: string
  readonly_token: string
  mission_statement: string | null
  business_context: string | null
  risks: string | null
  budget_2027: number | null
  guidance_mode_id: string | null
  art_leadership: string | null
  responsible_person: string | null
  cyber_criticality: CyberCriticality | null
  cyber_criticality_reason: string | null
  guidance_mode_reason: string | null
  current_maturity_level_id: string | null
  planned_approach: string | null
  created_at: string
}

export type GuidanceMode = {
  id: string
  letter: string
  title: string
  description: string | null
  sort_order: number
  created_at: string
}

export type EmployeeRole = {
  id: string
  name: string
  sort_order: number
  created_at: string
}

export type BizDevOpsCapability = {
  id: string
  name: string
  color: string | null
  sort_order: number
  created_at: string
}

export type PlanVersionStatus = 'draft' | 'checked_in'

export type PlanVersion = {
  id: string
  art_id: string
  version_number: number
  status: PlanVersionStatus
  change_description: string | null
  snapshot: any | null
  created_at: string
  checked_in_at: string | null
}

export type Team = {
  id: string
  art_id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
}

export type InternExtern = 'intern' | 'extern'
export type BusinessIT = 'business' | 'it'

export type TeamMember = {
  id: string
  team_id: string
  role_id: string
  type: InternExtern
  category: BusinessIT
  fte: number
  headcount: number
  created_at: string
}

export type TeamCapabilityAllocation = {
  id: string
  team_id: string
  capability_id: string
  percentage: number
}

export type MaturityLevel = {
  id: string
  code: string
  title: string
  description: string | null
  created_at: string
}

export type AIUseCaseStatus = 'In Backlog' | 'In Lösungsexploration' | 'In Entwicklung' | 'Im Rollout' | 'In Betrieb' | 'Abgebrochen'

export type AIUseCase = {
  id: string
  title: string
  description: string | null
  link: string | null
  status: AIUseCaseStatus | null
  available_from: string | null
  sort_order: number
  created_at: string
}

export type AIUseCaseCapability = {
  id: string
  use_case_id: string
  capability_id: string
  efficiency_potential: number | null
}

export type AIUseCaseMaturityLevel = {
  id: string
  use_case_id: string
  maturity_level_id: string
}

export type ARTUseCaseStatus = 'planned' | 'not_planned' | 'not_needed'

export type ARTUseCase = {
  id: string
  art_id: string
  use_case_id: string
  team_id: string
  status: ARTUseCaseStatus
  created_at: string
}

export type ARTUseCaseDateRow = {
  id: string
  art_id: string
  use_case_id: string
  team_id: string
  capability_id: string
  pilot_from: string | null
  rollout_from: string | null
  full_usage_from: string | null
  created_at: string
}

export type ARTUseCaseRating = {
  id: string
  art_id: string
  use_case_id: string
  nutzen: number
  skalierbarkeit: number
  akzeptanz: number
  created_at: string
}
