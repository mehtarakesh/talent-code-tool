export type FreshnessSignal = {
  type: 'library' | 'api' | 'provider' | 'deployment'
  subject: string
  risk: 'warning' | 'critical'
  detail: string
}

export type FreshnessAssessment = {
  freshnessScore: number
  status: 'stable' | 'verify-live' | 'high-drift-risk'
  subjects: string[]
  signals: FreshnessSignal[]
  liveProofRequests: string[]
  suggestedArtifacts: string[]
}

const watchedSubjects = [
  'stripe',
  'supabase',
  'firebase',
  'clerk',
  'prisma',
  'vercel',
  'next.js',
  'react',
  'tailwind',
  'openai',
  'anthropic',
  'openrouter',
  'ollama',
  'lm studio',
  'docker',
  'kubernetes',
  'aws',
  'gcp',
  'azure',
]

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)))
}

function detectedSubjects(haystack: string) {
  return watchedSubjects.filter((subject) => haystack.includes(subject))
}

export function buildFreshnessAssessment(prompt: string, workspaceContext: string) {
  const haystack = `${prompt} ${workspaceContext}`.toLowerCase()
  const subjects = detectedSubjects(haystack)
  const mentionsRecommendation = /(recommend|best|latest|modern|current|choose|which package|which library)/.test(haystack)
  const mentionsIntegration = /(integrat|sdk|api version|package|dependency|deploy|provider|auth|billing)/.test(haystack)
  const mentionsVersion = /\bv?\d+\.\d+|\bversion\b|\bpinned\b|\bapi version\b/.test(haystack)

  const signals: FreshnessSignal[] = unique([
    subjects.length && !mentionsVersion
      ? 'critical|provider|No version pinning is mentioned, so the model can easily recommend stale patterns for moving APIs.'
      : '',
    mentionsRecommendation && !subjects.length
      ? 'warning|library|The prompt asks for a recommendation without naming current constraints or reference candidates.'
      : '',
    /(stripe|openai|anthropic|firebase|supabase|clerk|vercel)/.test(haystack) && !mentionsVersion
      ? 'critical|api|This request touches APIs that change quickly; use live documentation or pinned versions before trusting generated code.'
      : '',
    /(deploy|production|release|launch)/.test(haystack) && /(aws|gcp|azure|vercel|docker|kubernetes)/.test(haystack)
      ? 'warning|deployment|Deployment surfaces change often and should be verified against live docs or pinned platform versions.'
      : '',
  ]).map((entry) => {
    const [risk, type, detail] = entry.split('|')
    const subject = subjects[0] || 'external dependency'
    return {
      type: type as FreshnessSignal['type'],
      subject,
      risk: risk as FreshnessSignal['risk'],
      detail,
    }
  })

  const liveProofRequests = unique([
    subjects.length ? `Attach or verify the canonical docs page for: ${subjects.join(', ')}.` : '',
    mentionsRecommendation ? 'Verify maintainer activity, current version, and compatibility before accepting a recommendation.' : '',
    mentionsIntegration ? 'Pin the library or API version that the generated code must target.' : '',
  ])

  const suggestedArtifacts = unique([
    subjects.length ? 'Pinned versions in repo instructions or workspace rules' : '',
    mentionsIntegration ? 'Canonical SDK/API docs URL' : '',
    mentionsRecommendation ? 'Maintenance/activity signal for the recommended package' : '',
  ])

  const freshnessScore = Math.max(0, Math.min(100, 94 - signals.length * 18 - (subjects.length && !mentionsVersion ? 14 : 0)))
  const status = signals.some((signal) => signal.risk === 'critical')
    ? 'high-drift-risk'
    : signals.length
      ? 'verify-live'
      : 'stable'

  return {
    freshnessScore,
    status,
    subjects,
    signals,
    liveProofRequests,
    suggestedArtifacts,
  } satisfies FreshnessAssessment
}
