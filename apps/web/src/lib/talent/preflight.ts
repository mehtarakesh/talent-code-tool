import { buildHiddenPainAnalysis, buildRecoveryLanes, type HiddenPainAnalysis, type RecoveryLane } from '@/lib/talent/advanced'
import { buildFreshnessAssessment, type FreshnessAssessment } from '@/lib/talent/freshness'
import { buildBlastRadius, buildOpsSuggestion, buildReleaseContract, type BlastRadius, type ReleaseContract } from '@/lib/talent/innovation'
import { buildMissionLock, type MissionLock } from '@/lib/talent/mission-lock'
import { normalizeBaseUrl, type ProviderId } from '@/lib/talent/provider-client'

export type PreflightCheck = {
  id: string
  label: string
  status: 'ready' | 'warning' | 'blocked'
  detail: string
}

export type JuryRecommendation = {
  provider: ProviderId
  model: string
  baseUrl: string
  reason: string
}

export type PreflightAssessment = {
  gate: 'go' | 'needs-review' | 'blocked'
  readinessScore: number
  summary: string
  releaseContract: ReleaseContract
  blastRadius: BlastRadius
  missionLock: MissionLock
  freshness: FreshnessAssessment
  checks: PreflightCheck[]
  juryRecommendation: JuryRecommendation[]
  hiddenPainAnalysis: HiddenPainAnalysis
  recoveryPlan: RecoveryLane[]
  opsPlaybook: string[]
}

export type PreflightInput = {
  provider: ProviderId
  model: string
  baseUrl?: string
  apiKey?: string
  prompt: string
  workspaceContext?: string
}

const hostedProviders = new Set<ProviderId>(['openai', 'anthropic', 'openrouter'])
const localProviders = new Set<ProviderId>(['ollama', 'lmstudio', 'openai-compatible'])

function hasApiKey(input: PreflightInput) {
  if (input.apiKey?.trim()) {
    return true
  }

  switch (input.provider) {
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY)
    case 'openrouter':
      return Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)
    case 'openai-compatible':
      return Boolean(process.env.OPENAI_COMPATIBLE_API_KEY)
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY)
    default:
      return false
  }
}

function classifyCheckStatus(checks: PreflightCheck[]) {
  if (checks.some((check) => check.status === 'blocked')) {
    return 'blocked' as const
  }

  if (checks.some((check) => check.status === 'warning')) {
    return 'needs-review' as const
  }

  return 'go' as const
}

function buildChecks(input: PreflightInput, blastRadius: BlastRadius, normalizedBaseUrl: string): PreflightCheck[] {
  const workspaceContext = input.workspaceContext?.trim() || ''
  const checks: PreflightCheck[] = [
    {
      id: 'prompt',
      label: 'Prompt scope',
      status: input.prompt.trim() ? 'ready' : 'blocked',
      detail: input.prompt.trim() ? 'Prompt is populated and ready for analysis.' : 'A release preflight needs a non-empty prompt.',
    },
    {
      id: 'model',
      label: 'Model selection',
      status: input.model.trim() ? 'ready' : 'blocked',
      detail: input.model.trim() ? `Using model ${input.model}.` : 'A model must be selected before the run can proceed.',
    },
    {
      id: 'endpoint',
      label: 'Endpoint strategy',
      status: normalizedBaseUrl.startsWith('http') ? 'ready' : 'blocked',
      detail: normalizedBaseUrl.startsWith('http')
        ? `Requests will route to ${normalizedBaseUrl}.`
        : 'The provider base URL must be a valid http(s) endpoint.',
    },
    {
      id: 'auth',
      label: 'Credential readiness',
      status: hostedProviders.has(input.provider) && !hasApiKey(input) ? 'blocked' : 'ready',
      detail:
        hostedProviders.has(input.provider) && !hasApiKey(input)
          ? `The ${input.provider} provider needs an API key before the run can start.`
          : localProviders.has(input.provider)
            ? 'Local provider selected, so API credentials are optional.'
            : 'Hosted provider credentials are available.',
    },
    {
      id: 'workspace',
      label: 'Workspace context coverage',
      status: workspaceContext.length >= 40 ? 'ready' : 'warning',
      detail:
        workspaceContext.length >= 40
          ? 'Workspace context is detailed enough to generate deliverables and validations.'
          : 'Add a little more workspace context so the contract and blast radius are tied to real surfaces.',
    },
    {
      id: 'risk',
      label: 'Release risk',
      status: blastRadius.riskLevel === 'critical' ? 'blocked' : blastRadius.riskLevel === 'high' ? 'warning' : 'ready',
      detail:
        blastRadius.riskLevel === 'critical'
          ? 'The current prompt spans enough surfaces that a model run should pause until reviewers confirm the release gate.'
          : blastRadius.riskLevel === 'high'
            ? 'The plan is still runnable, but it should go through the jury flow and explicit validation before release.'
            : 'The current scope is acceptable for a standard guided run.',
    },
  ]

  return checks
}

function buildJuryRecommendation(input: PreflightInput, blastRadius: BlastRadius): JuryRecommendation[] {
  const primary: JuryRecommendation = {
    provider: input.provider,
    model: input.model,
    baseUrl: normalizeBaseUrl(input.provider, input.baseUrl),
    reason: 'Primary execution lane for the active run.',
  }

  const recommendations = [primary]

  if (blastRadius.riskLevel === 'high' || blastRadius.riskLevel === 'critical') {
    recommendations.push({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
      baseUrl: normalizeBaseUrl('ollama'),
      reason: 'Local fallback to compare implementation plans when the blast radius is elevated.',
    })
  }

  if (blastRadius.impactedAreas.includes('Provider routes and backend request handling')) {
    recommendations.push({
      provider: 'lmstudio',
      model: 'local-model',
      baseUrl: normalizeBaseUrl('lmstudio'),
      reason: 'OpenAI-compatible comparison to catch payload drift across providers.',
    })
  }

  return recommendations
}

function buildOpsPlaybook(input: PreflightInput, blastRadius: BlastRadius, checks: PreflightCheck[]) {
  const playbook = [
    buildOpsSuggestion('timeout', input.provider, input.model),
    buildOpsSuggestion('not found', input.provider, input.model),
  ]

  if (checks.some((check) => check.id === 'auth' && check.status === 'blocked')) {
    playbook.unshift(buildOpsSuggestion('api key missing', input.provider, input.model))
  }

  if (blastRadius.riskLevel === 'critical') {
    playbook.unshift('Pause the run, review the release contract, and shrink scope before retrying a model-generated patch.')
  }

  return playbook
}

export function buildPreflightAssessment(input: PreflightInput): PreflightAssessment {
  const normalizedBaseUrl = normalizeBaseUrl(input.provider, input.baseUrl)
  const releaseContract = buildReleaseContract(input.prompt, input.workspaceContext || '')
  const blastRadius = buildBlastRadius(input.prompt, input.workspaceContext || '')
  const missionLock = buildMissionLock(input.prompt, input.workspaceContext || '', releaseContract, blastRadius)
  const freshness = buildFreshnessAssessment(input.prompt, input.workspaceContext || '')
  const checks = buildChecks(input, blastRadius, normalizedBaseUrl)
  const gate = classifyCheckStatus(checks)
  const warningPenalty = checks.filter((check) => check.status === 'warning').length * 8
  const blockedPenalty = checks.filter((check) => check.status === 'blocked').length * 25
  const readinessScore = Math.max(0, Math.min(100, 100 - warningPenalty - blockedPenalty - Math.floor(blastRadius.score / 5)))
  const juryRecommendation = buildJuryRecommendation(input, blastRadius)
  const hiddenPainAnalysis = buildHiddenPainAnalysis({
    provider: input.provider,
    model: input.model,
    baseUrl: normalizedBaseUrl,
    prompt: input.prompt,
    workspaceContext: input.workspaceContext,
    checks,
    releaseContract,
    blastRadius,
  })
  const recoveryPlan = buildRecoveryLanes({
    provider: input.provider,
    model: input.model,
    baseUrl: normalizedBaseUrl,
    prompt: input.prompt,
    workspaceContext: input.workspaceContext,
    authBlocked: checks.some((check) => check.id === 'auth' && check.status === 'blocked'),
    blastRadius,
  })
  const opsPlaybook = buildOpsPlaybook(input, blastRadius, checks)

  const summary =
    gate === 'blocked'
      ? `Preflight blocked: resolve ${checks
          .filter((check) => check.status === 'blocked')
          .map((check) => check.label.toLowerCase())
          .join(', ')} before running ${input.provider}/${input.model}.`
      : gate === 'needs-review'
        ? `Preflight needs review: ${blastRadius.riskLevel} risk across ${blastRadius.impactedAreas.length || 1} surface(s). Run the jury and validations before release.`
        : `Preflight cleared: ${input.provider}/${input.model} is ready for a guided run with a ${blastRadius.riskLevel} blast radius.`

  return {
    gate,
    readinessScore,
    summary,
    releaseContract,
    blastRadius,
    missionLock,
    freshness,
    checks,
    juryRecommendation,
    hiddenPainAnalysis,
    recoveryPlan,
    opsPlaybook,
  }
}
