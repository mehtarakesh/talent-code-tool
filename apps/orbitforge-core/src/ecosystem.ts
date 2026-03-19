export type OrbitForgeLifecycleStage =
  | 'intake'
  | 'context'
  | 'parallelize'
  | 'approval'
  | 'validation'
  | 'release'
  | 'publish'

export type OrbitForgePluginConfigField = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'toggle'
  description: string
  options?: string[]
}

export type OrbitForgePluginComponent = {
  pluginId: string
  componentId: string
  stage: OrbitForgeLifecycleStage
  title: string
  summary: string
  defaultLabel: string
  emits: string[]
  configFields: OrbitForgePluginConfigField[]
}

export type OrbitForgePluginManifest = {
  pluginId: string
  name: string
  version: string
  summary: string
  author: string
  homepage?: string
  components: OrbitForgePluginComponent[]
}

export type OrbitForgeLifecycleBlueprintNode = {
  nodeId: string
  componentId: string
  label?: string
  notes?: string
  config?: Record<string, string | boolean>
}

export type OrbitForgeLifecycleBlueprint = {
  blueprintId: string
  title: string
  summary: string
  goal: string
  nodes: OrbitForgeLifecycleBlueprintNode[]
}

export const orbitforgeLifecycleKit: OrbitForgePluginManifest = {
  pluginId: 'orbitforge.lifecycle-kit',
  name: 'OrbitForge Lifecycle Kit',
  version: '0.1.0',
  summary:
    'Built-in no-code lifecycle components for intake, context packing, parallel agents, approval gates, validation, and publishing.',
  author: 'OrbitForge',
  homepage: 'https://orbitforge.dev/ecosystem',
  components: [
    {
      pluginId: 'orbitforge.lifecycle-kit',
      componentId: 'mission-intake',
      stage: 'intake',
      title: 'Mission Intake',
      summary: 'Captures the objective, non-goals, deadline, and ownership before agents run.',
      defaultLabel: 'Mission Intake',
      emits: ['objective', 'constraints', 'owner'],
      configFields: [
        { key: 'owner', label: 'Owner', type: 'text', description: 'Human owner or accountable team.' },
        { key: 'deadline', label: 'Deadline', type: 'text', description: 'Optional deadline or launch milestone.' },
        { key: 'nonGoals', label: 'Non-goals', type: 'textarea', description: 'What the flow must not try to solve.' },
      ],
    },
    {
      pluginId: 'orbitforge.lifecycle-kit',
      componentId: 'context-pack',
      stage: 'context',
      title: 'Context Pack',
      summary: 'Bundles repo, spec, provider, and environment context into a reusable mission capsule.',
      defaultLabel: 'Context Pack',
      emits: ['contextCapsule'],
      configFields: [
        {
          key: 'sources',
          label: 'Sources',
          type: 'textarea',
          description: 'Docs, repos, or environment surfaces the agent must ground itself in.',
        },
      ],
    },
    {
      pluginId: 'orbitforge.lifecycle-kit',
      componentId: 'parallel-lanes',
      stage: 'parallelize',
      title: 'Parallel Lanes',
      summary: 'Runs architect, implementer, critic, or custom lanes in parallel.',
      defaultLabel: 'Parallel Lanes',
      emits: ['laneOutputs', 'missionBoard'],
      configFields: [
        {
          key: 'workflow',
          label: 'Workflow',
          type: 'select',
          description: 'Mission template that tunes the agent handoffs and approval gates.',
          options: ['general', 'review', 'migration', 'incident', 'release'],
        },
        {
          key: 'lanes',
          label: 'Lanes',
          type: 'text',
          description: 'Comma-separated lanes. Defaults to architect,implementer,critic.',
        },
      ],
    },
    {
      pluginId: 'orbitforge.lifecycle-kit',
      componentId: 'approval-gate',
      stage: 'approval',
      title: 'Approval Gate',
      summary: 'Stops the flow until a human accepts the plan, evidence, or risk threshold.',
      defaultLabel: 'Approval Gate',
      emits: ['approvalDecision'],
      configFields: [
        {
          key: 'criteria',
          label: 'Approval criteria',
          type: 'textarea',
          description: 'Conditions that must be met before the flow proceeds.',
        },
      ],
    },
    {
      pluginId: 'orbitforge.lifecycle-kit',
      componentId: 'validation-matrix',
      stage: 'validation',
      title: 'Validation Matrix',
      summary: 'Defines the proofs, commands, and checkpoints needed to call the mission complete.',
      defaultLabel: 'Validation Matrix',
      emits: ['validationPlan'],
      configFields: [
        {
          key: 'mustPass',
          label: 'Must-pass checks',
          type: 'textarea',
          description: 'Commands, screenshots, or tests that are required for completion.',
        },
      ],
    },
    {
      pluginId: 'orbitforge.lifecycle-kit',
      componentId: 'release-gate',
      stage: 'release',
      title: 'Release Gate',
      summary: 'Turns validation evidence into a ship / hold / rollback decision.',
      defaultLabel: 'Release Gate',
      emits: ['releaseDecision'],
      configFields: [
        {
          key: 'rollbackOwner',
          label: 'Rollback owner',
          type: 'text',
          description: 'Who acts if the release gate fails.',
        },
      ],
    },
    {
      pluginId: 'orbitforge.lifecycle-kit',
      componentId: 'publish-pack',
      stage: 'publish',
      title: 'Publish Pack',
      summary: 'Packages the mission board, evidence, and next prompts for handoff or sharing.',
      defaultLabel: 'Publish Pack',
      emits: ['publishBundle'],
      configFields: [
        {
          key: 'audience',
          label: 'Audience',
          type: 'select',
          description: 'Who the bundle is meant for.',
          options: ['team', 'customer', 'oss-community', 'release-managers'],
        },
      ],
    },
  ],
}

export const builtInPluginManifests = [orbitforgeLifecycleKit]

export const builtInLifecycleBlueprints: OrbitForgeLifecycleBlueprint[] = [
  {
    blueprintId: 'parallel-review-kit',
    title: 'Parallel Review Kit',
    summary: 'A review-first agent flow with evidence, approval, and publication stages.',
    goal: 'Review a risky change with parallel lanes and publish an evidence-backed decision.',
    nodes: [
      { nodeId: 'n1', componentId: 'mission-intake', label: 'Scope Intake', config: { owner: 'review lead' } },
      { nodeId: 'n2', componentId: 'context-pack', label: 'Diff Context Pack' },
      {
        nodeId: 'n3',
        componentId: 'parallel-lanes',
        label: 'Review Trio',
        config: { workflow: 'review', lanes: 'architect,implementer,critic' },
      },
      { nodeId: 'n4', componentId: 'approval-gate', label: 'Human Review Gate' },
      { nodeId: 'n5', componentId: 'validation-matrix', label: 'Evidence Checklist' },
      { nodeId: 'n6', componentId: 'publish-pack', label: 'PR Decision Pack', config: { audience: 'team' } },
    ],
  },
  {
    blueprintId: 'migration-flight-plan',
    title: 'Migration Flight Plan',
    summary: 'A phased migration flow with rollback checkpoints and release control.',
    goal: 'Plan and validate a long migration without losing rollout order or rollback readiness.',
    nodes: [
      { nodeId: 'n1', componentId: 'mission-intake', label: 'Migration Intake' },
      { nodeId: 'n2', componentId: 'context-pack', label: 'Compatibility Context' },
      {
        nodeId: 'n3',
        componentId: 'parallel-lanes',
        label: 'Migration Trio',
        config: { workflow: 'migration', lanes: 'architect,implementer,critic' },
      },
      { nodeId: 'n4', componentId: 'approval-gate', label: 'Cutover Approval' },
      { nodeId: 'n5', componentId: 'validation-matrix', label: 'Rollback Matrix' },
      { nodeId: 'n6', componentId: 'release-gate', label: 'Cutover Gate' },
      { nodeId: 'n7', componentId: 'publish-pack', label: 'Launch Bundle', config: { audience: 'release-managers' } },
    ],
  },
]

function buildComponentIndex(manifests: OrbitForgePluginManifest[]) {
  return manifests.reduce<Record<string, OrbitForgePluginComponent>>((records, manifest) => {
    for (const component of manifest.components) {
      records[component.componentId] = component
    }

    return records
  }, {})
}

export function validatePluginManifest(manifest: OrbitForgePluginManifest) {
  const issues: string[] = []
  const componentIds = new Set<string>()

  if (!manifest.pluginId.trim()) {
    issues.push('pluginId is required')
  }

  for (const component of manifest.components) {
    if (componentIds.has(component.componentId)) {
      issues.push(`duplicate componentId: ${component.componentId}`)
    }

    componentIds.add(component.componentId)
  }

  return issues
}

export function validateLifecycleBlueprint(
  blueprint: OrbitForgeLifecycleBlueprint,
  manifests = builtInPluginManifests
) {
  const issues: string[] = []
  const componentIndex = buildComponentIndex(manifests)

  if (!blueprint.title.trim()) {
    issues.push('blueprint title is required')
  }

  for (const node of blueprint.nodes) {
    if (!componentIndex[node.componentId]) {
      issues.push(`unknown component: ${node.componentId}`)
    }
  }

  return issues
}

export function listLifecycleComponents(manifests = builtInPluginManifests) {
  return manifests.flatMap((manifest) =>
    manifest.components.map((component) => ({
      pluginId: manifest.pluginId,
      componentId: component.componentId,
      stage: component.stage,
      title: component.title,
      summary: component.summary,
    }))
  )
}

export function compileLifecycleBlueprint(
  blueprint: OrbitForgeLifecycleBlueprint,
  manifests = builtInPluginManifests
) {
  const issues = validateLifecycleBlueprint(blueprint, manifests)
  const componentIndex = buildComponentIndex(manifests)

  const stagedNodes = blueprint.nodes.map((node) => {
    const component = componentIndex[node.componentId]

    return {
      nodeId: node.nodeId,
      label: node.label || component?.defaultLabel || node.componentId,
      stage: component?.stage || 'context',
      title: component?.title || node.componentId,
      summary: component?.summary || '',
      config: node.config || {},
      notes: node.notes || '',
    }
  })

  const stageSummary = stagedNodes
    .map((node, index) => `${index + 1}. [${node.stage}] ${node.label} -> ${node.title}`)
    .join('\n')

  const approvalGates = stagedNodes
    .filter((node) => node.stage === 'approval' || node.stage === 'release')
    .map((node) => `- ${node.label}: ${node.notes || node.summary}`)
    .join('\n')

  const validationTargets = stagedNodes
    .filter((node) => node.stage === 'validation')
    .map((node) => `- ${node.label}: ${node.notes || node.summary}`)
    .join('\n')

  const publishTargets = stagedNodes
    .filter((node) => node.stage === 'publish')
    .map((node) => `- ${node.label}: ${node.notes || node.summary}`)
    .join('\n')

  const markdown = `## Plugin Blueprint
Blueprint: ${blueprint.title}
Goal: ${blueprint.goal}
Summary: ${blueprint.summary}

Lifecycle stages:
${stageSummary || '- No stages configured.'}

Approval gates:
${approvalGates || '- No approval gates configured.'}

Validation targets:
${validationTargets || '- No validation targets configured.'}

Publish targets:
${publishTargets || '- No publish targets configured.'}${
    issues.length ? `\n\nBlueprint issues:\n- ${issues.join('\n- ')}` : ''
  }`.trim()

  return {
    issues,
    stagedNodes,
    markdown,
  }
}
