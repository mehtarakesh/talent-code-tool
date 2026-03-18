export type InnovationFeature = {
  id: string
  name: string
  painPoint: string
  outcome: string
  implementation: string
}

export type ReleaseContract = {
  objective: string
  deliverables: string[]
  validations: string[]
  rollback: string[]
}

export type BlastRadius = {
  score: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  impactedAreas: string[]
  watchouts: string[]
  requiredChecks: string[]
  releaseBlockers: string[]
}

export const innovationFeatures: InnovationFeature[] = [
  {
    id: 'jury',
    name: 'Model Jury',
    painPoint: 'Teams waste time betting on one model without seeing disagreement or confidence gaps.',
    outcome: 'Run multiple models on the same task and inspect divergence before committing to a path.',
    implementation: 'A first-class jury route plus a workbench panel that compares ballots, latency, and synthesis.',
  },
  {
    id: 'blast-radius',
    name: 'Blast Radius Simulator',
    painPoint: 'Coding tools usually tell you what to change, not what else you might break.',
    outcome: 'Surface impacted subsystems, rollout risk, and validation hotspots before a patch starts.',
    implementation: 'Heuristic workspace analysis that maps prompts to risk zones, score, and watchouts.',
  },
  {
    id: 'release-contract',
    name: 'Release Contract Generator',
    painPoint: 'Teams lose release quality because acceptance criteria and rollback plans stay implicit.',
    outcome: 'Turn a prompt into a concrete contract with deliverables, validations, and rollback clauses.',
    implementation: 'Auto-generated contract cards built from prompt intent and workspace context.',
  },
  {
    id: 'mission-lock',
    name: 'Mission Lock',
    painPoint: 'The biggest hidden failure in AI coding is silent intent drift: the original non-negotiables disappear as soon as the workflow gets iterative.',
    outcome: 'Lock the north star, immutable constraints, non-goals, and proof requirements before generation so the system cannot quietly drift away from the real assignment.',
    implementation: 'A mission-lock engine that derives non-negotiables and proof requirements from the prompt, workspace, release contract, and blast radius.',
  },
  {
    id: 'proof-gate',
    name: 'Proof Gate',
    painPoint: 'Humans often accept polished answers that sound done even when no proof was provided.',
    outcome: 'Score whether the output is evidence-backed, flag unsupported completion claims, and show exactly what proof is still missing.',
    implementation: 'An output trust gate that compares generated answers against the locked mission and required proof requirements.',
  },
  {
    id: 'release-gate',
    name: 'Release Gate Preflight',
    painPoint: 'Most AI coding tools let risky runs start before teams know whether auth, context, or validation plans are actually ready.',
    outcome: 'Score readiness before generation, block unsafe runs, and recommend the next best action for high-risk work.',
    implementation: 'A preflight API and UI gate that evaluates provider readiness, workspace coverage, release risk, jury recommendations, and fallback playbooks.',
  },
  {
    id: 'hidden-pain',
    name: 'Hidden Pain Detector',
    painPoint: 'Humans often blame the model when the real issue is an unstated contradiction, a missing surface owner, or a release task with no proof expectations.',
    outcome: 'Expose invisible coordination costs, missing inputs, and contradiction-heavy prompts before they create bad output.',
    implementation: 'A hidden-pain analysis layer that scores operator burden and surfaces faultlines, invisible costs, and missing inputs in the workbench.',
  },
  {
    id: 'session-capsule',
    name: 'Session Capsule',
    painPoint: 'Switching between browser, editor, desktop, and CLI usually destroys momentum because the human has to rebuild context manually.',
    outcome: 'Carry the exact run state across surfaces as a portable capsule instead of re-explaining the task every time.',
    implementation: 'Base64-encoded portable session payloads that preserve provider, prompt, workspace context, gate status, and latest output.',
  },
  {
    id: 'continuity-vault',
    name: 'Continuity Vault',
    painPoint: 'People lose good runs to refreshes, crashes, tool switches, and broken checkpoint flows.',
    outcome: 'Keep automatic local snapshots of the workbench so strong runs can be restored without manual reconstruction.',
    implementation: 'A local snapshot vault that captures prompt, provider lane, gate state, and output preview for fast restore.',
  },
  {
    id: 'auto-heal',
    name: 'Auto-Heal Recovery Lanes',
    painPoint: 'Provider failures usually force the human to become the recovery orchestrator.',
    outcome: 'Prepare fallback execution lanes and recover from auth, network, missing-model, or compatibility failures with less manual intervention.',
    implementation: 'Recovery-lane planning in preflight plus sequential fallback attempts in the chat route when recoverable errors appear.',
  },
  {
    id: 'freshness-sentinel',
    name: 'Freshness Sentinel',
    painPoint: 'AI coding tools confidently recommend stale SDKs, outdated docs, and drifting API patterns when a request touches fast-moving dependencies.',
    outcome: 'Detect high-drift requests early and demand live proof or pinned versions before accepting generated recommendations.',
    implementation: 'A freshness analysis layer that scores stale-doc risk and asks for canonical docs, pinned versions, and maintenance signals.',
  },
  {
    id: 'ops-ledger',
    name: 'Ops Ledger',
    painPoint: 'When a provider fails, developers rarely get a structured next move.',
    outcome: 'Capture each run, error, and suggestion so the next retry is smarter instead of random.',
    implementation: 'Request history with provider, model, status, duration, and tailored remediation guidance.',
  },
  {
    id: 'ship-memo',
    name: 'Ship Memo Autowriter',
    painPoint: 'Public sharing stalls because docs, changelogs, and repo positioning are written last.',
    outcome: 'Generate a public-facing summary, proof points, and rollout note from the latest session.',
    implementation: 'Client-side memo synthesis from the latest output, contract, and blast radius signals.',
  },
]

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)))
}

function pickRiskLevel(score: number): BlastRadius['riskLevel'] {
  if (score >= 80) {
    return 'critical'
  }

  if (score >= 60) {
    return 'high'
  }

  if (score >= 40) {
    return 'medium'
  }

  return 'low'
}

export function buildReleaseContract(prompt: string, workspaceContext: string): ReleaseContract {
  const lowerPrompt = prompt.toLowerCase()
  const lowerWorkspace = workspaceContext.toLowerCase()

  const deliverables = unique([
    lowerPrompt.includes('ui') || lowerWorkspace.includes('web') ? 'Shippable interface updates with responsive states' : '',
    lowerPrompt.includes('api') || lowerWorkspace.includes('route') ? 'Updated API contract or route behavior' : '',
    lowerPrompt.includes('docs') || lowerWorkspace.includes('readme') ? 'Public-facing documentation refresh' : 'Reviewer-readable implementation summary',
    'Validation evidence for the affected surface',
  ])

  const validations = unique([
    lowerWorkspace.includes('web') ? 'Run web build and route smoke checks' : '',
    lowerWorkspace.includes('cli') ? 'Run CLI help and a live prompt smoke test' : '',
    lowerWorkspace.includes('desktop') ? 'Build desktop shell and verify packaging path' : '',
    lowerWorkspace.includes('vscode') ? 'Build and package the VS Code extension' : '',
    'Verify provider connectivity for the selected execution path',
  ])

  const rollback = unique([
    'Keep the previous provider preset available for fallback',
    'Preserve the prior public docs copy until the new flow is validated',
    lowerPrompt.includes('release') ? 'Block release if acceptance checks fail or the risk score stays high' : 'Revert the change set if smoke checks regress',
  ])

  return {
    objective: prompt.trim() || 'Ship a validated coding workflow improvement.',
    deliverables,
    validations,
    rollback,
  }
}

export function buildBlastRadius(prompt: string, workspaceContext: string): BlastRadius {
  const haystack = `${prompt} ${workspaceContext}`.toLowerCase()
  const impactedAreas = unique([
    haystack.includes('web') || haystack.includes('page') || haystack.includes('ui') ? 'Web app and public product pages' : '',
    haystack.includes('api') || haystack.includes('route') || haystack.includes('provider') ? 'Provider routes and backend request handling' : '',
    haystack.includes('cli') ? 'CLI behavior and shell workflows' : '',
    haystack.includes('desktop') ? 'Desktop packaging and local runtime' : '',
    haystack.includes('vscode') || haystack.includes('extension') ? 'VS Code extension commands and packaging' : '',
    haystack.includes('docs') || haystack.includes('readme') ? 'Docs, README, and public positioning' : '',
  ])

  const watchouts = unique([
    impactedAreas.includes('Provider routes and backend request handling') ? 'Cross-provider payload differences can create hidden runtime failures.' : '',
    impactedAreas.includes('Web app and public product pages') ? 'Marketing and app copy can drift if docs are not refreshed together.' : '',
    impactedAreas.includes('Desktop packaging and local runtime') ? 'Desktop packaging can fail on machine-specific signing or asset assumptions.' : '',
    impactedAreas.includes('VS Code extension commands and packaging') ? 'Extension commands need packaging verification, not just TypeScript compile success.' : '',
    impactedAreas.includes('CLI behavior and shell workflows') ? 'CLI changes need Windows and POSIX shell expectations checked separately.' : '',
    haystack.includes('auth') || haystack.includes('api key') ? 'Credential handling must avoid leaking secrets into logs, screenshots, or repo docs.' : '',
    haystack.includes('release') || haystack.includes('deploy') ? 'Release-facing changes need rollback language and proof before they are shared publicly.' : '',
  ])

  const requiredChecks = unique([
    impactedAreas.includes('Web app and public product pages') ? 'Run the web build and smoke-check the touched routes.' : '',
    impactedAreas.includes('Provider routes and backend request handling') ? 'Exercise provider routes with at least one local and one hosted-compatible payload.' : '',
    impactedAreas.includes('CLI behavior and shell workflows') ? 'Verify CLI argument parsing and one shell smoke test.' : '',
    impactedAreas.includes('Desktop packaging and local runtime') ? 'Compile the desktop runtime and verify the package target on the destination OS.' : '',
    impactedAreas.includes('VS Code extension commands and packaging') ? 'Build the extension and verify the command surface still registers correctly.' : '',
    impactedAreas.includes('Docs, README, and public positioning') ? 'Refresh docs and README copy so public claims match the current implementation.' : '',
  ])

  const releaseBlockers = unique([
    impactedAreas.length >= 4 ? 'This change touches multiple user-facing surfaces and needs an explicit release gate review.' : '',
    watchouts.length >= 4 ? 'The current plan has too many high-risk watchouts to ship without a model jury or staged validation.' : '',
    haystack.includes('enterprise') || haystack.includes('pricing') ? 'Enterprise or pricing changes need docs parity before release.' : '',
  ])

  const score = Math.min(98, 18 + impactedAreas.length * 12 + watchouts.length * 7 + releaseBlockers.length * 8)
  const riskLevel = pickRiskLevel(score)

  return {
    score,
    riskLevel,
    impactedAreas,
    watchouts,
    requiredChecks,
    releaseBlockers,
  }
}

export function buildShipMemo(
  prompt: string,
  provider: string,
  model: string,
  contract: ReleaseContract,
  blastRadius: BlastRadius,
  output?: string
) {
  return [
    `CodeOrbit AI shipped a ${provider}/${model} session focused on: ${prompt.trim() || 'release hardening'}.`,
    `Primary deliverables: ${contract.deliverables.slice(0, 3).join('; ')}.`,
    `Validation plan: ${contract.validations.slice(0, 3).join('; ')}.`,
    `Risk score: ${blastRadius.score}/100 (${blastRadius.riskLevel}) with impacted areas in ${blastRadius.impactedAreas.join(', ') || 'the active workspace'}.`,
    output ? `Latest model takeaway: ${output.slice(0, 220).replace(/\s+/g, ' ')}...` : 'Latest model takeaway will appear after the first run.',
  ].join('\n\n')
}

export function buildOpsSuggestion(error: string, provider: string, model: string) {
  const lowerError = error.toLowerCase()

  if (lowerError.includes('not found')) {
    return `The selected model \`${model}\` is missing. Retry with an installed model for ${provider} or update the preset before the next run.`
  }

  if (lowerError.includes('401') || lowerError.includes('403') || lowerError.includes('api key')) {
    return `Authentication failed for ${provider}. Rotate the credential, confirm the base URL, and rerun the provider health check.`
  }

  if (lowerError.includes('timeout') || lowerError.includes('network')) {
    return `This looks like a reachability issue. Switch to a local fallback or lower-latency provider before retrying.`
  }

  return `Retry with a safer fallback plan: verify provider reachability, reduce prompt scope, and compare against a second model through the jury flow.`
}
