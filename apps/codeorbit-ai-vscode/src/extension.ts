import * as vscode from 'vscode'

type ProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'openrouter' | 'openai-compatible'

type TalentSettings = {
  provider: ProviderId
  baseUrl: string
  model: string
  apiKey: string
}

function getSettings(): TalentSettings {
  const config = vscode.workspace.getConfiguration('codeOrbit')
  return {
    provider: config.get<ProviderId>('provider', 'ollama'),
    baseUrl: config.get<string>('baseUrl', 'http://localhost:11434'),
    model: config.get<string>('model', 'deepseek-coder:33b'),
    apiKey: config.get<string>('apiKey', ''),
  }
}

async function requestTalent(prompt: string, contextText: string, settings = getSettings()) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const messagePayload = [
    {
      role: 'system',
      content:
        'You are CodeOrbit AI, a release-ready coding assistant. Return a plan, implementation approach, validation, and risks.',
    },
    {
      role: 'user',
      content: `Workspace context:\n${contextText}\n\nTask:\n${prompt}`,
    },
  ]

  if (settings.provider === 'anthropic') {
    headers['x-api-key'] = settings.apiKey
    headers['anthropic-version'] = '2023-06-01'

    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 2400,
        system:
          'You are CodeOrbit AI, a release-ready coding assistant. Return a plan, implementation approach, validation, and risks.',
        messages: messagePayload.filter((entry) => entry.role !== 'system'),
      }),
    })

    const payload = (await response.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } }

    if (!response.ok) {
      throw new Error(payload.error?.message || 'Anthropic request failed')
    }

    return payload.content?.map((entry) => entry.text || '').join('\n') || ''
  }

  if (settings.provider === 'ollama') {
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model,
        stream: false,
        messages: messagePayload,
      }),
    })

    const payload = (await response.json()) as { message?: { content?: string }; error?: string }

    if (!response.ok) {
      throw new Error(payload.error || 'Ollama request failed')
    }

    return payload.message?.content || ''
  }

  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`
  }

  const openAiBase = settings.baseUrl.replace(/\/$/, '')
  const response = await fetch(`${openAiBase}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      messages: messagePayload,
    }),
  })

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string } | string
  }

  if (!response.ok) {
    const errorMessage = typeof payload.error === 'string' ? payload.error : payload.error?.message
    throw new Error(errorMessage || 'Provider request failed')
  }

  return payload.choices?.[0]?.message?.content || ''
}

async function collectWorkspaceSummary() {
  const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,py,md,json}', '**/node_modules/**', 20)
  const lines = files.map((file) => vscode.workspace.asRelativePath(file)).join('\n')
  return lines || 'No workspace files found.'
}

function renderPanel(webview: vscode.Webview, output = 'Prompt CodeOrbit AI from the panel.') {
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
    <div class="meta">CodeOrbit AI</div>
    <h2>Model-agnostic coding panel</h2>
    <textarea id="prompt">Review the active workspace and produce a plan, implementation strategy, validation steps, and risks.</textarea>
    <button id="run">Run Prompt</button>
    <pre id="output">${output.replace(/</g, '&lt;')}</pre>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('run').addEventListener('click', () => {
        vscode.postMessage({
          type: 'runPrompt',
          prompt: document.getElementById('prompt').value
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
  const openPanelCommand = vscode.commands.registerCommand('codeOrbit.openPanel', async () => {
    const panel = vscode.window.createWebviewPanel('codeOrbit', 'CodeOrbit AI', vscode.ViewColumn.Beside, {
      enableScripts: true,
    })

    panel.webview.html = renderPanel(panel.webview)

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type !== 'runPrompt') {
          return
        }

        try {
          const summary = await collectWorkspaceSummary()
          const output = await requestTalent(message.prompt, summary)
          panel.webview.postMessage({ type: 'result', output })
        } catch (error) {
          panel.webview.postMessage({
            type: 'result',
            output: error instanceof Error ? error.message : 'Talent request failed.',
          })
        }
      },
      undefined,
      context.subscriptions
    )
  })

  const explainSelectionCommand = vscode.commands.registerCommand('codeOrbit.explainSelection', async () => {
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
      const output = await requestTalent('Explain this code and suggest the safest next edit.', selectedText)
      const doc = await vscode.workspace.openTextDocument({ content: output, language: 'markdown' })
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Talent request failed.')
    }
  })

  const generateFromWorkspaceCommand = vscode.commands.registerCommand('codeOrbit.generateFromWorkspace', async () => {
    try {
      const summary = await collectWorkspaceSummary()
      const output = await requestTalent(
        'Inspect the workspace and produce the next implementation plan, validation commands, and release blockers.',
        summary
      )
      const doc = await vscode.workspace.openTextDocument({ content: output, language: 'markdown' })
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Talent request failed.')
    }
  })

  context.subscriptions.push(openPanelCommand, explainSelectionCommand, generateFromWorkspaceCommand)
}

export function deactivate() {
  return undefined
}
