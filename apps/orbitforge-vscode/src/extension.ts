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

async function collectWorkspaceSummary() {
  const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,py,md,json}', '**/node_modules/**', 20)
  const lines = files.map((file) => vscode.workspace.asRelativePath(file)).join('\n')
  return lines || 'No workspace files found.'
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

async function runBlueprintCommand(
  blueprint: OrbitForgeLifecycleBlueprint,
  promptOverride?: string,
  viewColumn = vscode.ViewColumn.Beside
) {
  const workspaceSummary = await collectWorkspaceSummary()
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

  const output = await requestTalent(
    prompt,
    workspaceSummary,
    parseBlueprintMode(blueprint),
    parseBlueprintWorkflow(blueprint),
    blueprint
  )

  const doc = await vscode.workspace.openTextDocument({ content: output, language: 'markdown' })
  await vscode.window.showTextDocument(doc, viewColumn)
}

function renderPanel(
  webview: vscode.Webview,
  initialMode: AgentMode,
  initialWorkflow: AgentWorkflow,
  output = 'Prompt OrbitForge from the panel.'
) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: sans-serif; background: #020617; color: #e2e8f0; padding: 16px; }
      textarea, button { width: 100%; box-sizing: border-box; border-radius: 14px; }
      textarea { min-height: 160px; padding: 12px; background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.12); }
      button { margin-top: 12px; padding: 12px; border: none; background: #67e8f9; color: #082f49; font-weight: 700; cursor: pointer; }
      pre { white-space: pre-wrap; background: #0f172a; padding: 14px; border-radius: 16px; margin-top: 16px; }
      .meta { font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.16em; }
    </style>
  </head>
  <body>
    <div class="meta">OrbitForge</div>
    <h2>Model-agnostic coding panel</h2>
    <label>
      <div class="meta">Execution Mode</div>
      <select id="mode" style="width: 100%; margin-bottom: 12px; padding: 12px; border-radius: 14px; background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.12);">
        <option value="single"${initialMode === 'single' ? ' selected' : ''}>Single Agent</option>
        <option value="parallel"${initialMode === 'parallel' ? ' selected' : ''}>Parallel Trio</option>
      </select>
    </label>
    <label>
      <div class="meta">Workflow</div>
      <select id="workflow" style="width: 100%; margin-bottom: 12px; padding: 12px; border-radius: 14px; background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.12);">
        <option value="general"${initialWorkflow === 'general' ? ' selected' : ''}>General Build</option>
        <option value="review"${initialWorkflow === 'review' ? ' selected' : ''}>Parallel Review</option>
        <option value="migration"${initialWorkflow === 'migration' ? ' selected' : ''}>Migration Flight Plan</option>
        <option value="incident"${initialWorkflow === 'incident' ? ' selected' : ''}>Incident Command</option>
        <option value="release"${initialWorkflow === 'release' ? ' selected' : ''}>Release Gate</option>
      </select>
    </label>
    <textarea id="prompt">Review the active workspace and produce a plan, implementation strategy, validation steps, and risks.</textarea>
    <button id="run">Run Prompt</button>
    <pre id="output">${output.replace(/</g, '&lt;')}</pre>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('run').addEventListener('click', () => {
        vscode.postMessage({
          type: 'runPrompt',
          prompt: document.getElementById('prompt').value,
          mode: document.getElementById('mode').value,
          workflow: document.getElementById('workflow').value
        });
      });
      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'result') {
          document.getElementById('output').textContent = message.output;
        }
      });
    </script>
  </body>
</html>`
}

export function activate(context: vscode.ExtensionContext) {
  const openPanelCommand = vscode.commands.registerCommand('orbitforge.openPanel', async () => {
    const settings = getSettings()
    const panel = vscode.window.createWebviewPanel('orbitforge', 'OrbitForge', vscode.ViewColumn.Beside, {
      enableScripts: true,
    })

    panel.webview.html = renderPanel(panel.webview, settings.agentMode, settings.workflow)

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type !== 'runPrompt') {
          return
        }

        try {
          const summary = await collectWorkspaceSummary()
          const output = await requestTalent(
            message.prompt,
            summary,
            message.mode === 'parallel' ? 'parallel' : 'single',
            message.workflow === 'review' ||
              message.workflow === 'migration' ||
              message.workflow === 'incident' ||
              message.workflow === 'release'
              ? message.workflow
              : 'general'
          )
          panel.webview.postMessage({ type: 'result', output })
        } catch (error) {
          panel.webview.postMessage({
            type: 'result',
            output: error instanceof Error ? error.message : 'OrbitForge request failed.',
          })
        }
      },
      undefined,
      context.subscriptions
    )
  })

  const explainSelectionCommand = vscode.commands.registerCommand('orbitforge.explainSelection', async () => {
    const editor = vscode.window.activeTextEditor

    if (!editor) {
      vscode.window.showInformationMessage('Open a file and select code first.')
      return
    }

    const selectedText = editor.document.getText(editor.selection).trim()

    if (!selectedText) {
      vscode.window.showInformationMessage('Select code to explain.')
      return
    }

    try {
      const output = await requestTalent('Explain this code and suggest the safest next edit.', selectedText, 'single', 'general')
      const doc = await vscode.workspace.openTextDocument({ content: output, language: 'markdown' })
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge request failed.')
    }
  })

  const generateFromWorkspaceCommand = vscode.commands.registerCommand('orbitforge.generateFromWorkspace', async () => {
    try {
      const summary = await collectWorkspaceSummary()
      const settings = getSettings()
      const output = await requestTalent(
        'Inspect the workspace and produce the next implementation plan, validation commands, and release blockers.',
        summary,
        settings.agentMode,
        settings.workflow
      )
      const doc = await vscode.workspace.openTextDocument({ content: output, language: 'markdown' })
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge request failed.')
    }
  })

  const parallelWorkspacePlanCommand = vscode.commands.registerCommand('orbitforge.parallelWorkspacePlan', async () => {
    try {
      const summary = await collectWorkspaceSummary()
      const output = await requestTalent(
        'Inspect the workspace, debate the best implementation path, and converge on the safest release plan.',
        summary,
        'parallel',
        'release'
      )
      const doc = await vscode.workspace.openTextDocument({ content: output, language: 'markdown' })
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'OrbitForge parallel run failed.')
    }
  })

  const runStarterBlueprintCommand = vscode.commands.registerCommand('orbitforge.runStarterBlueprint', async () => {
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

    try {
      await runBlueprintCommand(selected.blueprint, undefined, vscode.ViewColumn.Beside)
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
