import * as vscode from 'vscode'
import {
  builtInLifecycleBlueprints,
  runOrbitForgeTask,
  type AgentMode,
  type AgentWorkflow,
  type OrbitForgeLifecycleBlueprint,
  type ProviderId,
} from 'orbitforge-core'

type TalentSettings = {
  provider: ProviderId
  baseUrl: string
  model: string
  apiKey: string
  agentMode: AgentMode
  workflow: AgentWorkflow
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

type PromptPreset = {
  id: string
  label: string
  summary: string
  prompt: string
  mode: AgentMode
  workflow: AgentWorkflow
  contextScope: ContextScope
}

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
    model: config.get<string>('model', 'deepseek-coder:33b'),
    apiKey: config.get<string>('apiKey', ''),
    agentMode: config.get<AgentMode>('agentMode', 'single'),
    workflow: config.get<AgentWorkflow>('workflow', 'general'),
  }
}

function normalizeMode(value: unknown): AgentMode {
  return value === 'parallel' ? 'parallel' : 'single'
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

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
  const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,py,md,json}', '**/node_modules/**', 40)
  const workspaceFolders = (vscode.workspace.workspaceFolders || []).map((folder) => folder.name)
  const activeFile = vscode.window.activeTextEditor
    ? vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri)
    : 'No active file'

  return {
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    workspaceFolders,
    workspaceFileCount: files.length,
    activeFile,
    hasSelection: Boolean(getActiveSelectionText()),
  }
}

async function requestTalent(
  prompt: string,
  contextText: string,
  mode: AgentMode,
  workflow: AgentWorkflow,
  blueprint?: OrbitForgeLifecycleBlueprint,
  settings = getSettings()
) {
  const result = await runOrbitForgeTask({
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    prompt,
    workspaceContext: contextText,
    mode,
    workflow,
    blueprint,
  })

  return `${result.summary}\n\n${result.output}`
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

async function runInteractiveMission(options: {
  title: string
  prompt: string
  mode: AgentMode
  workflow: AgentWorkflow
  contextScope: ContextScope
  blueprint?: OrbitForgeLifecycleBlueprint
  viewColumn?: vscode.ViewColumn
  progressTitle?: string
}) {
  const progressTitle = options.progressTitle || `OrbitForge • ${options.title}`

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Collecting context' })
      const { contextText, contextLabel } = await buildContext(options.contextScope)
      progress.report({ message: 'Running agents' })
      const output = await requestTalent(
        options.prompt,
        contextText,
        options.mode,
        options.workflow,
        options.blueprint
      )
      const heading = `${options.title}\n\n- Workflow: ${workflowLabels[options.workflow]}\n- Mode: ${
        options.mode === 'parallel' ? 'Parallel trio' : 'Single lane'
      }\n- Context: ${contextLabel}`

      await openResultDocument(heading, output, options.viewColumn)
    }
  )
}

async function runBlueprintCommand(
  blueprint: OrbitForgeLifecycleBlueprint,
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
    viewColumn,
    progressTitle: `OrbitForge • ${blueprint.title}`,
  })
}

async function runPreset(preset: PromptPreset, viewColumn = vscode.ViewColumn.Beside) {
  await runInteractiveMission({
    title: preset.label,
    prompt: preset.prompt,
    mode: preset.mode,
    workflow: preset.workflow,
    contextScope: preset.contextScope,
    viewColumn,
  })
}

async function launchStarterBlueprintPicker() {
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

  await runBlueprintCommand(selected.blueprint, undefined, vscode.ViewColumn.Beside)
}

async function launchGuidedSession(openPanel: () => Promise<void>) {
  const action = await vscode.window.showQuickPick(
    [
      {
        label: 'Open interactive panel',
        description: 'Stay in a Codex / Claude-style workspace with presets and live controls.',
        action: 'panel' as const,
      },
      {
        label: 'Run starter blueprint',
        description: 'Pick a lifecycle blueprint and run it with minimal setup.',
        action: 'blueprint' as const,
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

  if (action.action === 'blueprint') {
    await launchStarterBlueprintPicker()
    return
  }

  if (action.action === 'preset' && action.preset) {
    await runPreset(action.preset)
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
  })
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

function renderPanel(
  initialMode: AgentMode,
  initialWorkflow: AgentWorkflow,
  snapshot: PanelContextSnapshot,
  output = 'Pick a preset, tweak the prompt, or run a blueprint. OrbitForge will keep the result inside this workspace.'
) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #04111f;
        --panel: rgba(8, 20, 35, 0.92);
        --panel-2: rgba(15, 29, 48, 0.95);
        --line: rgba(148, 163, 184, 0.18);
        --text: #dbe7f5;
        --muted: #8ba3bd;
        --accent: #69f5e1;
        --accent-2: #7dd3fc;
        --danger: #fca5a5;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(34, 211, 238, 0.16), transparent 28%),
          radial-gradient(circle at top right, rgba(129, 140, 248, 0.12), transparent 30%),
          var(--bg);
        color: var(--text);
        padding: 20px;
      }
      .shell {
        display: grid;
        gap: 16px;
      }
      .hero, .glass, pre {
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--panel);
        box-shadow: 0 18px 48px rgba(2, 6, 23, 0.34);
      }
      .hero {
        padding: 20px;
      }
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
      .hero p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .context-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }
      .context-pill {
        border-radius: 999px;
        border: 1px solid var(--line);
        padding: 8px 12px;
        background: rgba(15, 23, 42, 0.72);
        color: #d6e4f5;
        font-size: 12px;
      }
      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: 1.35fr 0.95fr;
      }
      .glass {
        padding: 18px;
      }
      .section-title {
        margin: 0 0 12px;
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .preset-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
      .preset-card {
        width: 100%;
        text-align: left;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(14, 26, 45, 0.96), rgba(10, 18, 33, 0.9));
        color: var(--text);
        padding: 14px;
        cursor: pointer;
      }
      .preset-card:hover {
        border-color: rgba(105, 245, 225, 0.45);
        transform: translateY(-1px);
      }
      .preset-title {
        display: block;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .preset-summary {
        display: block;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }
      label {
        display: block;
        margin-bottom: 12px;
      }
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
      select, textarea, button {
        width: 100%;
        border-radius: 16px;
      }
      select, textarea {
        padding: 12px 14px;
        border: 1px solid var(--line);
        background: var(--panel-2);
        color: var(--text);
      }
      textarea {
        min-height: 180px;
        resize: vertical;
        line-height: 1.6;
      }
      .button-row {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        margin-top: 12px;
      }
      button {
        border: none;
        padding: 12px 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .primary {
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: #04263a;
      }
      .secondary {
        background: rgba(15, 23, 42, 0.9);
        color: var(--text);
        border: 1px solid var(--line);
      }
      .ghost {
        background: transparent;
        color: var(--muted);
        border: 1px dashed var(--line);
      }
      .hint {
        margin-top: 10px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
      }
      .status {
        color: var(--accent);
        font-size: 12px;
        min-height: 18px;
      }
      pre {
        margin: 0;
        padding: 18px;
        white-space: pre-wrap;
        line-height: 1.65;
      }
      @media (max-width: 880px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">OrbitForge interactive workspace</div>
        <h1>Guide the agents like Claude Code, steer them like n8n, keep it inside VS Code.</h1>
        <p>Load a preset, switch workflow and execution mode, run a starter blueprint, or drop into a custom mission without leaving the editor.</p>
        <div id="context-grid" class="context-grid">${renderContextCards(snapshot)}</div>
      </section>

      <div class="grid">
        <section class="glass">
          <div class="section-title">Preset launches</div>
          <div class="preset-grid">
            ${renderPresetCards()}
          </div>
          <div class="hint">Presets rewrite the prompt, workflow, and context scope so you can launch a strong run without manually tuning every field.</div>
        </section>

        <section class="glass">
          <div class="section-title">Starter blueprint</div>
          <label>
            <div class="label"><span>Lifecycle blueprint</span><span>No-code mission pack</span></div>
            <select id="blueprint">
              ${renderBlueprintOptions()}
            </select>
          </label>
          <div class="button-row">
            <button class="primary" id="runBlueprint">Run Blueprint</button>
            <button class="secondary" id="guided">Guided Session</button>
          </div>
          <div class="hint">Blueprints let you start with an intake, parallel lanes, gates, validation, and publish bundle already mapped out.</div>
        </section>
      </div>

      <section class="glass">
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
          <div class="label"><span>Mission prompt</span><span>Supports fully custom runs</span></div>
          <textarea id="prompt">Inspect the current workspace, produce the next implementation plan, validation steps, and the proof needed before calling the work done.</textarea>
        </label>
        <div class="button-row">
          <button class="primary" id="run">Run Mission</button>
          <button class="secondary" id="refresh">Refresh Context</button>
          <button class="ghost" id="selectionPreset">Use Selection Review</button>
        </div>
        <div id="status" class="status"></div>
      </section>

      <pre id="output">${escapeHtml(output)}</pre>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const output = document.getElementById('output');
      const status = document.getElementById('status');
      const prompt = document.getElementById('prompt');
      const mode = document.getElementById('mode');
      const workflow = document.getElementById('workflow');
      const scope = document.getElementById('scope');
      const blueprint = document.getElementById('blueprint');
      const contextGrid = document.getElementById('context-grid');

      const setStatus = (value) => {
        status.textContent = value || '';
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
        setStatus('Running OrbitForge mission...');
        output.textContent = 'Running OrbitForge...';
        vscode.postMessage({
          type: 'runPrompt',
          prompt: prompt.value,
          mode: mode.value,
          workflow: workflow.value,
          contextScope: scope.value
        });
      });

      document.getElementById('runBlueprint').addEventListener('click', () => {
        setStatus('Launching starter blueprint...');
        output.textContent = 'Running OrbitForge blueprint...';
        vscode.postMessage({
          type: 'runBlueprint',
          blueprintId: blueprint.value
        });
      });

      document.getElementById('guided').addEventListener('click', () => {
        vscode.postMessage({ type: 'guidedSession' });
      });

      document.getElementById('refresh').addEventListener('click', () => {
        setStatus('Refreshing workspace context...');
        vscode.postMessage({ type: 'refreshContext' });
      });

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'result') {
          output.textContent = message.output;
          setStatus(message.status || 'Run complete.');
        }
        if (message.type === 'context') {
          contextGrid.innerHTML = message.html;
          setStatus('Workspace context refreshed.');
        }
      });
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

  const openPanel = async () => {
    const settings = getSettings()
    const snapshot = await collectPanelContext(settings)
    const panel = vscode.window.createWebviewPanel('orbitforge', 'OrbitForge', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
    })

    panel.webview.html = renderPanel(settings.agentMode, settings.workflow, snapshot)

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === 'guidedSession') {
          await launchGuidedSession(openPanel)
          return
        }

        if (message.type === 'refreshContext') {
          const refreshed = await collectPanelContext()
          panel.webview.postMessage({
            type: 'context',
            html: renderContextCards(refreshed),
          })
          return
        }

        if (message.type === 'runBlueprint') {
          const blueprint = builtInLifecycleBlueprints.find((item) => item.blueprintId === message.blueprintId)

          if (!blueprint) {
            panel.webview.postMessage({
              type: 'result',
              status: 'Could not find that starter blueprint.',
              output: 'The selected OrbitForge blueprint is missing from the installed extension bundle.',
            })
            return
          }

          try {
            const output = await requestTalent(
              blueprint.goal,
              (await buildContext('workspace+selection')).contextText,
              parseBlueprintMode(blueprint),
              parseBlueprintWorkflow(blueprint),
              blueprint
            )
            panel.webview.postMessage({
              type: 'result',
              status: `${blueprint.title} completed.`,
              output,
            })
          } catch (error) {
            panel.webview.postMessage({
              type: 'result',
              status: 'Blueprint run failed.',
              output: error instanceof Error ? error.message : 'OrbitForge blueprint run failed.',
            })
          }
          return
        }

        if (message.type !== 'runPrompt') {
          return
        }

        try {
          const scope = normalizeContextScope(message.contextScope)
          const { contextText, contextLabel } = await buildContext(scope)
          const output = await requestTalent(
            message.prompt,
            contextText,
            normalizeMode(message.mode),
            normalizeWorkflow(message.workflow)
          )
          panel.webview.postMessage({
            type: 'result',
            status: `Mission complete using ${contextLabel.toLowerCase()} context.`,
            output,
          })
        } catch (error) {
          panel.webview.postMessage({
            type: 'result',
            status: 'Run failed.',
            output: error instanceof Error ? error.message : 'OrbitForge request failed.',
          })
        }
      },
      undefined,
      context.subscriptions
    )
  }

  const guidedSessionCommand = vscode.commands.registerCommand('orbitforge.guidedSession', async () => {
    await launchGuidedSession(openPanel)
  })

  const openPanelCommand = vscode.commands.registerCommand('orbitforge.openPanel', async () => {
    await openPanel()
  })

  const explainSelectionCommand = vscode.commands.registerCommand('orbitforge.explainSelection', async () => {
    const selectedText = getActiveSelectionText()

    if (!selectedText) {
      vscode.window.showInformationMessage('Select code first or use OrbitForge: Guided Session.')
      return
    }

    try {
      await runInteractiveMission({
        title: 'Selection Review',
        prompt: 'Explain this code, identify the weakest assumptions, and suggest the safest next edit.',
        mode: 'single',
        workflow: 'review',
        contextScope: 'selection',
      })
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge request failed.')
    }
  })

  const generateFromWorkspaceCommand = vscode.commands.registerCommand('orbitforge.generateFromWorkspace', async () => {
    try {
      const settings = getSettings()
      await runInteractiveMission({
        title: 'Workspace Plan',
        prompt: 'Inspect the workspace and produce the next implementation plan, validation commands, and release blockers.',
        mode: settings.agentMode,
        workflow: settings.workflow,
        contextScope: 'workspace',
      })
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge request failed.')
    }
  })

  const parallelWorkspacePlanCommand = vscode.commands.registerCommand('orbitforge.parallelWorkspacePlan', async () => {
    try {
      await runInteractiveMission({
        title: 'Parallel Workspace Plan',
        prompt: 'Inspect the workspace, debate the best implementation path, and converge on the safest release plan.',
        mode: 'parallel',
        workflow: 'release',
        contextScope: 'workspace',
      })
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge parallel run failed.')
    }
  })

  const runStarterBlueprintCommand = vscode.commands.registerCommand('orbitforge.runStarterBlueprint', async () => {
    try {
      await launchStarterBlueprintPicker()
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
      await runBlueprintCommand(blueprint, undefined, vscode.ViewColumn.Beside)
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Could not open the OrbitForge blueprint file.')
    }
  })

  context.subscriptions.push(
    statusBar,
    guidedSessionCommand,
    openPanelCommand,
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
