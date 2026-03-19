export type ProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'openrouter' | 'openai-compatible'

export type AgentMode = 'single' | 'parallel'
export type AgentWorkflow = 'general' | 'review' | 'migration' | 'incident' | 'release'

export type AgentRoleId = 'architect' | 'implementer' | 'critic'

export type OrbitForgeRequest = {
  provider: ProviderId
  model: string
  baseUrl: string
  apiKey?: string
  prompt: string
  workspaceContext?: string
  temperature?: number
  mode?: AgentMode
  workflow?: AgentWorkflow
  agents?: AgentRoleId[]
}

export type ProviderInvocation = {
  provider: ProviderId
  model: string
  baseUrl: string
  apiKey?: string
  temperature?: number
  systemPrompt: string
  userPrompt: string
}

export type OrbitForgeAgentResult = {
  id: AgentRoleId
  title: string
  focus: string
  status: 'success' | 'error'
  output: string
  durationMs: number
}

export type OrbitForgeRunResult = {
  mode: AgentMode
  workflow: AgentWorkflow
  provider: ProviderId
  model: string
  summary: string
  output: string
  missionBoard: string
  agents: OrbitForgeAgentResult[]
}

export type OrbitForgeRunOptions = {
  invoker?: (invocation: ProviderInvocation) => Promise<string>
}

type AgentDefinition = {
  id: AgentRoleId
  title: string
  focus: string
  systemPrompt: string
}

type WorkflowDefinition = {
  id: AgentWorkflow
  label: string
  headlinePain: string
  publicSignal: string
  useCases: string[]
  approvalGates: string[]
  handoffs: string[]
  synthesisDirective: string
  agentFocus: Record<AgentRoleId, string>
}

export const defaultSystemPrompt = `You are OrbitForge, a release-ready software engineer.
Always return:
1. A concise plan.
2. The implementation approach.
3. Validation steps.
4. Remaining risks.`

const synthesisSystemPrompt = `You are OrbitForge Synthesizer.
You merge multiple coding-agent lanes into one decisive answer.
Always return:
1. The converged implementation path.
2. Validation steps that should actually be run.
3. Risks and disagreements that still need a human decision.`

export const defaultParallelAgents: AgentRoleId[] = ['architect', 'implementer', 'critic']
export const defaultWorkflow: AgentWorkflow = 'general'

export const providerDefaults: Record<ProviderId, { baseUrl: string; model: string }> = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'deepseek-coder:33b' },
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'deepseek-coder' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4' },
  'openai-compatible': { baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
}

export function getProviderDefaults(provider: ProviderId) {
  return providerDefaults[provider]
}

const agentDefinitions: Record<AgentRoleId, AgentDefinition> = {
  architect: {
    id: 'architect',
    title: 'Architect',
    focus: 'Decompose the work, identify impacted surfaces, and recommend execution order.',
    systemPrompt: `You are OrbitForge Architect.
Focus on decomposition, affected files, rollout order, migration concerns, and hidden coupling.
Return:
1. The shape of the solution.
2. The main files or modules likely involved.
3. The safest execution order.
4. Structural risks.`,
  },
  implementer: {
    id: 'implementer',
    title: 'Implementer',
    focus: 'Propose the concrete patch plan, APIs, commands, and edge-case handling.',
    systemPrompt: `You are OrbitForge Implementer.
Focus on the actual patch strategy, code paths, request shapes, validation commands, and platform caveats.
Return:
1. The concrete implementation approach.
2. The code-level or config-level changes.
3. Validation commands or checks.
4. Delivery risks.`,
  },
  critic: {
    id: 'critic',
    title: 'Critic',
    focus: 'Challenge assumptions, spot regressions, and surface missing proof.',
    systemPrompt: `You are OrbitForge Critic.
Focus on what could break, what has not been proven, what is missing from validation, and where the plan is overconfident.
Return:
1. The weakest assumptions.
2. Missing tests or proof.
3. Likely regressions.
4. What a human should double-check before shipping.`,
  },
}

const workflowDefinitions: Record<AgentWorkflow, WorkflowDefinition> = {
  general: {
    id: 'general',
    label: 'General Build',
    headlinePain:
      'Complex implementation work often gets forced through one overconfident answer path with weak task ownership.',
    publicSignal:
      'Agent-team docs and community discussion keep stressing parallel work, plan approval, and task coordination for non-trivial engineering work.',
    useCases: [
      'cross-surface feature work',
      'provider integrations',
      'shared-runtime refactors',
      'multi-step implementation planning',
    ],
    approvalGates: [
      'Confirm the main affected surfaces before editing.',
      'Confirm the validation commands before calling the work ready.',
      'Escalate any unresolved disagreement between lanes to a human decision.',
    ],
    handoffs: [
      'Architect -> Implementer: translate surface map into the safest execution order.',
      'Implementer -> Critic: pass concrete patch steps and validation commands for challenge.',
      'Critic -> Human: surface unresolved risks or proof gaps before shipping.',
    ],
    synthesisDirective:
      'Converge the lanes into one build plan with the safest implementation order, validation, and explicit remaining risks.',
    agentFocus: {
      architect: 'Prioritize decomposition, sequencing, and cross-surface coupling.',
      implementer: 'Prioritize concrete patch mechanics, affected files, and validation commands.',
      critic: 'Prioritize hidden regressions, missing proof, and overconfident assumptions.',
    },
  },
  review: {
    id: 'review',
    label: 'Parallel Review',
    headlinePain:
      'Teams increasingly use coding agents, but still struggle to trust one-shot reviews that do not map findings, evidence, and severity clearly.',
    publicSignal:
      'Public agent-team docs explicitly call out parallel code review as a prime use case, and community posts keep highlighting trust and review quality as the bottleneck.',
    useCases: [
      'PR review',
      'pre-merge regression checks',
      'security-sensitive change review',
      'missing-test detection',
    ],
    approvalGates: [
      'List findings with evidence before proposing fixes.',
      'Separate probable regressions from speculation.',
      'Require an explicit proof gap section before approval.',
    ],
    handoffs: [
      'Architect -> Implementer: map changed surfaces and behavioral blast radius.',
      'Implementer -> Critic: hand off candidate fixes and the tests they rely on.',
      'Critic -> Human: promote only evidence-backed findings to merge blockers.',
    ],
    synthesisDirective:
      'Produce a review brief with the most credible findings first, then validation steps, then unresolved open questions.',
    agentFocus: {
      architect: 'Map the changed surfaces, dependencies, and behavioral blast radius.',
      implementer: 'Propose the most likely fixes, validation steps, and missing tests.',
      critic: 'Pressure-test every finding for evidence, severity, and false positives.',
    },
  },
  migration: {
    id: 'migration',
    label: 'Migration Flight Plan',
    headlinePain:
      'Long migrations fail when ownership, rollout order, and rollback points are not explicit, especially once context drifts over multiple sessions.',
    publicSignal:
      'Official multi-agent docs emphasize coordination and task assignment, while user discussion keeps pointing to context drift on longer-running engineering efforts.',
    useCases: [
      'framework migration',
      'provider migration',
      'runtime extraction',
      'large refactor with phased rollout',
    ],
    approvalGates: [
      'Define migration phases before touching implementation details.',
      'Call out rollback or compatibility strategy for each phase.',
      'Confirm the migration exit criteria and smoke tests.',
    ],
    handoffs: [
      'Architect -> Implementer: turn the phase map into atomic change sets.',
      'Implementer -> Critic: provide rollback paths and compatibility assumptions.',
      'Critic -> Human: flag phases that still have no safe rollback or proof.',
    ],
    synthesisDirective:
      'Deliver a phased migration plan with rollout order, rollback notes, validation gates, and a final cutover recommendation.',
    agentFocus: {
      architect: 'Prioritize phase boundaries, blast radius, and sequencing.',
      implementer: 'Prioritize concrete migration steps, compatibility shims, and command-level validation.',
      critic: 'Prioritize rollback gaps, cutover risk, and unproven compatibility claims.',
    },
  },
  incident: {
    id: 'incident',
    label: 'Incident Command',
    headlinePain:
      'Agentic tooling often jumps to a fix before the team has separated containment, root-cause hypotheses, and rollback options.',
    publicSignal:
      'Multi-agent docs highlight competing hypotheses as a key use case, which mirrors how teams debug high-pressure incidents in practice.',
    useCases: [
      'production regression triage',
      'provider outage diagnosis',
      'failed rollout investigation',
      'performance incident response',
    ],
    approvalGates: [
      'Identify containment steps before permanent fixes.',
      'Keep hypotheses separate from confirmed facts.',
      'Require a human checkpoint before any risky remediation path.',
    ],
    handoffs: [
      'Architect -> Implementer: define containment order and likely affected systems.',
      'Implementer -> Critic: hand over proposed remediation and rollback commands.',
      'Critic -> Human: separate proven signals from attractive but unsupported hypotheses.',
    ],
    synthesisDirective:
      'Return an incident command brief with containment, competing hypotheses, validation checks, and go/no-go advice for remediation.',
    agentFocus: {
      architect: 'Prioritize containment order, impacted systems, and diagnostic branching.',
      implementer: 'Prioritize executable remediation steps, rollback commands, and observability checks.',
      critic: 'Prioritize hypothesis quality, evidence gaps, and risky remediation paths.',
    },
  },
  release: {
    id: 'release',
    label: 'Release Gate',
    headlinePain:
      'AI-generated release plans often skip explicit approval gates, leading teams to confuse polished wording with actual ship readiness.',
    publicSignal:
      'Agent-team and workflow docs keep emphasizing plan approval and quality gates, which matches repeated complaints about agents saying “done” too early.',
    useCases: [
      'pre-release hardening',
      'cross-platform packaging review',
      'go/no-go decisions',
      'final validation checklist generation',
    ],
    approvalGates: [
      'State the ship criteria before declaring readiness.',
      'List the must-run validations, not just recommended ones.',
      'Surface rollback conditions and hold criteria explicitly.',
    ],
    handoffs: [
      'Architect -> Implementer: convert release scope into a concrete validation map.',
      'Implementer -> Critic: hand over the release checklist and evidence expectations.',
      'Critic -> Human: make the go/no-go blockers impossible to miss.',
    ],
    synthesisDirective:
      'Return a release decision brief with must-pass validations, hold criteria, and the final go/no-go recommendation.',
    agentFocus: {
      architect: 'Prioritize release scope, platform coverage, and validation order.',
      implementer: 'Prioritize concrete validation commands, packaging checks, and rollout mechanics.',
      critic: 'Prioritize missing proof, hold criteria, and rollback readiness.',
    },
  },
}

function getWorkspaceContextBlock(workspaceContext?: string) {
  return workspaceContext?.trim() ? workspaceContext.trim() : 'Not provided.'
}

function getWorkflowDefinition(workflow?: AgentWorkflow) {
  return workflowDefinitions[workflow || defaultWorkflow]
}

function buildUserPrompt(task: string, workspaceContext?: string, focus?: string, workflow?: AgentWorkflow) {
  const workflowDefinition = getWorkflowDefinition(workflow)

  return `Workflow:\n${workflowDefinition.label}\n\nPrimary pain point:\n${workflowDefinition.headlinePain}\n\nPublic signal:\n${workflowDefinition.publicSignal}\n\nBest-fit use cases:\n- ${workflowDefinition.useCases.join(
    '\n- '
  )}\n\nWorkspace context:\n${getWorkspaceContextBlock(workspaceContext)}\n\nTask:\n${task.trim()}${
    focus ? `\n\nRole focus:\n${focus}` : ''
  }`
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, '')
}

async function readJson(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Unexpected response: ${text.slice(0, 400)}`)
  }
}

function resolveApiKey(provider: ProviderId, explicitApiKey?: string) {
  if (explicitApiKey) {
    return explicitApiKey
  }

  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY || ''
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || ''
    case 'openai-compatible':
      return process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY || ''
    case 'openai':
      return process.env.OPENAI_API_KEY || ''
    case 'ollama':
    case 'lmstudio':
    default:
      return ''
  }
}

export async function invokeProvider(invocation: ProviderInvocation) {
  const baseUrl = normalizeBaseUrl(invocation.baseUrl)

  if (invocation.provider === 'anthropic') {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': resolveApiKey('anthropic', invocation.apiKey),
      },
      body: JSON.stringify({
        model: invocation.model,
        max_tokens: 2400,
        temperature: invocation.temperature ?? 0.2,
        system: invocation.systemPrompt,
        messages: [{ role: 'user', content: invocation.userPrompt }],
      }),
    })

    const payload = await readJson(response)

    if (!response.ok) {
      throw new Error(payload.error?.message || payload.error?.type || 'Anthropic request failed')
    }

    return payload.content?.map((entry: { text?: string }) => entry.text || '').join('\n') || ''
  }

  if (invocation.provider === 'ollama') {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: invocation.model,
        stream: false,
        options: {
          temperature: invocation.temperature ?? 0.2,
        },
        messages: [
          { role: 'system', content: invocation.systemPrompt },
          { role: 'user', content: invocation.userPrompt },
        ],
      }),
    })

    const payload = await readJson(response)

    if (!response.ok) {
      throw new Error(payload.error || 'Ollama request failed')
    }

    return payload.message?.content || ''
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolveApiKey(invocation.provider, invocation.apiKey)
        ? { Authorization: `Bearer ${resolveApiKey(invocation.provider, invocation.apiKey)}` }
        : {}),
    },
    body: JSON.stringify({
      model: invocation.model,
      temperature: invocation.temperature ?? 0.2,
      messages: [
        { role: 'system', content: invocation.systemPrompt },
        { role: 'user', content: invocation.userPrompt },
      ],
    }),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.error || 'Provider request failed')
  }

  return payload.choices?.[0]?.message?.content || ''
}

function sanitizeAgents(requestedAgents?: AgentRoleId[]) {
  const source = requestedAgents?.length ? requestedAgents : defaultParallelAgents
  const deduped = Array.from(new Set(source.filter((agentId) => agentDefinitions[agentId])))
  return deduped.length ? deduped : defaultParallelAgents
}

function getInvoker(options?: OrbitForgeRunOptions) {
  return options?.invoker || invokeProvider
}

function getAgentFocus(agentId: AgentRoleId, workflow?: AgentWorkflow) {
  const workflowDefinition = getWorkflowDefinition(workflow)
  return `${agentDefinitions[agentId].focus} ${workflowDefinition.agentFocus[agentId]}`.trim()
}

function getAgentSystemPrompt(agentId: AgentRoleId, workflow?: AgentWorkflow) {
  const workflowDefinition = getWorkflowDefinition(workflow)
  return `${agentDefinitions[agentId].systemPrompt}\n\nWorkflow emphasis: ${workflowDefinition.agentFocus[agentId]}`
}

function buildSynthesisPrompt(request: OrbitForgeRequest, agentResults: OrbitForgeAgentResult[]) {
  const workflowDefinition = getWorkflowDefinition(request.workflow)
  const lanes = agentResults
    .filter((entry) => entry.status === 'success')
    .map(
      (entry) =>
        `### ${entry.title}\nFocus: ${entry.focus}\n\n${entry.output.trim()}`
    )
    .join('\n\n')

  return `Workflow:\n${workflowDefinition.label}\n\nPrimary pain point:\n${workflowDefinition.headlinePain}\n\nSynthesis directive:\n${workflowDefinition.synthesisDirective}\n\nTask:\n${request.prompt.trim()}\n\nWorkspace context:\n${getWorkspaceContextBlock(
    request.workspaceContext
  )}\n\nAgent lanes:\n${lanes}`
}

function buildMissionBoard(request: OrbitForgeRequest, selectedAgents: AgentRoleId[]) {
  const workflowDefinition = getWorkflowDefinition(request.workflow)
  const approvalGates = workflowDefinition.approvalGates
    .map((entry, index) => `${index + 1}. ${entry}`)
    .join('\n')
  const handoffs = workflowDefinition.handoffs
    .map((entry, index) => `${index + 1}. ${entry}`)
    .join('\n')
  const followUpPrompts = selectedAgents
    .map((agentId) => {
      const title = agentDefinitions[agentId].title
      const followUp = `As ${title}, continue the ${workflowDefinition.label.toLowerCase()} for: ${
        request.prompt
      }. Focus on ${getAgentFocus(agentId, request.workflow).toLowerCase()}`
      return `- ${title}: ${followUp}`
    })
    .join('\n')

  const laneAssignments = selectedAgents
    .map((agentId) => `- ${agentDefinitions[agentId].title}: ${getAgentFocus(agentId, request.workflow)}`)
    .join('\n')

  return `## Mission Board
Workflow: ${workflowDefinition.label}
Objective: ${request.prompt.trim()}
Primary pain point: ${workflowDefinition.headlinePain}

Best-fit use cases:
- ${workflowDefinition.useCases.join('\n- ')}

Lane assignments:
${laneAssignments}

Approval gates:
${approvalGates}

Handoff plan:
${handoffs}

Next prompts:
${followUpPrompts}`.trim()
}

function formatSingleOutput(request: OrbitForgeRequest, output: string, missionBoard: string) {
  return `# OrbitForge Single Agent Run
Mode: single
Workflow: ${getWorkflowDefinition(request.workflow).label}
Provider: ${request.provider}
Model: ${request.model}

${missionBoard}

## Single-Agent Recommendation
${output.trim()}`.trim()
}

function formatParallelOutput(
  request: OrbitForgeRequest,
  agentResults: OrbitForgeAgentResult[],
  missionBoard: string,
  synthesisOutput?: string
) {
  const metadata = `Mode: parallel\nWorkflow: ${getWorkflowDefinition(request.workflow).label}\nProvider: ${request.provider}\nModel: ${request.model}\nAgents: ${agentResults
    .map((entry) => entry.title)
    .join(', ')}`

  const sections = agentResults
    .map((entry) => {
      const heading = `## ${entry.title} ${entry.status === 'success' ? 'Lane' : 'Lane Error'}`
      const meta = `Focus: ${entry.focus}\nDuration: ${entry.durationMs}ms`
      return `${heading}\n${meta}\n\n${entry.output.trim()}`
    })
    .join('\n\n')

  const convergence = synthesisOutput?.trim()
    ? `## Converged Recommendation\n${synthesisOutput.trim()}\n\n`
    : ''

  return `# OrbitForge Parallel Agent Run\n${metadata}\n\n${missionBoard}\n\n${convergence}${sections}`.trim()
}

function buildSummary(mode: AgentMode, agentResults: OrbitForgeAgentResult[], synthesisOutput?: string) {
  if (mode === 'single') {
    return 'Single agent run completed with a mission board.'
  }

  const successCount = agentResults.filter((entry) => entry.status === 'success').length
  return synthesisOutput?.trim()
    ? `${successCount}/${agentResults.length} agent lanes completed and converged.`
    : `${successCount}/${agentResults.length} agent lanes completed.`
}

async function runSingleAgent(request: OrbitForgeRequest, options?: OrbitForgeRunOptions): Promise<OrbitForgeRunResult> {
  const missionBoard = buildMissionBoard(request, defaultParallelAgents)
  const output = await getInvoker(options)({
    provider: request.provider,
    model: request.model,
    baseUrl: request.baseUrl,
    apiKey: request.apiKey,
    temperature: request.temperature,
    systemPrompt: defaultSystemPrompt,
    userPrompt: buildUserPrompt(request.prompt, request.workspaceContext, undefined, request.workflow),
  })

  return {
    mode: 'single',
    workflow: request.workflow || defaultWorkflow,
    provider: request.provider,
    model: request.model,
    summary: buildSummary('single', []),
    output: formatSingleOutput(request, output, missionBoard),
    missionBoard,
    agents: [],
  }
}

async function runParallelAgents(request: OrbitForgeRequest, options?: OrbitForgeRunOptions): Promise<OrbitForgeRunResult> {
  const invoker = getInvoker(options)
  const selectedAgents = sanitizeAgents(request.agents)
  const missionBoard = buildMissionBoard(request, selectedAgents)

  const agentResults = await Promise.all(
    selectedAgents.map(async (agentId) => {
      const agent = agentDefinitions[agentId]
      const startedAt = Date.now()

      try {
        const output = await invoker({
          provider: request.provider,
          model: request.model,
          baseUrl: request.baseUrl,
          apiKey: request.apiKey,
          temperature: request.temperature,
          systemPrompt: getAgentSystemPrompt(agentId, request.workflow),
          userPrompt: buildUserPrompt(request.prompt, request.workspaceContext, getAgentFocus(agentId, request.workflow), request.workflow),
        })

        return {
          id: agent.id,
          title: agent.title,
          focus: agent.focus,
          status: 'success' as const,
          output,
          durationMs: Date.now() - startedAt,
        }
      } catch (error) {
        return {
          id: agent.id,
          title: agent.title,
          focus: agent.focus,
          status: 'error' as const,
          output: error instanceof Error ? error.message : 'Parallel agent lane failed.',
          durationMs: Date.now() - startedAt,
        }
      }
    })
  )

  const successfulResults = agentResults.filter((entry) => entry.status === 'success')
  let synthesisOutput = ''

  if (successfulResults.length >= 2) {
    try {
      synthesisOutput = await invoker({
        provider: request.provider,
        model: request.model,
        baseUrl: request.baseUrl,
        apiKey: request.apiKey,
        temperature: request.temperature,
        systemPrompt: synthesisSystemPrompt,
        userPrompt: buildSynthesisPrompt(request, successfulResults),
      })
    } catch {
      synthesisOutput = ''
    }
  }

  return {
    mode: 'parallel',
    workflow: request.workflow || defaultWorkflow,
    provider: request.provider,
    model: request.model,
    summary: buildSummary('parallel', agentResults, synthesisOutput),
    output: formatParallelOutput(request, agentResults, missionBoard, synthesisOutput),
    missionBoard,
    agents: agentResults,
  }
}

export async function runOrbitForgeTask(request: OrbitForgeRequest, options?: OrbitForgeRunOptions) {
  if ((request.mode || 'single') === 'parallel') {
    return runParallelAgents(request, options)
  }

  return runSingleAgent(request, options)
}

export function parseAgentIds(input?: string) {
  if (!input?.trim()) {
    return undefined
  }

  const parsed = input
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean) as AgentRoleId[]

  return sanitizeAgents(parsed)
}

export function parseWorkflow(input?: string): AgentWorkflow | undefined {
  if (!input?.trim()) {
    return undefined
  }

  const normalized = input.trim().toLowerCase() as AgentWorkflow
  return workflowDefinitions[normalized] ? normalized : undefined
}
