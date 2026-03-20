import * as vscode from 'vscode'
import {
  builtInLifecycleBlueprints,
  runOrbitForgeTask,
  type AgentMode,
  type AgentLaneId,
  type AgentWorkflow,
  type OrbitForgeLifecycleBlueprint,
  type OrbitForgeRunResult,
  type ProviderId,
} from 'orbitforge-core'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import {
  renderMissionOutput,
  type MissionCodeBlock,
  type MissionHeading,
} from './mission-renderer'

const execAsync = promisify(exec)

type TalentSettings = {
  provider: ProviderId
  baseUrl: string
  model: string
  apiKey: string
  agentMode: AgentMode
  workflow: AgentWorkflow
  stream: boolean
}

type ResolvedTalentSettings = TalentSettings & {
  runtimeNote?: string
}

type ContextScope = 'workspace' | 'selection' | 'workspace+selection'

type PanelContextSnapshot = {
  provider: ProviderId
  model: string
  baseUrl: string
  workspaceFolders: string[]
  workspaceFileCount: number
  activeFile: string
  hasSelection: boolean
}

type RuntimePanelState = {
  provider: ProviderId
  baseUrl: string
  model: string
  configuredModel: string
  availableModels: string[]
  runtimeNote?: string
}

type PromptPreset = {
  id: string
  label: string
  summary: string
  prompt: string
  mode: AgentMode
  workflow: AgentWorkflow
  contextScope: ContextScope
}

type MissionHistoryEntry = {
  id: string
  title: string
  prompt: string
  mode: AgentMode
  workflow: AgentWorkflow
  contextScope: ContextScope
  provider: ProviderId
  model: string
  source: string
  createdAt: string
  summary: string
  blueprintId?: string
  blueprint?: OrbitForgeLifecycleBlueprint
}

type ExecuteMissionOptions = {
  title: string
  prompt: string
  mode: AgentMode
  workflow: AgentWorkflow
  contextScope: ContextScope
  extensionContext: vscode.ExtensionContext
  blueprint?: OrbitForgeLifecycleBlueprint
  source: string
  settings?: TalentSettings
  onLog?: (line: string) => void
  onStage?: (stage: TimelineStageId) => void
  onToken?: (token: string) => void
  onAgentToken?: (agentId: AgentLaneId, token: string) => void
}

type ExecuteMissionResult = {
  output: string
  renderedHtml: string
  headings: MissionHeading[]
  codeBlocks: MissionCodeBlock[]
  contextLabel: string
  summary: string
  history: MissionHistoryEntry[]
  historyEntry: MissionHistoryEntry
  runResult: OrbitForgeRunResult
}

type TimelineStageId = 'idle' | 'context' | 'lanes' | 'runtime' | 'synthesis' | 'complete' | 'failed'

type TimelineStage = {
  id: TimelineStageId
  label: string
}

const missionHistoryStateKey = 'orbitforge.missionHistory'
const pinnedPresetsStateKey = 'orbitforge.pinnedPresets'
const missionHistoryLimit = 12
const streamChunkDelayMs = 14
const streamChunkSize = 220
const preferredOllamaModels = [
  'qwen2.5-coder:7b',
  'qwen2.5-coder:14b',
  'qwen2.5-coder:32b',
  'deepseek-r1:14b',
  'deepseek-coder:33b',
]

const timelineStages: TimelineStage[] = [
  { id: 'context', label: 'Context packed' },
  { id: 'lanes', label: 'Lanes active' },
  { id: 'runtime', label: 'Runtime running' },
  { id: 'synthesis', label: 'Synthesizing' },
  { id: 'complete', label: 'Complete' },
]

const workflowLabels: Record<AgentWorkflow, string> = {
  general: 'General Build',
  review: 'Parallel Review',
  migration: 'Migration Flight Plan',
  incident: 'Incident Command',
  release: 'Release Gate',
}

const promptPresets: PromptPreset[] = [
  {
    id: 'workspace-plan',
    label: 'Workspace Plan',
    summary: 'Map the codebase and produce the next safest implementation path.',
    prompt: 'Inspect the active workspace and produce the next implementation plan, validation commands, and release blockers.',
    mode: 'single',
    workflow: 'general',
    contextScope: 'workspace',
  },
  {
    id: 'parallel-release',
    label: 'Release Trio',
    summary: 'Architect, implementer, and critic converge on the safest rollout.',
    prompt: 'Inspect the workspace, debate the best implementation path, and converge on the safest release plan.',
    mode: 'parallel',
    workflow: 'release',
    contextScope: 'workspace',
  },
  {
    id: 'selection-review',
    label: 'Selection Review',
    summary: 'Explain selected code, challenge assumptions, and suggest the safest next edit.',
    prompt: 'Explain this code, identify the biggest risks, and suggest the safest next edit.',
    mode: 'single',
    workflow: 'review',
    contextScope: 'selection',
  },
  {
    id: 'migration-flight',
    label: 'Migration Flight',
    summary: 'Turn a risky migration into stages, gates, and rollback proof.',
    prompt: 'Map this migration, stage the rollout order, list rollback checkpoints, and call out what must be proven before cutover.',
    mode: 'parallel',
    workflow: 'migration',
    contextScope: 'workspace+selection',
  },
  {
    id: 'incident-response',
    label: 'Incident Command',
    summary: 'Triage production risk, isolate causes, and define the next recovery steps.',
    prompt: 'Treat this as an incident. Isolate likely causes, the fastest safe mitigation, and the exact proof needed before full recovery.',
    mode: 'parallel',
    workflow: 'incident',
    contextScope: 'workspace+selection',
  },
]

function getSettings(): TalentSettings {
  const config = vscode.workspace.getConfiguration('orbitforge')
  return {
    provider: config.get<ProviderId>('provider', 'ollama'),
    baseUrl: config.get<string>('baseUrl', 'http://localhost:11434'),
    model: config.get<string>('model', 'qwen2.5-coder:7b'),
    apiKey: config.get<string>('apiKey', ''),
    agentMode: config.get<AgentMode>('agentMode', 'single'),
    workflow: config.get<AgentWorkflow>('workflow', 'general'),
    stream: config.get<boolean>('stream', true),
  }
}

function normalizeModelName(value: string) {
  return value.trim().toLowerCase()
}

async function readJsonResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Unexpected response: ${text.slice(0, 400)}`)
  }
}

async function listOllamaModels(baseUrl: string) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`)

  if (!response.ok) {
    throw new Error(`OrbitForge could not inspect Ollama models at ${baseUrl}.`)
  }

  const payload = (await readJsonResponse(response)) as {
    models?: Array<{ name?: string; model?: string }>
  }

  return (payload.models || [])
    .map((entry) => entry.name || entry.model || '')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function pickOllamaFallbackModel(requestedModel: string, installedModels: string[]) {
  const normalizedInstalled = new Map(installedModels.map((model) => [normalizeModelName(model), model] as const))
  const requestedNormalized = normalizeModelName(requestedModel)

  if (normalizedInstalled.has(requestedNormalized)) {
    return requestedModel
  }

  for (const preferredModel of preferredOllamaModels) {
    const matched = normalizedInstalled.get(normalizeModelName(preferredModel))
    if (matched) {
      return matched
    }
  }

  const codingModel = installedModels.find((model) => /coder|code|deepseek|qwen/i.test(model))
  return codingModel || installedModels[0]
}

async function resolveRuntimeSettings(settings = getSettings()): Promise<ResolvedTalentSettings> {
  if (settings.provider !== 'ollama') {
    return settings
  }

  let installedModels: string[] = []
  try {
    installedModels = await listOllamaModels(settings.baseUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OrbitForge could not reach Ollama.'
    throw new Error(`${message} Start Ollama or update orbitforge.baseUrl.`)
  }

  if (!installedModels.length) {
    throw new Error(
      'Ollama is reachable but no local models are installed. Run `ollama pull qwen2.5-coder:7b` or pick an installed model in OrbitForge settings.'
    )
  }

  const resolvedModel = pickOllamaFallbackModel(settings.model, installedModels)

  if (normalizeModelName(resolvedModel) === normalizeModelName(settings.model)) {
    return settings
  }

  return {
    ...settings,
    model: resolvedModel,
    runtimeNote: `OrbitForge switched Ollama from ${settings.model} to ${resolvedModel} because the configured model is not installed locally.`,
  }
}

function normalizeMode(value: unknown): AgentMode {
  return value === 'parallel' ? 'parallel' : 'single'
}

function normalizeProvider(value: unknown): ProviderId {
  if (
    value === 'lmstudio' ||
    value === 'openai' ||
    value === 'anthropic' ||
    value === 'openrouter' ||
    value === 'openai-compatible'
  ) {
    return value
  }

  return 'ollama'
}

function normalizeWorkflow(value: unknown): AgentWorkflow {
  if (value === 'review' || value === 'migration' || value === 'incident' || value === 'release') {
    return value
  }

  return 'general'
}

function normalizeContextScope(value: unknown): ContextScope {
  if (value === 'selection' || value === 'workspace+selection') {
    return value
  }

  return 'workspace'
}

function buildPanelTalentSettings(source: Record<string, unknown>, fallback = getSettings()): TalentSettings {
  return {
    ...fallback,
    provider: normalizeProvider(source.provider),
    baseUrl: typeof source.baseUrl === 'string' && source.baseUrl.trim() ? source.baseUrl.trim() : fallback.baseUrl,
    model: typeof source.model === 'string' && source.model.trim() ? source.model.trim() : fallback.model,
    agentMode: normalizeMode(source.mode ?? fallback.agentMode),
    workflow: normalizeWorkflow(source.workflow ?? fallback.workflow),
  }
}

async function collectRuntimePanelState(settings = getSettings()): Promise<RuntimePanelState> {
  const runtimeSettings = await resolveRuntimeSettings(settings)
  const availableModels =
    runtimeSettings.provider === 'ollama' ? await listOllamaModels(runtimeSettings.baseUrl).catch(() => []) : []

  return {
    provider: runtimeSettings.provider,
    baseUrl: runtimeSettings.baseUrl,
    model: runtimeSettings.model,
    configuredModel: settings.model,
    availableModels,
    runtimeNote: runtimeSettings.runtimeNote,
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function serializeForWebview(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function truncate(value: string, max = 120) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) {
    return normalized
  }

  return `${normalized.slice(0, max - 1)}…`
}

function slugifyPrompt(prompt: string) {
  const base = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')

  return base || 'orbitforge-task'
}

function buildScaffold(prompt: string) {
  const slug = slugifyPrompt(prompt)
  return {
    branch: `of/${slug}`,
    commit: `feat: ${truncate(prompt, 72)}`,
  }
}

function extractMissionSummary(output: string) {
  const firstMeaningfulLine =
    output
      .split('\n')
      .map((line) => line.replace(/^#+\s*/, '').trim())
      .find((line) => Boolean(line)) || 'OrbitForge completed the mission.'

  return truncate(firstMeaningfulLine, 140)
}

function getActiveSelectionText() {
  const editor = vscode.window.activeTextEditor

  if (!editor) {
    return ''
  }

  return editor.document.getText(editor.selection).trim()
}

async function collectWorkspaceSummary() {
  const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,py,md,json}', '**/node_modules/**', 40)
  const fileLines = files.map((file) => vscode.workspace.asRelativePath(file)).join('\n')
  const folderLines = (vscode.workspace.workspaceFolders || []).map((folder) => folder.name).join(', ')

  return [`Workspace folders: ${folderLines || 'none'}`, 'Tracked files:', fileLines || 'No workspace files found.'].join('\n')
}

async function collectPanelContext(settings = getSettings()): Promise<PanelContextSnapshot> {
  const runtimeSettings = await resolveRuntimeSettings(settings).catch(() => settings)
  const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,py,md,json}', '**/node_modules/**', 40)
  const workspaceFolders = (vscode.workspace.workspaceFolders || []).map((folder) => folder.name)
  const activeFile = vscode.window.activeTextEditor
    ? vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri)
    : 'No active file'

  return {
    provider: runtimeSettings.provider,
    model: runtimeSettings.model,
    baseUrl: runtimeSettings.baseUrl,
    workspaceFolders,
    workspaceFileCount: files.length,
    activeFile,
    hasSelection: Boolean(getActiveSelectionText()),
  }
}

function getMissionHistory(extensionContext: vscode.ExtensionContext) {
  return extensionContext.workspaceState.get<MissionHistoryEntry[]>(missionHistoryStateKey, [])
}

function getPinnedPresets(extensionContext: vscode.ExtensionContext) {
  return extensionContext.workspaceState.get<string[]>(pinnedPresetsStateKey, [])
}

async function savePinnedPresets(extensionContext: vscode.ExtensionContext, presetIds: string[]) {
  await extensionContext.workspaceState.update(pinnedPresetsStateKey, presetIds)
  return presetIds
}

async function saveMissionHistory(extensionContext: vscode.ExtensionContext, entry: MissionHistoryEntry) {
  const existing = getMissionHistory(extensionContext)
  const filtered = existing.filter((item) => item.id !== entry.id)
  const next = [entry, ...filtered].slice(0, missionHistoryLimit)
  await extensionContext.workspaceState.update(missionHistoryStateKey, next)
  return next
}

function renderHistoryCards(entries: MissionHistoryEntry[]) {
  if (!entries.length) {
    return `<div class="empty-state">No missions yet. Run a preset, blueprint, or custom mission and it will stay here for quick restore or rerun.</div>`
  }

  return entries
    .map(
      (entry) => `
      <article class="history-card">
        <div class="history-title-row">
          <div>
            <div class="history-title">${escapeHtml(entry.title)}</div>
            <div class="history-meta">${escapeHtml(workflowLabels[entry.workflow])} • ${
              entry.mode === 'parallel' ? 'Parallel trio' : 'Single lane'
            } • ${escapeHtml(new Date(entry.createdAt).toLocaleString())}</div>
          </div>
          <div class="history-badge">${escapeHtml(entry.source)}</div>
        </div>
        <div class="history-summary">${escapeHtml(entry.summary)}</div>
        <div class="history-actions">
          <button class="secondary history-action" data-history-action="restore" data-history-id="${entry.id}">Restore</button>
          <button class="ghost history-action" data-history-action="rerun" data-history-id="${entry.id}">Rerun</button>
        </div>
      </article>`
    )
    .join('')
}

function renderPinnedPresetCards(presetIds: string[]) {
  const pinned = presetIds
    .map((presetId) => promptPresets.find((preset) => preset.id === presetId))
    .filter(Boolean) as PromptPreset[]

  if (!pinned.length) {
    return `<div class="empty-state">Pin a preset with /pin &lt;preset-id&gt; to keep it here.</div>`
  }

  return pinned
    .map(
      (preset) => `
      <button
        class="preset-card"
        data-preset-id="${preset.id}"
        data-prompt="${escapeHtml(preset.prompt)}"
        data-mode="${preset.mode}"
        data-workflow="${preset.workflow}"
        data-scope="${preset.contextScope}"
      >
        <span class="preset-title">${escapeHtml(preset.label)}</span>
        <span class="preset-summary">${escapeHtml(preset.summary)}</span>
      </button>`
    )
    .join('')
}

function formatHistoryText(entries: MissionHistoryEntry[]) {
  if (!entries.length) {
    return 'No OrbitForge missions have been saved in this workspace yet.'
  }

  return [
    'Recent OrbitForge missions:',
    '',
    ...entries.map(
      (entry, index) =>
        `${index + 1}. ${entry.title} [${workflowLabels[entry.workflow]} | ${
          entry.mode === 'parallel' ? 'parallel' : 'single'
        } | ${entry.contextScope}] - ${entry.summary}`
    ),
  ].join('\n')
}

function buildHistoryMarkdown(entries: MissionHistoryEntry[]) {
  if (!entries.length) {
    return '# OrbitForge Mission History\n\nNo missions saved yet.'
  }

  const blocks = entries.map((entry, index) => {
    const header = `## ${index + 1}. ${entry.title}`
    const meta = [
      `- Workflow: ${workflowLabels[entry.workflow]}`,
      `- Mode: ${entry.mode}`,
      `- Context: ${entry.contextScope}`,
      `- Provider: ${entry.provider}`,
      `- Model: ${entry.model}`,
      `- Source: ${entry.source}`,
      `- Created: ${entry.createdAt}`,
      `- Summary: ${entry.summary}`,
    ].join('\n')
    const prompt = `### Prompt\n\n${entry.prompt}`
    return [header, meta, prompt].join('\n\n')
  })

  return ['# OrbitForge Mission History', '', ...blocks].join('\n\n')
}

function buildHistoryJson(entries: MissionHistoryEntry[]) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), missions: entries }, null, 2)
}

async function exportMissionHistory(extensionContext: vscode.ExtensionContext, preferredFormat?: 'md' | 'json') {
  const history = getMissionHistory(extensionContext)
  let format: 'md' | 'json' | undefined = preferredFormat

  if (!format) {
    const formatPick = await vscode.window.showQuickPick(
      [
        { label: 'Markdown', description: 'Share a readable mission log', format: 'md' as const },
        { label: 'JSON', description: 'Export raw data for other tooling', format: 'json' as const },
      ],
      {
        title: 'Export OrbitForge mission history',
        placeHolder: 'Choose export format',
      }
    )

    if (!formatPick) {
      return
    }

    format = formatPick.format
  }

  const defaultName =
    format === 'md' ? 'orbitforge-mission-history.md' : 'orbitforge-mission-history.json'
  const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri
    ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, defaultName)
    : undefined

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri,
    saveLabel: 'Export History',
  })

  if (!saveUri) {
    return
  }

  const output = format === 'md' ? buildHistoryMarkdown(history) : buildHistoryJson(history)
  await vscode.workspace.fs.writeFile(saveUri, Buffer.from(output, 'utf8'))
  vscode.window.showInformationMessage(`OrbitForge history exported to ${saveUri.fsPath}`)
}

async function proposePatchDiff(extensionContext: vscode.ExtensionContext) {
  const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 200)
  const picked = await vscode.window.showQuickPick(
    files.map((file) => ({
      label: vscode.workspace.asRelativePath(file),
      uri: file,
    })),
    {
      title: 'Choose a file for OrbitForge diff proposal',
      placeHolder: 'Select a file to generate a diff',
    }
  )

  if (!picked) {
    return
  }

  const instruction = await vscode.window.showInputBox({
    prompt: 'Describe the change you want OrbitForge to propose for this file',
    ignoreFocusOut: true,
  })

  if (!instruction?.trim()) {
    return
  }

  const originalBytes = await vscode.workspace.fs.readFile(picked.uri)
  const originalText = Buffer.from(originalBytes).toString('utf8')
  const settings = getSettings()
  const diffPrompt = [
    `You are generating a unified diff for ${picked.label}.`,
    'Only output a valid unified diff with --- and +++ headers.',
    'Instruction:',
    instruction,
  ].join('\n')

  const runResult = await requestTalent(
    diffPrompt,
    originalText,
    'single',
    'general',
    undefined,
    settings
  )

  const diffText = runResult.output
  const patchedText = applyUnifiedDiff(originalText, diffText)

  if (!patchedText) {
    const doc = await vscode.workspace.openTextDocument({ content: diffText, language: 'diff' })
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    vscode.window.showWarningMessage('OrbitForge could not apply the diff. The raw diff is open for review.')
    return
  }

  const tempUri = vscode.Uri.joinPath(vscode.Uri.parse('untitled:'), picked.label + '.orbitforge.proposed')
  const tempDoc = await vscode.workspace.openTextDocument(tempUri)
  const editor = await vscode.window.showTextDocument(tempDoc, vscode.ViewColumn.Beside)
  await editor.edit((edit) => {
    edit.insert(new vscode.Position(0, 0), patchedText)
  })

  await vscode.commands.executeCommand(
    'vscode.diff',
    picked.uri,
    tempUri,
    `OrbitForge Diff: ${picked.label}`
  )
}

function applyUnifiedDiff(original: string, diff: string) {
  const lines = diff.split('\n')
  const hunks = lines.filter((line) => line.startsWith('@@'))
  if (!hunks.length) {
    return null
  }
  const originalLines = original.split('\n')
  const result: string[] = []
  let pointer = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('@@')) {
      const match = /@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/.exec(line)
      if (!match) {
        return null
      }
      const startLine = parseInt(match[1], 10) - 1
      while (pointer < startLine) {
        result.push(originalLines[pointer])
        pointer += 1
      }
      i += 1
      while (i < lines.length && !lines[i].startsWith('@@')) {
        const hunkLine = lines[i]
        if (hunkLine.startsWith('+')) {
          result.push(hunkLine.slice(1))
        } else if (hunkLine.startsWith('-')) {
          pointer += 1
        } else if (hunkLine.startsWith(' ')) {
          result.push(hunkLine.slice(1))
          pointer += 1
        }
        i += 1
      }
    } else {
      i += 1
    }
  }

  while (pointer < originalLines.length) {
    result.push(originalLines[pointer])
    pointer += 1
  }

  return result.join('\n')
}

async function createBranchFromPrompt(prompt: string) {
  const scaffold = buildScaffold(prompt)
  try {
    await execAsync(`git checkout -b ${scaffold.branch}`)
    await vscode.window.showInformationMessage(`OrbitForge created branch ${scaffold.branch}`)
    return scaffold
  } catch (error) {
    vscode.window.showErrorMessage('OrbitForge could not create a git branch. Make sure this is a git repo.')
    return scaffold
  }
}

function resolveProviderBaseUrl(provider: ProviderId, baseUrl: string) {
  if (provider === 'ollama') {
    return baseUrl.replace(/\/+$/, '')
  }

  if (baseUrl.endsWith('/v1')) {
    return baseUrl
  }

  return `${baseUrl.replace(/\/+$/, '')}/v1`
}

function supportsStreaming(provider: ProviderId) {
  return provider === 'ollama' || provider === 'openai' || provider === 'openai-compatible' || provider === 'openrouter' || provider === 'lmstudio'
}

async function invokeWithStreaming(invocation: {
  provider: ProviderId
  model: string
  baseUrl: string
  apiKey?: string
  systemPrompt: string
  userPrompt: string
}, onToken: (token: string) => void) {
  if (invocation.provider === 'ollama') {
    return streamOllama(invocation, onToken)
  }

  if (supportsStreaming(invocation.provider)) {
    return streamOpenAICompatible(invocation, onToken)
  }

  throw new Error('Streaming not supported for this provider.')
}

async function streamOpenAICompatible(
  invocation: {
    provider: ProviderId
    model: string
    baseUrl: string
    apiKey?: string
    systemPrompt: string
    userPrompt: string
  },
  onToken: (token: string) => void
) {
  const url = `${resolveProviderBaseUrl(invocation.provider, invocation.baseUrl)}/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (invocation.apiKey) {
    headers.Authorization = `Bearer ${invocation.apiKey}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: invocation.model,
      stream: true,
      messages: [
        { role: 'system', content: invocation.systemPrompt },
        { role: 'user', content: invocation.userPrompt },
      ],
    }),
  })

  if (!response.body) {
    throw new Error('Provider did not return a stream.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let output = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) {
        continue
      }
      const payload = line.replace(/^data:\s*/, '')
      if (payload === '[DONE]') {
        break
      }
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          output += delta
          onToken(delta)
        }
      } catch {
        // Ignore malformed stream chunks.
      }
    }
  }

  return output
}

async function streamOllama(
  invocation: {
    provider: ProviderId
    model: string
    baseUrl: string
    apiKey?: string
    systemPrompt: string
    userPrompt: string
  },
  onToken: (token: string) => void
) {
  const url = `${resolveProviderBaseUrl(invocation.provider, invocation.baseUrl)}/api/generate`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: invocation.model,
      prompt: `${invocation.systemPrompt}\n\n${invocation.userPrompt}`,
      stream: true,
    }),
  })

  if (!response.body) {
    throw new Error('Provider did not return a stream.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let output = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) {
        continue
      }
      try {
        const json = JSON.parse(line)
        const chunk = json.response
        if (chunk) {
          output += chunk
          onToken(chunk)
        }
      } catch {
        // Ignore malformed chunks.
      }
    }
  }

  return output
}

function renderContextCards(snapshot: PanelContextSnapshot) {
  const cards = [
    `Provider: ${snapshot.provider}`,
    `Model: ${snapshot.model}`,
    `Workspace files: ${snapshot.workspaceFileCount}`,
    `Active file: ${snapshot.activeFile}`,
    `Selection: ${snapshot.hasSelection ? 'ready' : 'none'}`,
  ]

  return cards.map((card) => `<div class="context-pill">${escapeHtml(card)}</div>`).join('')
}

function renderPresetCards() {
  return promptPresets
    .map(
      (preset) => `
      <button
        class="preset-card"
        data-preset-id="${preset.id}"
        data-prompt="${escapeHtml(preset.prompt)}"
        data-mode="${preset.mode}"
        data-workflow="${preset.workflow}"
        data-scope="${preset.contextScope}"
      >
        <span class="preset-title">${escapeHtml(preset.label)}</span>
        <span class="preset-summary">${escapeHtml(preset.summary)}</span>
      </button>`
    )
    .join('')
}

function renderBlueprintOptions() {
  return builtInLifecycleBlueprints
    .map(
      (blueprint) =>
        `<option value="${escapeHtml(blueprint.blueprintId)}">${escapeHtml(blueprint.title)} - ${escapeHtml(
          blueprint.summary
        )}</option>`
    )
    .join('')
}

function renderSlashHints() {
  const commands = [
    '/help',
    '/preset workspace-plan',
    '/preset parallel-release',
    '/mode parallel',
    '/workflow review',
    '/scope selection',
    '/blueprint parallel-review-kit',
    '/history',
    '/rerun last',
    '/pin workspace-plan',
    '/pins',
    '/export md',
    '/export json',
    '/branch add-release-gate',
    '/diff src/app.tsx',
  ]

  return commands
    .map((command) => `<button class="slash-chip" data-slash="${escapeHtml(command)}">${escapeHtml(command)}</button>`)
    .join('')
}

function renderTimeline(stageId: TimelineStageId) {
  return timelineStages
    .map((stage, index) => {
      const isActive = stage.id === stageId
      const isComplete = timelineStages.findIndex((item) => item.id === stageId) > index
      const stateClass = isActive ? 'timeline-active' : isComplete ? 'timeline-complete' : ''
      return `<div class="timeline-step ${stateClass}"><span>${index + 1}</span>${escapeHtml(stage.label)}</div>`
    })
    .join('')
}

function findPreset(query: string) {
  const normalized = normalizeLookup(query)
  return promptPresets.find(
    (preset) => preset.id === normalized || normalizeLookup(preset.label) === normalized
  )
}

function findBlueprint(query: string) {
  const normalized = normalizeLookup(query)
  return builtInLifecycleBlueprints.find(
    (blueprint) => blueprint.blueprintId === normalized || normalizeLookup(blueprint.title) === normalized
  )
}

function parseBlueprintWorkflow(blueprint: OrbitForgeLifecycleBlueprint): AgentWorkflow {
  const workflow = blueprint.nodes.find((node) => node.componentId === 'parallel-lanes')?.config?.workflow

  if (
    workflow === 'review' ||
    workflow === 'migration' ||
    workflow === 'incident' ||
    workflow === 'release' ||
    workflow === 'general'
  ) {
    return workflow
  }

  return 'general'
}

function parseBlueprintMode(blueprint: OrbitForgeLifecycleBlueprint): AgentMode {
  return blueprint.nodes.some((node) => node.componentId === 'parallel-lanes') ? 'parallel' : 'single'
}

async function requestTalent(
  prompt: string,
  contextText: string,
  mode: AgentMode,
  workflow: AgentWorkflow,
  blueprint?: OrbitForgeLifecycleBlueprint,
  settings = getSettings(),
  options?: { onToken?: (token: string) => void; onAgentToken?: (agentId: AgentLaneId, token: string) => void; forceStream?: boolean }
) {
  const runtimeSettings = await resolveRuntimeSettings(settings)
  if (runtimeSettings.runtimeNote) {
    void vscode.window.showWarningMessage(runtimeSettings.runtimeNote)
  }

  const streamEnabled =
    Boolean(options?.forceStream) && runtimeSettings.stream && supportsStreaming(runtimeSettings.provider)
  const shouldStreamSingle = streamEnabled && mode === 'single' && options?.onToken
  const shouldStreamParallel = streamEnabled && mode === 'parallel' && options?.onAgentToken

  if (shouldStreamSingle || shouldStreamParallel) {
    const result = await runOrbitForgeTask(
      {
        provider: runtimeSettings.provider,
        model: runtimeSettings.model,
        baseUrl: runtimeSettings.baseUrl,
        apiKey: runtimeSettings.apiKey,
        prompt,
        workspaceContext: contextText,
        mode,
        workflow,
        blueprint,
      },
      {
        invokerStream: async (invocation, onToken) => {
          return invokeWithStreaming(invocation, onToken)
        },
        onAgentToken: (agentId, token) => {
          if (shouldStreamSingle && options?.onToken) {
            options.onToken(token)
            return
          }
          options?.onAgentToken?.(agentId, token)
        },
      }
    )
    return result
  }

  const result = await runOrbitForgeTask({
    provider: runtimeSettings.provider,
    model: runtimeSettings.model,
    baseUrl: runtimeSettings.baseUrl,
    apiKey: runtimeSettings.apiKey,
    prompt,
    workspaceContext: contextText,
    mode,
    workflow,
    blueprint,
  })

  return result
}

async function openResultDocument(title: string, content: string, viewColumn = vscode.ViewColumn.Beside) {
  const doc = await vscode.workspace.openTextDocument({
    content: `# ${title}\n\n${content}`,
    language: 'markdown',
  })

  await vscode.window.showTextDocument(doc, viewColumn)
}

async function buildContext(scope: ContextScope) {
  const workspaceSummary = await collectWorkspaceSummary()
  const selectedText = getActiveSelectionText()

  if (scope === 'selection') {
    if (!selectedText) {
      throw new Error('Select code first or switch the context scope to workspace.')
    }

    return {
      contextText: selectedText,
      contextLabel: 'Selection',
    }
  }

  if (scope === 'workspace+selection' && selectedText) {
    return {
      contextText: `Workspace summary:\n${workspaceSummary}\n\nSelected code:\n${selectedText}`,
      contextLabel: 'Workspace + selection',
    }
  }

  return {
    contextText: workspaceSummary,
    contextLabel: 'Workspace',
  }
}

async function executeMission(options: ExecuteMissionOptions): Promise<ExecuteMissionResult> {
  const settings = options.settings || getSettings()
  options.onLog?.(`Mission accepted: ${options.title}`)
  options.onLog?.(`Provider lane: ${settings.provider} • ${settings.model}`)
  options.onLog?.(`Workflow: ${workflowLabels[options.workflow]} • ${options.mode === 'parallel' ? 'Parallel trio' : 'Single lane'}`)

  options.onStage?.('context')
  const { contextText, contextLabel } = await buildContext(options.contextScope)
  options.onLog?.(`Context packed: ${contextLabel}`)

  if (options.mode === 'parallel') {
    options.onStage?.('lanes')
    options.onLog?.('Parallel lanes active: architect, implementer, critic')
  }

  if (options.blueprint) {
    options.onLog?.(`Blueprint loaded: ${options.blueprint.title}`)
  }

  options.onStage?.('runtime')
  options.onLog?.('Dispatching OrbitForge runtime')
  const runResult = await requestTalent(
    options.prompt,
    contextText,
    options.mode,
    options.workflow,
    options.blueprint,
    settings,
    options.mode === 'single' && options.onToken
      ? {
          forceStream: true,
          onToken: options.onToken,
        }
      : options.mode === 'parallel' && options.onAgentToken
        ? {
            forceStream: true,
            onAgentToken: options.onAgentToken,
          }
        : undefined
  )

  const output = `${runResult.summary}\n\n${runResult.output}`
  const rendered = await renderMissionOutput(output)
  options.onStage?.('synthesis')
  const summary = extractMissionSummary(output)
  const historyEntry: MissionHistoryEntry = {
    id: `mission-${Date.now()}`,
    title: options.title,
    prompt: options.prompt,
    mode: options.mode,
    workflow: options.workflow,
    contextScope: options.contextScope,
    provider: settings.provider,
    model: runResult.model,
    source: options.source,
    createdAt: new Date().toISOString(),
    summary,
    blueprintId: options.blueprint?.blueprintId,
    blueprint: options.blueprint,
  }

  const history = await saveMissionHistory(options.extensionContext, historyEntry)
  options.onStage?.('complete')
  options.onLog?.('Mission finished and saved to workspace history')

  return {
    output,
    renderedHtml: rendered.renderedHtml,
    headings: rendered.headings,
    codeBlocks: rendered.codeBlocks,
    contextLabel,
    summary,
    history,
    historyEntry,
    runResult,
  }
}

async function streamOutputToPanel(panel: vscode.WebviewPanel, sessionId: string, text: string) {
  for (let index = 0; index < text.length; index += streamChunkSize) {
    const chunk = text.slice(index, index + streamChunkSize)
    panel.webview.postMessage({
      type: 'stream',
      sessionId,
      text: chunk,
      reset: index === 0,
    })
    await new Promise((resolve) => setTimeout(resolve, streamChunkDelayMs))
  }
}

async function streamParallelAgents(panel: vscode.WebviewPanel, sessionId: string, result: OrbitForgeRunResult) {
  for (const agent of result.agents) {
    const header = `\n\n### ${agent.title} (${agent.status})\n\n`
    await streamOutputToPanel(panel, sessionId, header + agent.output)
  }
}

async function runInteractiveMission(options: ExecuteMissionOptions & { viewColumn?: vscode.ViewColumn; progressTitle?: string }) {
  const progressTitle = options.progressTitle || `OrbitForge • ${options.title}`

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Collecting context' })
      const result = await executeMission({
        ...options,
        onLog: (line) => {
          if (line.includes('Dispatching OrbitForge runtime')) {
            progress.report({ message: 'Running agents' })
          }
          options.onLog?.(line)
        },
        onStage: (stage) => {
          options.onStage?.(stage)
        },
      })

      const heading = `${options.title}\n\n- Workflow: ${workflowLabels[options.workflow]}\n- Mode: ${
        options.mode === 'parallel' ? 'Parallel trio' : 'Single lane'
      }\n- Context: ${result.contextLabel}`

      await openResultDocument(heading, result.output, options.viewColumn)
      return result
    }
  )
}

async function runBlueprintCommand(
  blueprint: OrbitForgeLifecycleBlueprint,
  extensionContext: vscode.ExtensionContext,
  promptOverride?: string,
  viewColumn = vscode.ViewColumn.Beside
) {
  const prompt =
    promptOverride ||
    (await vscode.window.showInputBox({
      prompt: 'Task prompt for this OrbitForge blueprint',
      value: blueprint.goal,
      ignoreFocusOut: true,
    }))

  if (!prompt?.trim()) {
    return
  }

  await runInteractiveMission({
    title: blueprint.title,
    prompt,
    mode: parseBlueprintMode(blueprint),
    workflow: parseBlueprintWorkflow(blueprint),
    contextScope: 'workspace+selection',
    blueprint,
    extensionContext,
    source: 'starter-blueprint',
    viewColumn,
    progressTitle: `OrbitForge • ${blueprint.title}`,
  })
}

async function runPreset(preset: PromptPreset, extensionContext: vscode.ExtensionContext, viewColumn = vscode.ViewColumn.Beside) {
  await runInteractiveMission({
    title: preset.label,
    prompt: preset.prompt,
    mode: preset.mode,
    workflow: preset.workflow,
    contextScope: preset.contextScope,
    extensionContext,
    source: `preset:${preset.id}`,
    viewColumn,
  })
}

async function launchStarterBlueprintPicker(extensionContext: vscode.ExtensionContext) {
  const selected = await vscode.window.showQuickPick(
    builtInLifecycleBlueprints.map((blueprint) => ({
      label: blueprint.title,
      description: blueprint.blueprintId,
      detail: blueprint.summary,
      blueprint,
    })),
    {
      title: 'Run an OrbitForge starter blueprint',
      placeHolder: 'Choose a lifecycle blueprint to run in the current workspace',
    }
  )

  if (!selected) {
    return
  }

  await runBlueprintCommand(selected.blueprint, extensionContext, undefined, vscode.ViewColumn.Beside)
}

async function openMissionHistoryPicker(extensionContext: vscode.ExtensionContext) {
  const history = getMissionHistory(extensionContext)

  if (!history.length) {
    vscode.window.showInformationMessage('No OrbitForge mission history in this workspace yet.')
    return
  }

  const pick = await vscode.window.showQuickPick(
    history.map((entry) => ({
      label: entry.title,
      description: `${workflowLabels[entry.workflow]} • ${entry.mode === 'parallel' ? 'parallel' : 'single'} • ${
        entry.contextScope
      }`,
      detail: entry.summary,
      entry,
    })),
    {
      title: 'OrbitForge mission history',
      placeHolder: 'Choose a previous mission to rerun or restore',
    }
  )

  if (!pick) {
    return
  }

  const action = await vscode.window.showQuickPick(
    [
      { label: 'Rerun mission', action: 'rerun' as const },
      { label: 'Open interactive panel', action: 'panel' as const },
    ],
    {
      title: pick.entry.title,
      placeHolder: 'Choose how to continue from this mission',
    }
  )

  if (!action) {
    return
  }

  if (action.action === 'panel') {
    await vscode.commands.executeCommand('orbitforge.openPanel')
    return
  }

  await runInteractiveMission({
    title: `${pick.entry.title} (rerun)`,
    prompt: pick.entry.prompt,
    mode: pick.entry.mode,
    workflow: pick.entry.workflow,
    contextScope: pick.entry.contextScope,
    blueprint: pick.entry.blueprint,
    extensionContext,
    source: 'history-rerun',
    viewColumn: vscode.ViewColumn.Beside,
  })
}

async function launchGuidedSession(openPanel: () => Promise<unknown>, extensionContext: vscode.ExtensionContext) {
  const action = await vscode.window.showQuickPick(
    [
      {
        label: 'Open interactive panel',
        description: 'Stay in a Claude Code / Codex-style workspace with presets, slash commands, and history.',
        action: 'panel' as const,
      },
      {
        label: 'Run starter blueprint',
        description: 'Pick a lifecycle blueprint and run it with minimal setup.',
        action: 'blueprint' as const,
      },
      {
        label: 'Open mission history',
        description: 'Rerun or continue from a previous OrbitForge mission.',
        action: 'history' as const,
      },
      ...promptPresets.map((preset) => ({
        label: preset.label,
        description: preset.summary,
        action: 'preset' as const,
        preset,
      })),
      {
        label: 'Custom mission',
        description: 'Choose the workflow, context, and execution mode yourself.',
        action: 'custom' as const,
      },
    ],
    {
      title: 'OrbitForge guided session',
      placeHolder: 'Choose how you want to drive OrbitForge',
    }
  )

  if (!action) {
    return
  }

  if (action.action === 'panel') {
    await openPanel()
    return
  }

  if (action.action === 'history') {
    await openMissionHistoryPicker(extensionContext)
    return
  }

  if (action.action === 'blueprint') {
    await launchStarterBlueprintPicker(extensionContext)
    return
  }

  if (action.action === 'preset' && action.preset) {
    await runPreset(action.preset, extensionContext)
    return
  }

  const workflowPick = await vscode.window.showQuickPick(
    (Object.entries(workflowLabels) as Array<[AgentWorkflow, string]>).map(([workflow, label]) => ({
      label,
      description: workflow,
      workflow,
    })),
    {
      title: 'Choose the OrbitForge workflow',
      placeHolder: 'Pick the mission pattern for this run',
    }
  )

  if (!workflowPick) {
    return
  }

  const modePick = await vscode.window.showQuickPick(
    [
      { label: 'Single lane', description: 'Fastest path for one focused answer.', mode: 'single' as const },
      { label: 'Parallel trio', description: 'Architect, implementer, and critic converge.', mode: 'parallel' as const },
    ],
    {
      title: 'Choose execution mode',
      placeHolder: 'Decide whether this mission needs dissent and convergence',
    }
  )

  if (!modePick) {
    return
  }

  const scopePick = await vscode.window.showQuickPick(
    [
      { label: 'Workspace', description: 'Use the repo map and current workspace files.', scope: 'workspace' as const },
      { label: 'Selection', description: 'Use only the selected code.', scope: 'selection' as const },
      {
        label: 'Workspace + selection',
        description: 'Blend the repo map with the selected code.',
        scope: 'workspace+selection' as const,
      },
    ],
    {
      title: 'Choose context scope',
      placeHolder: 'Tell OrbitForge what it should ground itself in',
    }
  )

  if (!scopePick) {
    return
  }

  const prompt = await vscode.window.showInputBox({
    prompt: 'Mission prompt',
    placeHolder: 'Describe the work, the desired outcome, and what must be proven before shipping.',
    ignoreFocusOut: true,
    value: 'Inspect the current workspace, decide the safest next implementation path, and list the proof required before calling it done.',
  })

  if (!prompt?.trim()) {
    return
  }

  await runInteractiveMission({
    title: 'Guided mission',
    prompt,
    mode: modePick.mode,
    workflow: workflowPick.workflow,
    contextScope: scopePick.scope,
    extensionContext,
    source: 'guided-session',
  })
}

function renderPanel(
  initialMode: AgentMode,
  initialWorkflow: AgentWorkflow,
  snapshot: PanelContextSnapshot,
  historyEntries: MissionHistoryEntry[],
  pinnedPresets: string[],
  timelineStage: TimelineStageId = 'idle',
  output = 'Pick a preset, use a slash command, rerun history, or launch a blueprint. OrbitForge keeps the loop inside this workspace.'
) {
  const initialClientState = serializeForWebview({
    welcomeText: output,
    mode: initialMode,
    workflow: initialWorkflow,
  })

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
        --bg: var(--vscode-editor-background);
        --panel: var(--vscode-sideBar-background, rgba(10, 20, 34, 0.9));
        --panel-2: var(--vscode-editorWidget-background, rgba(15, 25, 40, 0.92));
        --panel-3: var(--vscode-input-background, rgba(20, 31, 48, 0.92));
        --line: var(--vscode-widget-border, rgba(148, 163, 184, 0.18));
        --line-strong: rgba(110, 231, 216, 0.34);
        --text: var(--vscode-editor-foreground);
        --muted: var(--vscode-descriptionForeground);
        --accent: #6ee7d8;
        --accent-2: #74c0fc;
        --accent-3: #f59e0b;
        --success: #4ade80;
        --danger: #fb7185;
        --shadow: 0 18px 48px rgba(2, 6, 23, 0.26);
        --radius-lg: 24px;
        --radius-md: 18px;
        --radius-sm: 14px;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(110, 231, 216, 0.16), transparent 26%),
          radial-gradient(circle at top right, rgba(116, 192, 252, 0.14), transparent 30%),
          radial-gradient(circle at bottom right, rgba(245, 158, 11, 0.08), transparent 24%),
          var(--bg);
        color: var(--text);
        padding: 20px;
      }
      .shell { display: grid; gap: 16px; }
      .card {
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--panel);
        box-shadow: var(--shadow);
      }
      .hero, .glass, .timeline, .mission-shell, .logs { padding: 18px; }
      .eyebrow {
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--accent);
      }
      h1 {
        margin: 10px 0 8px;
        font-size: 28px;
        line-height: 1.1;
      }
      .hero p { margin: 0; color: var(--muted); line-height: 1.6; }
      .context-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
      .context-pill {
        border-radius: 999px;
        border: 1px solid var(--line);
        padding: 8px 12px;
        background: rgba(15, 23, 42, 0.42);
        color: var(--text);
        font-size: 12px;
      }
      .grid { display: grid; gap: 16px; grid-template-columns: 1.15fr 0.85fr; }
      .section-title {
        margin: 0 0 12px;
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .preset-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
      .preset-card, .slash-chip {
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: linear-gradient(180deg, rgba(14, 26, 45, 0.96), rgba(10, 18, 33, 0.88));
        color: var(--text);
        cursor: pointer;
        transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
      }
      .preset-card {
        width: 100%;
        text-align: left;
        padding: 14px;
      }
      .preset-card:hover, .slash-chip:hover, .history-action:hover {
        border-color: var(--line-strong);
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(2, 6, 23, 0.18);
      }
      .preset-title { display: block; font-weight: 700; margin-bottom: 6px; }
      .preset-summary { display: block; color: var(--muted); font-size: 12px; line-height: 1.5; }
      .slash-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .slash-chip { padding: 9px 12px; font-size: 12px; }
      .history-stack { display: grid; gap: 10px; }
      .history-card {
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        padding: 12px;
        background: rgba(15, 23, 42, 0.58);
      }
      .history-title-row { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
      .history-title { font-weight: 700; }
      .history-meta, .history-summary, .hint, .empty-state {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
      }
      .history-badge {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 11px;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .history-actions, .button-row {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        margin-top: 10px;
      }
      .session-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .session-tab {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 12px;
        background: rgba(15, 23, 42, 0.58);
        color: var(--muted);
        cursor: pointer;
        transition: border-color 120ms ease, color 120ms ease, transform 120ms ease;
      }
      .session-tab.active {
        color: var(--text);
        border-color: var(--line-strong);
        background: rgba(14, 26, 45, 0.92);
        transform: translateY(-1px);
      }
      .session-meta {
        margin-top: 10px;
        color: var(--muted);
        font-size: 12px;
      }
      label { display: block; margin-bottom: 12px; }
      .label {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      input, select, textarea, button {
        width: 100%;
        border-radius: var(--radius-sm);
      }
      input, select, textarea {
        padding: 12px 14px;
        border: 1px solid var(--line);
        background: var(--panel-3);
        color: var(--text);
      }
      textarea { min-height: 180px; resize: vertical; line-height: 1.6; }
      button {
        border: none;
        padding: 12px 14px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
      }
      button:hover { transform: translateY(-1px); }
      .runtime-note {
        margin-top: 8px;
        color: var(--accent);
        font-size: 12px;
        line-height: 1.6;
      }
      .model-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .model-chip {
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.58);
        color: var(--text);
        padding: 8px 12px;
        font-size: 12px;
        cursor: pointer;
      }
      .model-chip:hover {
        border-color: var(--line-strong);
      }
      .primary {
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: #04263a;
      }
      .secondary {
        background: rgba(15, 23, 42, 0.84);
        color: var(--text);
        border: 1px solid var(--line);
      }
      .ghost {
        background: transparent;
        color: var(--muted);
        border: 1px dashed var(--line);
      }
      .status { color: var(--accent); font-size: 12px; min-height: 18px; }
      .log-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 8px;
      }
      .log-entry {
        border-left: 2px solid rgba(125, 211, 252, 0.4);
        padding-left: 10px;
        color: #d6e4f5;
        font-size: 12px;
        line-height: 1.5;
      }
      .timeline-row {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      }
      .timeline-step {
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        font-size: 12px;
        color: var(--muted);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .timeline-step span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid var(--line);
        font-size: 11px;
        color: var(--text);
      }
      .timeline-active {
        border-color: rgba(105, 245, 225, 0.4);
        color: var(--text);
      }
      .timeline-active span {
        background: rgba(105, 245, 225, 0.2);
      }
      .timeline-complete {
        border-color: rgba(125, 211, 252, 0.35);
        color: #d6e4f5;
      }

      .mission-shell {
        display: grid;
        gap: 16px;
        grid-template-columns: 260px minmax(0, 1fr) 300px;
        align-items: start;
      }
      .step-rail-card,
      .mission-header-card,
      .mission-canvas-card,
      .utility-card {
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: linear-gradient(180deg, rgba(12, 23, 38, 0.94), rgba(11, 18, 31, 0.9));
        box-shadow: var(--shadow);
      }
      .step-rail-card,
      .mission-header-card,
      .mission-canvas-card,
      .utility-card {
        padding: 16px;
      }
      .step-rail-card,
      .utility-stack {
        position: sticky;
        top: 20px;
      }
      .step-rail-copy {
        margin-bottom: 14px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
      }
      .step-rail {
        display: grid;
        gap: 10px;
      }
      .step-link {
        border: 1px solid var(--line);
        background: rgba(15, 23, 42, 0.58);
        color: var(--text);
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 10px;
        text-align: left;
        padding: 10px 12px;
      }
      .step-link[data-step-depth="1"] { margin-left: 10px; }
      .step-link[data-step-depth="2"] { margin-left: 20px; }
      .step-link:hover,
      .step-link.active {
        border-color: var(--line-strong);
      }
      .step-index {
        font-size: 11px;
        letter-spacing: 0.1em;
        color: var(--accent);
      }
      .step-text {
        font-size: 12px;
        line-height: 1.45;
      }
      .mission-main {
        display: grid;
        gap: 16px;
      }
      .mission-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .mission-title {
        margin: 6px 0 6px;
        font-size: 24px;
        line-height: 1.1;
      }
      .mission-subtitle {
        margin: 0;
        color: var(--muted);
        line-height: 1.55;
      }
      .mission-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
      }
      .status-stack {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }
      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        border: 1px solid var(--line);
        font-size: 12px;
      }
      .status-chip.active {
        border-color: rgba(110, 231, 216, 0.42);
        color: var(--accent);
      }
      .status-chip.success {
        border-color: rgba(74, 222, 128, 0.36);
        color: var(--success);
      }
      .status-chip.danger {
        border-color: rgba(251, 113, 133, 0.34);
        color: var(--danger);
      }
      .status-chip.subtle {
        color: var(--muted);
      }
      .render-mode-group {
        display: inline-flex;
        gap: 8px;
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.54);
      }
      .render-mode-button {
        width: auto;
        border-radius: 999px;
        padding: 8px 12px;
        background: transparent;
        color: var(--muted);
      }
      .render-mode-button.active {
        background: linear-gradient(135deg, rgba(110, 231, 216, 0.18), rgba(116, 192, 252, 0.22));
        color: var(--text);
      }
      .mission-canvas {
        min-height: 420px;
      }
      .mission-empty,
      .mission-live-card,
      .raw-pane,
      .render-pane {
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        background: rgba(9, 16, 28, 0.68);
        overflow: hidden;
      }
      .mission-empty {
        padding: 28px;
      }
      .mission-empty h3 {
        margin: 0 0 10px;
        font-size: 22px;
      }
      .mission-empty p,
      .mission-empty li {
        color: var(--muted);
        line-height: 1.7;
      }
      .mission-empty ul {
        margin: 16px 0 0;
        padding-left: 18px;
      }
      .mission-live-topbar,
      .pane-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--line);
        background: rgba(15, 23, 42, 0.44);
      }
      .live-label {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--text);
        font-size: 13px;
        font-weight: 700;
      }
      .live-pulse {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 0 rgba(110, 231, 216, 0.55);
        animation: orbitforge-pulse 1.6s infinite;
      }
      @keyframes orbitforge-pulse {
        0% { box-shadow: 0 0 0 0 rgba(110, 231, 216, 0.5); }
        70% { box-shadow: 0 0 0 12px rgba(110, 231, 216, 0); }
        100% { box-shadow: 0 0 0 0 rgba(110, 231, 216, 0); }
      }
      .live-copy,
      .utility-button,
      .section-anchor,
      .of-code-copy {
        width: auto;
        padding: 8px 12px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.58);
        color: var(--text);
        font-size: 12px;
      }
      .live-transcript,
      .raw-transcript {
        margin: 0;
        padding: 18px;
        white-space: pre-wrap;
        line-height: 1.7;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        color: var(--text);
      }
      .mission-view-grid {
        display: grid;
        gap: 16px;
      }
      .mission-view-grid.split {
        grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
      }
      .render-pane .pane-topbar,
      .raw-pane .pane-topbar {
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .mission-body {
        padding: 18px;
      }
      .mission-body > :first-child { margin-top: 0; }
      .mission-body > :last-child { margin-bottom: 0; }
      .mission-body p,
      .mission-body li,
      .mission-body blockquote {
        line-height: 1.75;
      }
      .mission-body h1,
      .mission-body h2,
      .mission-body h3,
      .mission-body h4 {
        margin: 0;
        font-size: 18px;
      }
      .mission-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
        overflow: hidden;
        border-radius: 12px;
      }
      .mission-body th,
      .mission-body td {
        border: 1px solid var(--line);
        padding: 10px 12px;
        text-align: left;
      }
      .mission-body th {
        background: rgba(15, 23, 42, 0.54);
      }
      .mission-body blockquote {
        margin: 12px 0;
        padding: 10px 14px;
        border-left: 3px solid rgba(110, 231, 216, 0.5);
        background: rgba(15, 23, 42, 0.38);
        color: var(--text);
      }
      .mission-body a {
        color: var(--accent-2);
        text-decoration: none;
      }
      .mission-body a:hover {
        text-decoration: underline;
      }
      .mission-body code:not(.shiki code) {
        background: rgba(15, 23, 42, 0.58);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 0.2em 0.4em;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.92em;
      }
      .mission-section {
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        margin-bottom: 14px;
        background: rgba(15, 23, 42, 0.34);
      }
      .mission-section summary {
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        cursor: pointer;
      }
      .mission-section summary::-webkit-details-marker {
        display: none;
      }
      .mission-section-label {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
      }
      .mission-section-index {
        color: var(--accent);
        font-size: 11px;
        letter-spacing: 0.1em;
      }
      .mission-section-body {
        padding: 0 16px 16px;
      }
      .mission-section-body > :first-child {
        margin-top: 0;
      }
      .mission-section-body > :last-child {
        margin-bottom: 0;
      }
      .of-code-frame {
        margin: 14px 0;
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .of-code-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
      }
      .of-code-meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .of-code-badge,
      .of-code-family {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 11px;
        letter-spacing: 0.08em;
      }
      .of-code-frame[data-family="docs"] .of-code-toolbar {
        background: linear-gradient(90deg, rgba(245, 158, 11, 0.16), rgba(245, 158, 11, 0.05));
      }
      .of-code-frame[data-family="script"] .of-code-toolbar {
        background: linear-gradient(90deg, rgba(110, 231, 216, 0.16), rgba(110, 231, 216, 0.05));
      }
      .of-code-frame[data-family="typed"] .of-code-toolbar {
        background: linear-gradient(90deg, rgba(116, 192, 252, 0.16), rgba(116, 192, 252, 0.05));
      }
      .of-code-frame[data-family="data"] .of-code-toolbar {
        background: linear-gradient(90deg, rgba(167, 139, 250, 0.16), rgba(167, 139, 250, 0.05));
      }
      .of-code-frame[data-family="generic"] .of-code-toolbar {
        background: linear-gradient(90deg, rgba(148, 163, 184, 0.16), rgba(148, 163, 184, 0.05));
      }
      .of-code-surface .shiki,
      .of-plain-code {
        margin: 0;
        padding: 18px !important;
        overflow-x: auto;
        background: transparent !important;
      }
      .utility-stack {
        display: grid;
        gap: 16px;
      }
      .utility-card p,
      .utility-card li {
        color: var(--muted);
        line-height: 1.7;
        font-size: 13px;
      }
      .utility-stat-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .utility-stat {
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        padding: 12px;
        background: rgba(15, 23, 42, 0.42);
      }
      .utility-stat strong {
        display: block;
        font-size: 18px;
        margin-top: 6px;
      }
      .utility-button-row {
        display: grid;
        gap: 10px;
      }
      .utility-list {
        margin: 10px 0 0;
        padding-left: 18px;
      }
      .legend-grid {
        display: grid;
        gap: 8px;
      }
      .legend-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(15, 23, 42, 0.42);
        font-size: 12px;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
      }
      .legend-docs { background: #f59e0b; }
      .legend-script { background: #6ee7d8; }
      .legend-typed { background: #74c0fc; }
      .legend-data { background: #a78bfa; }
      .legend-generic { background: #94a3b8; }

      @media (max-width: 1220px) {
        .mission-shell {
          grid-template-columns: 220px minmax(0, 1fr);
        }
        .utility-stack {
          grid-column: 1 / -1;
          position: static;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .utility-card {
          min-width: 0;
        }
      }
      @media (max-width: 940px) {
        .grid,
        .mission-shell,
        .mission-view-grid.split,
        .utility-stack {
          grid-template-columns: 1fr;
        }
        .step-rail-card,
        .utility-stack {
          position: static;
        }
        .mission-header {
          flex-direction: column;
        }
        .status-stack {
          justify-content: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero card">
        <div class="eyebrow">OrbitForge interactive workspace</div>
        <h1>Guide the agents like Claude Code, steer lifecycles like n8n, keep everything in VS Code.</h1>
        <p>Use presets, slash commands, blueprints, and rerunnable mission history without losing the active workspace context.</p>
        <div id="context-grid" class="context-grid">${renderContextCards(snapshot)}</div>
      </section>

      <section class="timeline card">
        <div class="section-title">Mission timeline</div>
        <div id="timeline-row" class="timeline-row">${renderTimeline(timelineStage)}</div>
      </section>

      <section class="glass card">
        <div class="section-title">Mission sessions</div>
        <div id="session-tabs" class="session-tabs"></div>
        <div id="session-meta" class="session-meta">Start a mission to create a session tab.</div>
      </section>

      <section class="mission-shell">
        <aside class="step-rail-card">
          <div class="section-title">Step rail</div>
          <div class="step-rail-copy">OrbitForge turns long agent output into a clickable mission map so you can jump between the board, lane arguments, risks, and validation proof.</div>
          <div id="step-rail" class="step-rail"></div>
        </aside>

        <div class="mission-main">
          <section class="mission-header-card">
            <div id="mission-header" class="mission-header"></div>
            <div class="mission-toolbar">
              <div class="render-mode-group">
                <button type="button" class="render-mode-button active" data-render-mode="rendered">Rendered</button>
                <button type="button" class="render-mode-button" data-render-mode="raw">Raw</button>
                <button type="button" class="render-mode-button" data-render-mode="split">Split</button>
              </div>
              <div class="hint">Rendered gives you the polished brief, Raw keeps the transcript exact, Split shows both.</div>
            </div>
          </section>

          <section class="mission-canvas-card">
            <div id="mission-canvas" class="mission-canvas"></div>
          </section>
        </div>

        <aside id="utility-panel" class="utility-stack"></aside>
      </section>

      <div class="grid">
        <section class="glass card">
          <div class="section-title">Pinned presets</div>
          <div id="pinned-grid" class="preset-grid">${renderPinnedPresetCards(pinnedPresets)}</div>
          <div class="hint">Use /pin &lt;preset-id&gt; to keep a preset here.</div>
        </section>

        <section class="glass card">
          <div class="section-title">Preset launches</div>
          <div class="preset-grid">${renderPresetCards()}</div>
          <div class="hint">Presets rewrite the mission prompt, workflow, and context scope so you can get to a strong run in one click.</div>
          <div class="section-title" style="margin-top: 18px;">Slash commands</div>
          <div class="slash-row">${renderSlashHints()}</div>
          <div class="hint">Type slash commands directly into the mission prompt to reconfigure the session, run a blueprint, inspect history, or rerun a saved mission.</div>
        </section>
      </div>

      <div class="grid">
        <section class="glass card">
          <div class="section-title">Runtime lane</div>
          <label>
            <div class="label"><span>Provider</span><span>Choose the active runtime</span></div>
            <select id="provider">
              <option value="ollama"${snapshot.provider === 'ollama' ? ' selected' : ''}>Ollama</option>
              <option value="lmstudio"${snapshot.provider === 'lmstudio' ? ' selected' : ''}>LM Studio</option>
              <option value="openai"${snapshot.provider === 'openai' ? ' selected' : ''}>OpenAI</option>
              <option value="anthropic"${snapshot.provider === 'anthropic' ? ' selected' : ''}>Anthropic</option>
              <option value="openrouter"${snapshot.provider === 'openrouter' ? ' selected' : ''}>OpenRouter</option>
              <option value="openai-compatible"${snapshot.provider === 'openai-compatible' ? ' selected' : ''}>OpenAI-compatible</option>
            </select>
          </label>
          <label>
            <div class="label"><span>Base URL</span><span>Runtime endpoint</span></div>
            <input id="baseUrl" value="${escapeHtml(snapshot.baseUrl)}" />
          </label>
          <label>
            <div class="label"><span>Model</span><span>Used for the next mission</span></div>
            <input id="model" value="${escapeHtml(snapshot.model)}" />
          </label>
          <div id="runtime-note" class="runtime-note"></div>
          <div id="model-chip-row" class="model-chip-row"></div>
          <div class="button-row">
            <button class="secondary" id="refreshRuntime">Refresh Runtime</button>
            <button class="ghost" id="saveRuntime">Save Runtime</button>
          </div>
        </section>

        <section class="glass card">
          <div class="section-title">Mission composer</div>
          <label>
            <div class="label"><span>Execution mode</span><span>Single or dissent-driven</span></div>
            <select id="mode">
              <option value="single"${initialMode === 'single' ? ' selected' : ''}>Single lane</option>
              <option value="parallel"${initialMode === 'parallel' ? ' selected' : ''}>Parallel trio</option>
            </select>
          </label>
          <label>
            <div class="label"><span>Workflow</span><span>Changes the mission board and gate logic</span></div>
            <select id="workflow">
              <option value="general"${initialWorkflow === 'general' ? ' selected' : ''}>General Build</option>
              <option value="review"${initialWorkflow === 'review' ? ' selected' : ''}>Parallel Review</option>
              <option value="migration"${initialWorkflow === 'migration' ? ' selected' : ''}>Migration Flight Plan</option>
              <option value="incident"${initialWorkflow === 'incident' ? ' selected' : ''}>Incident Command</option>
              <option value="release"${initialWorkflow === 'release' ? ' selected' : ''}>Release Gate</option>
            </select>
          </label>
          <label>
            <div class="label"><span>Context scope</span><span>What the agents should ground themselves in</span></div>
            <select id="scope">
              <option value="workspace">Workspace</option>
              <option value="selection">Selection</option>
              <option value="workspace+selection">Workspace + selection</option>
            </select>
          </label>
          <label>
            <div class="label"><span>Mission prompt</span><span>Supports custom runs and slash commands</span></div>
            <textarea id="prompt">Inspect the current workspace, produce the next implementation plan, validation steps, and the proof needed before calling the work done.</textarea>
          </label>
          <div class="button-row">
            <button class="primary" id="run">Run Mission</button>
            <button class="secondary" id="refresh">Refresh Context</button>
            <button class="ghost" id="selectionPreset">Use Selection Review</button>
          </div>
          <div class="button-row">
            <button class="secondary" id="createBranch">Create Git Branch</button>
            <button class="ghost" id="proposeDiff">Propose Diff</button>
          </div>
          <div id="status" class="status"></div>
        </section>

        <section class="glass card">
          <div class="section-title">Mission history</div>
          <div class="button-row" style="margin-bottom: 10px;">
            <button class="secondary" id="exportHistory">Export History</button>
          </div>
          <div id="history-stack" class="history-stack">${renderHistoryCards(historyEntries)}</div>
        </section>
      </div>

      <section class="logs card">
        <div class="section-title">Run log</div>
        <ul id="log-list" class="log-list">
          <li class="log-entry">Ready. Launch a mission to watch OrbitForge stage context, lanes, and history updates.</li>
        </ul>
      </section>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const initialClientState = ${initialClientState};
      const status = document.getElementById('status');
      const prompt = document.getElementById('prompt');
      const provider = document.getElementById('provider');
      const baseUrl = document.getElementById('baseUrl');
      const model = document.getElementById('model');
      const mode = document.getElementById('mode');
      const workflow = document.getElementById('workflow');
      const scope = document.getElementById('scope');
      const runtimeNote = document.getElementById('runtime-note');
      const modelChipRow = document.getElementById('model-chip-row');
      const contextGrid = document.getElementById('context-grid');
      const historyStack = document.getElementById('history-stack');
      const pinnedGrid = document.getElementById('pinned-grid');
      const sessionTabs = document.getElementById('session-tabs');
      const sessionMeta = document.getElementById('session-meta');
      const logList = document.getElementById('log-list');
      const timelineRow = document.getElementById('timeline-row');
      const stepRail = document.getElementById('step-rail');
      const missionHeader = document.getElementById('mission-header');
      const missionCanvas = document.getElementById('mission-canvas');
      const utilityPanel = document.getElementById('utility-panel');
      const sessions = [];
      let activeSessionId = null;
      let renderMode = 'rendered';

      const setStatus = (value) => {
        status.textContent = value || '';
      };

      const escapeHtmlClient = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      const clearLogs = () => {
        logList.innerHTML = '';
      };

      const addLog = (value) => {
        const li = document.createElement('li');
        li.className = 'log-entry';
        li.textContent = value;
        logList.prepend(li);
      };

      const renderModelChips = (models) => {
        modelChipRow.innerHTML = (models || [])
          .map((entry) => '<button class="model-chip" data-model-chip="' + entry + '">' + entry + '</button>')
          .join('');
      };

      const getSession = (id) => sessions.find((session) => session.id === id);
      const getActiveSession = () => getSession(activeSessionId) || sessions[0] || null;

      const copyText = async (value, successMessage) => {
        if (!value) {
          return;
        }
        try {
          await navigator.clipboard.writeText(value);
          setStatus(successMessage || 'Copied.');
        } catch {
          const area = document.createElement('textarea');
          area.value = value;
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
          setStatus(successMessage || 'Copied.');
        }
      };

      const statusTone = (value) => {
        const normalized = String(value || '').toLowerCase();
        if (!normalized) return 'subtle';
        if (normalized.includes('fail') || normalized.includes('error')) return 'danger';
        if (normalized.includes('running') || normalized.includes('stream')) return 'active';
        if (
          normalized.includes('complete') ||
          normalized.includes('saved') ||
          normalized.includes('loaded') ||
          normalized.includes('restored')
        ) return 'success';
        return 'subtle';
      };

      const renderModeButtons = () => {
        document.querySelectorAll('[data-render-mode]').forEach((button) => {
          const active = button.dataset.renderMode === renderMode;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      };

      const renderMissionHeader = (session) => {
        if (!session) {
          missionHeader.innerHTML =
            '<div><div class="eyebrow">Mission surface</div><h2 class="mission-title">Compose, run, inspect, act.</h2><p class="mission-subtitle">OrbitForge keeps your run bounded, readable, and reviewable. Start with a preset or write a custom mission below.</p></div>' +
            '<div class="status-stack"><span class="status-chip subtle">Idle</span></div>';
          return;
        }

        missionHeader.innerHTML =
          '<div>' +
            '<div class="eyebrow">Mission surface</div>' +
            '<h2 class="mission-title">' + escapeHtmlClient(session.title || 'Mission') + '</h2>' +
            '<p class="mission-subtitle">' + escapeHtmlClient(session.summary || 'OrbitForge is staging the mission output into a structured brief.') + '</p>' +
          '</div>' +
          '<div class="status-stack">' +
            '<span class="status-chip ' + statusTone(session.status) + '">' + escapeHtmlClient(session.status || 'running') + '</span>' +
            '<span class="status-chip subtle">' + escapeHtmlClient(session.source || 'panel') + '</span>' +
          '</div>';
      };

      const renderStepRail = (session) => {
        if (!session) {
          stepRail.innerHTML = '<div class="empty-state">Run a mission to generate a clickable section map.</div>';
          return;
        }

        const headings = Array.isArray(session.headings) && session.headings.length
          ? session.headings
          : [{ id: 'mission-live', text: 'Live transcript', level: 1 }];

        stepRail.innerHTML = headings
          .map((heading, index) => {
            const depth = Math.max(0, Math.min(2, Number(heading.level || 1) - 1));
            return '<button class="step-link" data-step-target="' + escapeHtmlClient(heading.id) + '" data-step-depth="' + depth + '">' +
              '<span class="step-index">' + String(index + 1).padStart(2, '0') + '</span>' +
              '<span class="step-text">' + escapeHtmlClient(heading.text || ('Section ' + (index + 1))) + '</span>' +
            '</button>';
          })
          .join('');
      };

      const renderUtilityPanel = (session) => {
        if (!session) {
          utilityPanel.innerHTML =
            '<section class="utility-card">' +
              '<div class="section-title">Why this surface exists</div>' +
              '<p>OrbitForge turns raw agent output into a bounded mission brief so release gates, risks, and validation proof are harder to miss.</p>' +
              '<ul class="utility-list">' +
                '<li>Rendered mode is optimized for reading and sharing.</li>' +
                '<li>Raw mode keeps the exact markdown and transcript.</li>' +
                '<li>Split mode helps you verify how the polished brief maps to the underlying output.</li>' +
              '</ul>' +
            '</section>' +
            '<section class="utility-card">' +
              '<div class="section-title">Execution tips</div>' +
              '<div class="utility-button-row">' +
                '<button type="button" class="utility-button" data-run-helper="preset">Load a preset below</button>' +
                '<button type="button" class="utility-button" data-run-helper="runtime">Refresh runtime before a run</button>' +
              '</div>' +
            '</section>' +
            '<section class="utility-card">' +
              '<div class="section-title">Code color legend</div>' +
              '<div class="legend-grid">' +
                '<span class="legend-chip"><span class="legend-dot legend-docs"></span>Docs / Markdown</span>' +
                '<span class="legend-chip"><span class="legend-dot legend-script"></span>Scripts / Shell / Python</span>' +
                '<span class="legend-chip"><span class="legend-dot legend-typed"></span>Typed / Compiled</span>' +
                '<span class="legend-chip"><span class="legend-dot legend-data"></span>Data / Config / Diff</span>' +
                '<span class="legend-chip"><span class="legend-dot legend-generic"></span>Fallback</span>' +
              '</div>' +
            '</section>';
          return;
        }

        utilityPanel.innerHTML =
          '<section class="utility-card">' +
            '<div class="section-title">Mission stats</div>' +
            '<div class="utility-stat-grid">' +
              '<div class="utility-stat"><span>Sections</span><strong>' + String((session.headings || []).length || 1) + '</strong></div>' +
              '<div class="utility-stat"><span>Code blocks</span><strong>' + String((session.codeBlocks || []).length) + '</strong></div>' +
              '<div class="utility-stat"><span>Mode</span><strong>' + escapeHtmlClient(renderMode) + '</strong></div>' +
              '<div class="utility-stat"><span>Source</span><strong>' + escapeHtmlClient(session.source || 'panel') + '</strong></div>' +
            '</div>' +
          '</section>' +
          '<section class="utility-card">' +
            '<div class="section-title">Quick actions</div>' +
            '<div class="utility-button-row">' +
              '<button type="button" class="utility-button" data-copy-session="rendered">Copy rendered text</button>' +
              '<button type="button" class="utility-button" data-copy-session="raw">Copy raw markdown</button>' +
            '</div>' +
            '<p>' + escapeHtmlClient(session.summary || 'No summary yet.') + '</p>' +
          '</section>' +
          '<section class="utility-card">' +
            '<div class="section-title">Code color legend</div>' +
            '<div class="legend-grid">' +
              '<span class="legend-chip"><span class="legend-dot legend-docs"></span>Docs / Markdown</span>' +
              '<span class="legend-chip"><span class="legend-dot legend-script"></span>Scripts / Shell / Python</span>' +
              '<span class="legend-chip"><span class="legend-dot legend-typed"></span>Typed / Compiled</span>' +
              '<span class="legend-chip"><span class="legend-dot legend-data"></span>Data / Config / Diff</span>' +
              '<span class="legend-chip"><span class="legend-dot legend-generic"></span>Fallback</span>' +
            '</div>' +
          '</section>';
      };

      const decorateMissionSections = (container) => {
        const sections = [];
        let current = null;
        Array.from(container.childNodes).forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(node.nodeName)) {
            if (current) {
              sections.push(current);
            }
            current = { heading: node, nodes: [] };
            return;
          }
          if (!current) {
            current = { heading: null, nodes: [] };
          }
          current.nodes.push(node);
        });
        if (current) {
          sections.push(current);
        }

        if (!sections.length) {
          return;
        }

        const fragment = document.createDocumentFragment();
        sections.forEach((section, index) => {
          const details = document.createElement('details');
          const title = section.heading ? section.heading.textContent.trim() : (index === 0 ? 'Overview' : 'Section ' + (index + 1));
          const id = section.heading && section.heading.id ? section.heading.id : ('mission-section-' + (index + 1));
          details.className = 'mission-section';
          details.dataset.sectionId = id;
          details.id = id;
          details.open = index === 0 || /summary|overview|mission board|recommendation|next steps|validation/i.test(title);

          const summary = document.createElement('summary');
          summary.innerHTML =
            '<div class="mission-section-label">' +
              '<span class="mission-section-index">' + String(index + 1).padStart(2, '0') + '</span>' +
              '<span>' + escapeHtmlClient(title) + '</span>' +
            '</div>' +
            '<button type="button" class="section-anchor" data-copy-anchor="' + escapeHtmlClient(id) + '">Copy link</button>';

          const body = document.createElement('div');
          body.className = 'mission-section-body';
          section.nodes.forEach((node) => {
            body.appendChild(node);
          });

          details.appendChild(summary);
          details.appendChild(body);
          fragment.appendChild(details);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
      };

      const hydrateRenderedPane = (session) => {
        const renderedPane = missionCanvas.querySelector('[data-rendered-pane]');
        if (!renderedPane) {
          return;
        }

        renderedPane.innerHTML = session.renderedHtml || '<p class="empty-state">No rendered response available yet.</p>';
        decorateMissionSections(renderedPane);
      };

      const renderMissionCanvas = (session) => {
        if (!session) {
          missionCanvas.innerHTML =
            '<div class="mission-empty">' +
              '<div class="eyebrow">Ready lane</div>' +
              '<h3>Run a mission and OrbitForge will shape the response into a bounded brief.</h3>' +
              '<p>' + escapeHtmlClient(initialClientState.welcomeText) + '</p>' +
              '<ul>' +
                '<li>Use a preset for the fastest guided run.</li>' +
                '<li>Switch runtime directly in the panel before launching.</li>' +
                '<li>Use Split mode when you want polished output and raw transcript side by side.</li>' +
              '</ul>' +
            '</div>';
          return;
        }

        const running = statusTone(session.status) === 'active';
        if (running) {
          missionCanvas.innerHTML =
            '<div class="mission-live-card" data-section-id="mission-live" id="mission-live">' +
              '<div class="mission-live-topbar">' +
                '<div class="live-label"><span class="live-pulse"></span>Live transcript</div>' +
                '<button type="button" class="live-copy" data-copy-session="raw">Copy live output</button>' +
              '</div>' +
              '<pre class="live-transcript">' + escapeHtmlClient(session.output || 'Waiting for provider stream...') + '</pre>' +
            '</div>';
          return;
        }

        if (renderMode === 'raw') {
          missionCanvas.innerHTML =
            '<section class="raw-pane">' +
              '<div class="pane-topbar"><div class="live-label">Raw markdown</div><button type="button" class="live-copy" data-copy-session="raw">Copy raw</button></div>' +
              '<pre class="raw-transcript">' + escapeHtmlClient(session.output || '') + '</pre>' +
            '</section>';
          return;
        }

        if (renderMode === 'split') {
          missionCanvas.innerHTML =
            '<div class="mission-view-grid split">' +
              '<section class="render-pane">' +
                '<div class="pane-topbar"><div class="live-label">Rendered mission</div><button type="button" class="live-copy" data-copy-session="rendered">Copy rendered text</button></div>' +
                '<article class="mission-body" data-rendered-pane></article>' +
              '</section>' +
              '<section class="raw-pane">' +
                '<div class="pane-topbar"><div class="live-label">Raw markdown</div><button type="button" class="live-copy" data-copy-session="raw">Copy raw</button></div>' +
                '<pre class="raw-transcript">' + escapeHtmlClient(session.output || '') + '</pre>' +
              '</section>' +
            '</div>';
          hydrateRenderedPane(session);
          return;
        }

        missionCanvas.innerHTML =
          '<section class="render-pane">' +
            '<div class="pane-topbar"><div class="live-label">Rendered mission</div><button type="button" class="live-copy" data-copy-session="rendered">Copy rendered text</button></div>' +
            '<article class="mission-body" data-rendered-pane></article>' +
          '</section>';
        hydrateRenderedPane(session);
      };

      const renderSessions = () => {
        if (!sessions.length) {
          sessionTabs.innerHTML = '';
          sessionMeta.textContent = 'Start a mission to create a session tab.';
          renderMissionHeader(null);
          renderStepRail(null);
          renderUtilityPanel(null);
          renderMissionCanvas(null);
          renderModeButtons();
          return;
        }
        sessionTabs.innerHTML = sessions
          .map((session) => {
            const active = session.id === activeSessionId ? 'active' : '';
            return '<button class="session-tab ' + active + '" data-session-id="' + session.id + '">' + session.title + '</button>';
          })
          .join('');
        const activeSession = getSession(activeSessionId) || sessions[0];
        if (activeSession) {
          activeSessionId = activeSession.id;
          sessionMeta.textContent = activeSession.source + ' • ' + (activeSession.status || 'running');
          renderMissionHeader(activeSession);
          renderStepRail(activeSession);
          renderUtilityPanel(activeSession);
          renderMissionCanvas(activeSession);
        }
        renderModeButtons();
      };

      const upsertSession = ({ id, title, source }) => {
        const existing = getSession(id);
        if (existing) {
          existing.title = title || existing.title;
          existing.source = source || existing.source;
        } else {
          sessions.unshift({
            id,
            title,
            source,
            output: '',
            renderedHtml: '',
            headings: [],
            codeBlocks: [],
            status: 'running',
            summary: '',
          });
        }
        activeSessionId = id;
        renderSessions();
      };

      const updateSessionOutput = (id, chunk, reset) => {
        const session = getSession(id);
        if (!session) {
          return;
        }
        if (reset) {
          session.output = '';
        }
        session.output += chunk;
        session.status = 'running';
        if (session.id === activeSessionId) {
          renderMissionHeader(session);
          renderStepRail(session);
          renderMissionCanvas(session);
        }
      };

      const finalizeSession = ({ id, status, outputText, summary, renderedHtml, headings, codeBlocks }) => {
        const session = getSession(id);
        if (!session) {
          return;
        }
        session.status = status || session.status;
        if (typeof outputText === 'string' && outputText) {
          session.output = outputText;
        }
        if (summary) {
          session.summary = summary;
        }
        if (typeof renderedHtml === 'string') {
          session.renderedHtml = renderedHtml;
        }
        if (Array.isArray(headings)) {
          session.headings = headings;
        }
        if (Array.isArray(codeBlocks)) {
          session.codeBlocks = codeBlocks;
        }
        if (session.id === activeSessionId) {
          sessionMeta.textContent = session.source + ' • ' + session.status;
          renderMissionHeader(session);
          renderStepRail(session);
          renderUtilityPanel(session);
          renderMissionCanvas(session);
        }
      };

      document.querySelectorAll('[data-preset-id]').forEach((button) => {
        button.addEventListener('click', () => {
          prompt.value = button.dataset.prompt || prompt.value;
          mode.value = button.dataset.mode || mode.value;
          workflow.value = button.dataset.workflow || workflow.value;
          scope.value = button.dataset.scope || scope.value;
          setStatus('Preset loaded. Adjust anything you want before running.');
        });
      });

      document.querySelectorAll('[data-slash]').forEach((button) => {
        button.addEventListener('click', () => {
          prompt.value = button.dataset.slash || prompt.value;
          setStatus('Slash command loaded. Run Mission to execute it.');
        });
      });

      document.getElementById('selectionPreset').addEventListener('click', () => {
        const review = document.querySelector('[data-preset-id="selection-review"]');
        if (!review) {
          return;
        }
        prompt.value = review.dataset.prompt || prompt.value;
        mode.value = review.dataset.mode || mode.value;
        workflow.value = review.dataset.workflow || workflow.value;
        scope.value = review.dataset.scope || scope.value;
        setStatus('Selection review loaded.');
      });

      document.getElementById('run').addEventListener('click', () => {
        clearLogs();
        setStatus('Running OrbitForge mission...');
        const sessionId = 'session-' + Date.now();
        upsertSession({ id: sessionId, title: 'Mission', source: 'panel-mission' });
        vscode.postMessage({
          type: 'runPrompt',
          provider: provider.value,
          baseUrl: baseUrl.value,
          model: model.value,
          prompt: prompt.value,
          mode: mode.value,
          workflow: workflow.value,
          contextScope: scope.value,
          sessionId
        });
      });

      document.getElementById('createBranch').addEventListener('click', () => {
        vscode.postMessage({
          type: 'createBranch',
          prompt: prompt.value
        });
      });

      document.getElementById('proposeDiff').addEventListener('click', () => {
        vscode.postMessage({ type: 'proposeDiff' });
      });

      document.getElementById('refresh').addEventListener('click', () => {
        setStatus('Refreshing workspace context...');
        vscode.postMessage({ type: 'refreshContext' });
      });

      document.getElementById('refreshRuntime').addEventListener('click', () => {
        setStatus('Refreshing runtime availability...');
        vscode.postMessage({
          type: 'refreshRuntime',
          provider: provider.value,
          baseUrl: baseUrl.value,
          model: model.value,
          mode: mode.value,
          workflow: workflow.value
        });
      });

      document.getElementById('saveRuntime').addEventListener('click', () => {
        setStatus('Saving runtime settings...');
        vscode.postMessage({
          type: 'saveRuntime',
          provider: provider.value,
          baseUrl: baseUrl.value,
          model: model.value,
          mode: mode.value,
          workflow: workflow.value
        });
      });

      historyStack.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const action = target.dataset.historyAction;
        const historyId = target.dataset.historyId;
        if (!action || !historyId) {
          return;
        }
        if (action === 'rerun') {
          clearLogs();
        }
        vscode.postMessage({
          type: 'historyAction',
          action,
          historyId
        });
      });

      sessionTabs.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const button = target.closest('[data-session-id]');
        if (!button) {
          return;
        }
        activeSessionId = button.dataset.sessionId;
        renderSessions();
      });

      document.getElementById('exportHistory').addEventListener('click', () => {
        vscode.postMessage({ type: 'exportHistory' });
      });

      pinnedGrid.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const presetButton = target.closest('[data-preset-id]');
        if (!presetButton) {
          return;
        }
        prompt.value = presetButton.dataset.prompt || prompt.value;
        mode.value = presetButton.dataset.mode || mode.value;
        workflow.value = presetButton.dataset.workflow || workflow.value;
        scope.value = presetButton.dataset.scope || scope.value;
        setStatus('Pinned preset loaded.');
      });

      modelChipRow.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const chip = target.closest('[data-model-chip]');
        if (!chip) {
          return;
        }
        model.value = chip.dataset.modelChip || model.value;
        setStatus('Runtime model updated from detected options.');
      });

      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const renderToggle = target.closest('[data-render-mode]');
        if (renderToggle) {
          renderMode = renderToggle.dataset.renderMode || renderMode;
          renderSessions();
          return;
        }

        const stepTarget = target.closest('[data-step-target]');
        if (stepTarget) {
          const sectionId = stepTarget.dataset.stepTarget;
          const section = missionCanvas.querySelector('[data-section-id="' + sectionId + '"]');
          if (section instanceof HTMLDetailsElement) {
            section.open = true;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }

        const helper = target.closest('[data-run-helper]');
        if (helper) {
          if (helper.dataset.runHelper === 'preset') {
            const preset = document.querySelector('[data-preset-id="workspace-plan"]');
            if (preset instanceof HTMLElement) {
              preset.click();
            }
          }
          if (helper.dataset.runHelper === 'runtime') {
            document.getElementById('refreshRuntime').click();
          }
          return;
        }

        const copyAnchor = target.closest('[data-copy-anchor]');
        if (copyAnchor) {
          event.preventDefault();
          event.stopPropagation();
          copyText('#' + (copyAnchor.dataset.copyAnchor || ''), 'Section link copied.');
          return;
        }

        const copyCode = target.closest('[data-copy-code]');
        if (copyCode) {
          const session = getActiveSession();
          if (!session) {
            return;
          }
          const block = (session.codeBlocks || []).find((entry) => entry.id === copyCode.dataset.copyCode);
          copyText(block ? block.content : '', 'Code block copied.');
          return;
        }

        const copySession = target.closest('[data-copy-session]');
        if (copySession) {
          const session = getActiveSession();
          if (!session) {
            return;
          }
          if (copySession.dataset.copySession === 'rendered') {
            const renderedPane = missionCanvas.querySelector('[data-rendered-pane]');
            copyText(renderedPane ? renderedPane.innerText : session.output, 'Rendered mission copied.');
            return;
          }
          copyText(session.output || '', 'Raw mission copied.');
        }
      });

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'sessionStart') {
          upsertSession({ id: message.sessionId, title: message.title || 'Mission', source: message.source || 'panel' });
        }
        if (message.type === 'result') {
          finalizeSession({
            id: message.sessionId || activeSessionId,
            status: message.status || 'complete',
            outputText: message.output,
            summary: message.summary,
            renderedHtml: message.renderedHtml,
            headings: message.headings,
            codeBlocks: message.codeBlocks
          });
          setStatus(message.status || 'Run complete.');
        }
        if (message.type === 'context') {
          contextGrid.innerHTML = message.html;
        }
        if (message.type === 'history') {
          historyStack.innerHTML = message.html;
        }
        if (message.type === 'pins') {
          pinnedGrid.innerHTML = message.html;
        }
        if (message.type === 'timeline') {
          timelineRow.innerHTML = message.html;
        }
        if (message.type === 'controls') {
          if (typeof message.provider === 'string') provider.value = message.provider;
          if (typeof message.baseUrl === 'string') baseUrl.value = message.baseUrl;
          if (typeof message.model === 'string') model.value = message.model;
          if (typeof message.prompt === 'string') prompt.value = message.prompt;
          if (typeof message.mode === 'string') mode.value = message.mode;
          if (typeof message.workflow === 'string') workflow.value = message.workflow;
          if (typeof message.contextScope === 'string') scope.value = message.contextScope;
          setStatus(message.status || 'Controls updated.');
        }
        if (message.type === 'runtime') {
          if (typeof message.provider === 'string') provider.value = message.provider;
          if (typeof message.baseUrl === 'string') baseUrl.value = message.baseUrl;
          if (typeof message.model === 'string') model.value = message.model;
          runtimeNote.textContent = message.runtimeNote || '';
          renderModelChips(message.availableModels || []);
          if (message.runtimeNote) {
            setStatus(message.runtimeNote);
          }
        }
        if (message.type === 'clearLog') {
          clearLogs();
        }
        if (message.type === 'log') {
          addLog(message.entry);
        }
        if (message.type === 'stream') {
          updateSessionOutput(message.sessionId || activeSessionId, message.text || '', Boolean(message.reset));
        }
      });

      renderSessions();
    </script>
  </body>
</html>`
}

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBar.text = '$(hubot) OrbitForge'
  statusBar.tooltip = 'Open OrbitForge guided session'
  statusBar.command = 'orbitforge.guidedSession'
  statusBar.show()

  let activePanel: vscode.WebviewPanel | undefined
  let panelRuntimeSettings = getSettings()

  const postRuntimeState = async (panel: vscode.WebviewPanel, settings = panelRuntimeSettings) => {
    const runtime = await collectRuntimePanelState(settings).catch(() => ({
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      configuredModel: settings.model,
      availableModels: [],
      runtimeNote: '',
    }))
    panel.webview.postMessage({
      type: 'runtime',
      provider: runtime.provider,
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      configuredModel: runtime.configuredModel,
      availableModels: runtime.availableModels,
      runtimeNote: runtime.runtimeNote,
    })
  }

  const postPanelState = async (panel: vscode.WebviewPanel, settings = panelRuntimeSettings) => {
    panelRuntimeSettings = settings
    const refreshed = await collectPanelContext(settings)
    panel.webview.postMessage({
      type: 'context',
      html: renderContextCards(refreshed),
    })
    await postRuntimeState(panel, settings)
    panel.webview.postMessage({
      type: 'history',
      html: renderHistoryCards(getMissionHistory(context)),
    })
    panel.webview.postMessage({
      type: 'pins',
      html: renderPinnedPresetCards(getPinnedPresets(context)),
    })
  }

  const pushTimeline = (panel: vscode.WebviewPanel, stage: TimelineStageId) => {
    panel.webview.postMessage({
      type: 'timeline',
      html: renderTimeline(stage),
    })
  }

  const postRenderedResult = async (
    panel: vscode.WebviewPanel,
    payload: {
      sessionId?: string
      title?: string
      summary?: string
      status?: string
      output: string
      renderedHtml?: string
      headings?: MissionHeading[]
      codeBlocks?: MissionCodeBlock[]
    }
  ) => {
    const rendered =
      payload.renderedHtml && payload.headings && payload.codeBlocks
        ? {
            renderedHtml: payload.renderedHtml,
            headings: payload.headings,
            codeBlocks: payload.codeBlocks,
          }
        : await renderMissionOutput(payload.output)

    panel.webview.postMessage({
      type: 'result',
      sessionId: payload.sessionId,
      title: payload.title,
      summary: payload.summary,
      status: payload.status,
      output: payload.output,
      renderedHtml: rendered.renderedHtml,
      headings: rendered.headings,
      codeBlocks: rendered.codeBlocks,
    })
  }

  const runMissionInPanel = async (
    panel: vscode.WebviewPanel,
    mission: {
      title: string
      prompt: string
      mode: AgentMode
      workflow: AgentWorkflow
      contextScope: ContextScope
      blueprint?: OrbitForgeLifecycleBlueprint
      source: string
      sessionId?: string
      settings?: TalentSettings
    }
  ) => {
    const sessionId = mission.sessionId ?? `session-${Date.now()}`
    panel.webview.postMessage({
      type: 'sessionStart',
      sessionId,
      title: mission.title,
      source: mission.source,
    })
    panel.webview.postMessage({ type: 'clearLog' })
    pushTimeline(panel, 'context')

    try {
      const runtimeSettings = mission.settings || panelRuntimeSettings
      const streamEnabled = runtimeSettings.stream && supportsStreaming(runtimeSettings.provider)
      const streamParallel = streamEnabled && mission.mode === 'parallel'
      const laneTitles: Record<string, string> = {
        architect: 'Architect',
        implementer: 'Implementer',
        critic: 'Critic',
        synthesis: 'Synthesizer',
        single: 'Single Lane',
      }
      const seenLanes = new Set<string>()
      let hasReset = false
      const result = await executeMission({
        ...mission,
        extensionContext: context,
        settings: mission.settings,
        onLog: (line) => {
          panel.webview.postMessage({
            type: 'log',
            entry: line,
          })
        },
        onToken: (token) => {
          panel.webview.postMessage({
            type: 'stream',
            sessionId,
            text: token,
            reset: !hasReset,
          })
          hasReset = true
        },
        onAgentToken: (agentId, token) => {
          const laneId = String(agentId)
          const header = seenLanes.has(laneId) ? '' : `\n\n### ${laneTitles[laneId] || laneId}\n\n`
          seenLanes.add(laneId)
          panel.webview.postMessage({
            type: 'stream',
            sessionId,
            text: `${header}${token}`,
            reset: !hasReset,
          })
          hasReset = true
        },
        onStage: (stage) => {
          pushTimeline(panel, stage)
        },
      })

      if (streamEnabled) {
        // streaming already handled via onToken/onAgentToken in requestTalent
        panel.webview.postMessage({
          type: 'log',
          entry: 'Streaming enabled: output delivered live.',
        })
      } else if (mission.mode === 'parallel' && !streamParallel) {
        await streamParallelAgents(panel, sessionId, result.runResult)
      } else {
        await streamOutputToPanel(panel, sessionId, result.output)
      }
      await postRenderedResult(panel, {
        sessionId,
        title: mission.title,
        summary: result.summary,
        status: `Mission complete using ${result.contextLabel.toLowerCase()} context.`,
        output: result.output,
        renderedHtml: result.renderedHtml,
        headings: result.headings,
        codeBlocks: result.codeBlocks,
      })
      await postPanelState(panel, runtimeSettings)
      pushTimeline(panel, 'complete')
    } catch (error) {
      panel.webview.postMessage({
        type: 'log',
        entry: 'Run failed before completion.',
      })
      await postRenderedResult(panel, {
        status: 'Run failed.',
        output: error instanceof Error ? error.message : 'OrbitForge request failed.',
      })
      pushTimeline(panel, 'failed')
    }
  }

  const handleSlashCommand = async (panel: vscode.WebviewPanel, rawPrompt: string) => {
    const [command, ...args] = rawPrompt.trim().split(/\s+/)
    const value = args.join(' ').trim()

    if (command === '/help') {
      await postRenderedResult(panel, {
        status: 'Slash command reference loaded.',
        output: [
          'OrbitForge slash commands:',
          '',
          '/help',
          '/preset workspace-plan',
          '/preset parallel-release',
          '/mode single|parallel',
          '/workflow general|review|migration|incident|release',
          '/scope workspace|selection|workspace+selection',
          '/blueprint parallel-review-kit',
          '/history',
          '/rerun last',
          '/rerun <mission-id>',
          '/pin <preset-id>',
          '/unpin <preset-id>',
          '/pins',
          '/export md',
          '/export json',
          '/branch <name>',
          '/diff <file>',
        ].join('\n'),
      })
      return true
    }

    if (command === '/history') {
      panel.webview.postMessage({
        type: 'history',
        html: renderHistoryCards(getMissionHistory(context)),
      })
      await postRenderedResult(panel, {
        status: 'Loaded recent mission history.',
        output: formatHistoryText(getMissionHistory(context)),
      })
      return true
    }

    if (command === '/pins') {
      const pins = getPinnedPresets(context)
      panel.webview.postMessage({
        type: 'pins',
        html: renderPinnedPresetCards(pins),
      })
      await postRenderedResult(panel, {
        status: 'Pinned presets refreshed.',
        output: pins.length ? `Pinned presets: ${pins.join(', ')}` : 'No pinned presets yet.',
      })
      return true
    }

    if (command === '/export') {
      const format = value === 'json' ? 'json' : 'md'
      await exportMissionHistory(context, format)
      await postRenderedResult(panel, {
        status: 'History export complete.',
        output: `Mission history exported as ${format.toUpperCase()}.`,
      })
      return true
    }

    if (command === '/branch') {
      const scaffold = await createBranchFromPrompt(value || 'orbitforge-work')
      await postRenderedResult(panel, {
        status: 'Branch scaffold ready.',
        output: `Branch: ${scaffold.branch}\nCommit: ${scaffold.commit}`,
      })
      return true
    }

    if (command === '/diff') {
      await proposePatchDiff(context)
      return true
    }

    if (command === '/pin') {
      const preset = findPreset(value)
      if (!preset) {
        await postRenderedResult(panel, {
          status: 'Preset not found.',
          output: `Could not find an OrbitForge preset for "${value}".`,
        })
        return true
      }
      const pins = Array.from(new Set([...getPinnedPresets(context), preset.id]))
      await savePinnedPresets(context, pins)
      panel.webview.postMessage({
        type: 'pins',
        html: renderPinnedPresetCards(pins),
      })
      await postRenderedResult(panel, {
        status: 'Preset pinned.',
        output: `${preset.label} pinned to the panel.`,
      })
      return true
    }

    if (command === '/unpin') {
      const preset = findPreset(value)
      if (!preset) {
        await postRenderedResult(panel, {
          status: 'Preset not found.',
          output: `Could not find an OrbitForge preset for "${value}".`,
        })
        return true
      }
      const pins = getPinnedPresets(context).filter((id) => id !== preset.id)
      await savePinnedPresets(context, pins)
      panel.webview.postMessage({
        type: 'pins',
        html: renderPinnedPresetCards(pins),
      })
      await postRenderedResult(panel, {
        status: 'Preset unpinned.',
        output: `${preset.label} removed from pinned presets.`,
      })
      return true
    }

    if (command === '/preset') {
      const preset = findPreset(value)

      if (!preset) {
        await postRenderedResult(panel, {
          status: 'Preset not found.',
          output: `Could not find an OrbitForge preset for "${value}". Try /help for valid commands.`,
        })
        return true
      }

      panel.webview.postMessage({
        type: 'controls',
        prompt: preset.prompt,
        mode: preset.mode,
        workflow: preset.workflow,
        contextScope: preset.contextScope,
        status: `${preset.label} loaded into the composer.`,
      })
      await postRenderedResult(panel, {
        status: `Preset ${preset.label} loaded.`,
        output: `${preset.label}\n\n${preset.summary}\n\nRun Mission to execute it.`,
      })
      return true
    }

    if (command === '/mode') {
      const mode = normalizeMode(value)
      panel.webview.postMessage({
        type: 'controls',
        mode,
        status: `Execution mode set to ${mode}.`,
      })
      return true
    }

    if (command === '/workflow') {
      const workflow = normalizeWorkflow(value)
      panel.webview.postMessage({
        type: 'controls',
        workflow,
        status: `Workflow set to ${workflowLabels[workflow]}.`,
      })
      return true
    }

    if (command === '/scope') {
      const contextScope = normalizeContextScope(value)
      panel.webview.postMessage({
        type: 'controls',
        contextScope,
        status: `Context scope set to ${contextScope}.`,
      })
      return true
    }

    if (command === '/blueprint') {
      const blueprint = findBlueprint(value)

      if (!blueprint) {
        await postRenderedResult(panel, {
          status: 'Blueprint not found.',
          output: `Could not find an OrbitForge blueprint for "${value}".`,
        })
        return true
      }

      await runMissionInPanel(panel, {
        title: blueprint.title,
        prompt: blueprint.goal,
        mode: parseBlueprintMode(blueprint),
        workflow: parseBlueprintWorkflow(blueprint),
        contextScope: 'workspace+selection',
        blueprint,
        source: 'panel-slash-blueprint',
      })
      return true
    }

    if (command === '/rerun') {
      const history = getMissionHistory(context)
      const entry =
        value === 'last' || !value
          ? history[0]
          : history.find((item) => item.id === value || normalizeLookup(item.title) === normalizeLookup(value))

      if (!entry) {
        await postRenderedResult(panel, {
          status: 'History entry not found.',
          output: 'OrbitForge could not find that saved mission. Run /history to inspect what is available.',
        })
        return true
      }

      await runMissionInPanel(panel, {
        title: `${entry.title} (rerun)`,
        prompt: entry.prompt,
        mode: entry.mode,
        workflow: entry.workflow,
        contextScope: entry.contextScope,
        blueprint: entry.blueprint,
        source: 'panel-slash-rerun',
      })
      return true
    }

    return false
  }

  const openPanel = async () => {
    if (activePanel) {
      activePanel.reveal(vscode.ViewColumn.Beside)
      await postPanelState(activePanel, panelRuntimeSettings)
      return activePanel
    }

    const settings = getSettings()
    panelRuntimeSettings = settings
    const snapshot = await collectPanelContext(settings)
    const panel = vscode.window.createWebviewPanel('orbitforge', 'OrbitForge', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
    })
    activePanel = panel

    panel.onDidDispose(() => {
      if (activePanel === panel) {
        activePanel = undefined
      }
    })

    panel.webview.html = renderPanel(
      settings.agentMode,
      settings.workflow,
      snapshot,
      getMissionHistory(context),
      getPinnedPresets(context),
      'idle'
    )
    await postPanelState(panel, settings)

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === 'guidedSession') {
          await launchGuidedSession(openPanel, context)
          return
        }

        if (message.type === 'refreshContext') {
          await postPanelState(panel, panelRuntimeSettings)
          panel.webview.postMessage({
            type: 'log',
            entry: 'Workspace context refreshed.',
          })
          return
        }

        if (message.type === 'refreshRuntime') {
          panelRuntimeSettings = buildPanelTalentSettings(message, panelRuntimeSettings)
          await postRuntimeState(panel, panelRuntimeSettings)
          panel.webview.postMessage({
            type: 'log',
            entry: `Runtime refreshed for ${panelRuntimeSettings.provider}.`,
          })
          return
        }

        if (message.type === 'saveRuntime') {
          panelRuntimeSettings = buildPanelTalentSettings(message, panelRuntimeSettings)
          const config = vscode.workspace.getConfiguration('orbitforge')
          await config.update('provider', panelRuntimeSettings.provider, vscode.ConfigurationTarget.Global)
          await config.update('baseUrl', panelRuntimeSettings.baseUrl, vscode.ConfigurationTarget.Global)
          await config.update('model', panelRuntimeSettings.model, vscode.ConfigurationTarget.Global)
          await config.update('agentMode', panelRuntimeSettings.agentMode, vscode.ConfigurationTarget.Global)
          await config.update('workflow', panelRuntimeSettings.workflow, vscode.ConfigurationTarget.Global)
          await postPanelState(panel, panelRuntimeSettings)
          await postRenderedResult(panel, {
            status: 'Runtime saved.',
            output: `Provider: ${panelRuntimeSettings.provider}\nBase URL: ${panelRuntimeSettings.baseUrl}\nModel: ${panelRuntimeSettings.model}`,
          })
          return
        }

        if (message.type === 'exportHistory') {
          await exportMissionHistory(context)
          return
        }

        if (message.type === 'createBranch') {
          await createBranchFromPrompt(message.prompt || 'orbitforge-work')
          return
        }

        if (message.type === 'proposeDiff') {
          await proposePatchDiff(context)
          return
        }

        if (message.type === 'historyAction') {
          const entry = getMissionHistory(context).find((item) => item.id === message.historyId)

          if (!entry) {
            await postRenderedResult(panel, {
              status: 'History entry missing.',
              output: 'That OrbitForge mission is no longer available in this workspace.',
            })
            return
          }

          if (message.action === 'restore') {
            panel.webview.postMessage({
              type: 'controls',
              provider: panelRuntimeSettings.provider,
              baseUrl: panelRuntimeSettings.baseUrl,
              model: panelRuntimeSettings.model,
              prompt: entry.prompt,
              mode: entry.mode,
              workflow: entry.workflow,
              contextScope: entry.contextScope,
              status: `${entry.title} restored into the composer.`,
            })
            await postRenderedResult(panel, {
              status: 'Mission restored.',
              output: `${entry.title}\n\n${entry.summary}\n\nRun Mission to execute the restored configuration.`,
            })
            return
          }

          if (message.action === 'rerun') {
            await runMissionInPanel(panel, {
              title: `${entry.title} (rerun)`,
              prompt: entry.prompt,
              mode: entry.mode,
              workflow: entry.workflow,
              contextScope: entry.contextScope,
              blueprint: entry.blueprint,
              source: 'panel-history-rerun',
              settings: panelRuntimeSettings,
            })
            return
          }
        }

        if (message.type !== 'runPrompt') {
          return
        }

        panelRuntimeSettings = buildPanelTalentSettings(message, panelRuntimeSettings)

        if (typeof message.prompt === 'string' && message.prompt.trim().startsWith('/')) {
          const handled = await handleSlashCommand(panel, message.prompt)

          if (handled) {
            return
          }
        }

        await runMissionInPanel(panel, {
          title: 'Panel Mission',
          prompt: message.prompt,
          mode: normalizeMode(message.mode),
          workflow: normalizeWorkflow(message.workflow),
          contextScope: normalizeContextScope(message.contextScope),
          source: 'panel-mission',
          sessionId: message.sessionId,
          settings: panelRuntimeSettings,
        })
      },
      undefined,
      context.subscriptions
    )

    return panel
  }

  const runCommandInPanel = async (mission: {
    title: string
    prompt: string
    mode: AgentMode
    workflow: AgentWorkflow
    contextScope: ContextScope
    blueprint?: OrbitForgeLifecycleBlueprint
    source: string
    settings?: TalentSettings
  }) => {
    const panel = await openPanel()
    panelRuntimeSettings = mission.settings || getSettings()
    await postPanelState(panel, panelRuntimeSettings)
    await runMissionInPanel(panel, {
      ...mission,
      settings: panelRuntimeSettings,
    })
  }

  const guidedSessionCommand = vscode.commands.registerCommand('orbitforge.guidedSession', async () => {
    await launchGuidedSession(openPanel, context)
  })

  const openPanelCommand = vscode.commands.registerCommand('orbitforge.openPanel', async () => {
    await openPanel()
  })

  const openMissionHistoryCommand = vscode.commands.registerCommand('orbitforge.openMissionHistory', async () => {
    await openMissionHistoryPicker(context)
  })

  const exportMissionHistoryCommand = vscode.commands.registerCommand('orbitforge.exportMissionHistory', async () => {
    await exportMissionHistory(context)
  })

  const proposePatchCommand = vscode.commands.registerCommand('orbitforge.proposePatch', async () => {
    await proposePatchDiff(context)
  })

  const createBranchCommand = vscode.commands.registerCommand('orbitforge.createBranch', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe the mission for your branch scaffold',
      ignoreFocusOut: true,
    })
    if (!input?.trim()) {
      return
    }
    const scaffold = await createBranchFromPrompt(input)
    await vscode.window.showInformationMessage(`Branch: ${scaffold.branch} • Commit: ${scaffold.commit}`)
  })

  const explainSelectionCommand = vscode.commands.registerCommand('orbitforge.explainSelection', async () => {
    const selectedText = getActiveSelectionText()

    if (!selectedText) {
      vscode.window.showInformationMessage('Select code first or use OrbitForge: Guided Session.')
      return
    }

    try {
      await runCommandInPanel({
        title: 'Selection Review',
        prompt: 'Explain this code, identify the weakest assumptions, and suggest the safest next edit.',
        mode: 'single',
        workflow: 'review',
        contextScope: 'selection',
        source: 'selection-review',
      })
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge request failed.')
    }
  })

  const generateFromWorkspaceCommand = vscode.commands.registerCommand('orbitforge.generateFromWorkspace', async () => {
    try {
      const settings = getSettings()
      await runCommandInPanel({
        title: 'Workspace Plan',
        prompt: 'Inspect the workspace and produce the next implementation plan, validation commands, and release blockers.',
        mode: settings.agentMode,
        workflow: settings.workflow,
        contextScope: 'workspace',
        source: 'workspace-plan',
        settings,
      })
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge request failed.')
    }
  })

  const parallelWorkspacePlanCommand = vscode.commands.registerCommand('orbitforge.parallelWorkspacePlan', async () => {
    try {
      await runCommandInPanel({
        title: 'Parallel Workspace Plan',
        prompt: 'Inspect the workspace, debate the best implementation path, and converge on the safest release plan.',
        mode: 'parallel',
        workflow: 'release',
        contextScope: 'workspace',
        source: 'parallel-workspace-plan',
      })
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge parallel run failed.')
    }
  })

  const runStarterBlueprintCommand = vscode.commands.registerCommand('orbitforge.runStarterBlueprint', async () => {
    try {
      await launchStarterBlueprintPicker(context)
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge blueprint run failed.')
    }
  })

  const runBlueprintFileCommand = vscode.commands.registerCommand('orbitforge.runBlueprintFile', async () => {
    const file = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        JSON: ['json'],
      },
      openLabel: 'Run OrbitForge Blueprint',
    })

    if (!file?.[0]) {
      return
    }

    try {
      const raw = await vscode.workspace.fs.readFile(file[0])
      const blueprint = JSON.parse(Buffer.from(raw).toString('utf8')) as OrbitForgeLifecycleBlueprint
      await runInteractiveMission({
        title: blueprint.title,
        prompt: blueprint.goal,
        mode: parseBlueprintMode(blueprint),
        workflow: parseBlueprintWorkflow(blueprint),
        contextScope: 'workspace+selection',
        blueprint,
        extensionContext: context,
        source: 'blueprint-file',
        viewColumn: vscode.ViewColumn.Beside,
      })
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Could not open the OrbitForge blueprint file.')
    }
  })

  context.subscriptions.push(
    statusBar,
    guidedSessionCommand,
    openPanelCommand,
    openMissionHistoryCommand,
    exportMissionHistoryCommand,
    proposePatchCommand,
    createBranchCommand,
    explainSelectionCommand,
    generateFromWorkspaceCommand,
    parallelWorkspacePlanCommand,
    runStarterBlueprintCommand,
    runBlueprintFileCommand
  )
}

export function deactivate() {
  return undefined
}
