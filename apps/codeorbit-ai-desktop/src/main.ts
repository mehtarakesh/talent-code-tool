import { BrowserWindow, app, ipcMain } from 'electron'
import path from 'node:path'

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('talent:run', async (_event, requestPayload) => {
  const { provider, model, baseUrl, apiKey, prompt, workspaceContext } = requestPayload as Record<string, string>
  const systemPrompt = `You are CodeOrbit AI, a release-ready software engineer.
Always return:
1. A concise plan.
2. The implementation approach.
3. Validation steps.
4. Remaining risks.`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Workspace context:\n${workspaceContext || 'Not provided.'}\n\nTask:\n${prompt}` },
  ]

  async function parseJson(response: Response) {
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`Unexpected response: ${text.slice(0, 400)}`)
    }
  }

  if (provider === 'anthropic') {
    const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey || process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2400,
        temperature: 0.2,
        system: systemPrompt,
        messages: messages.filter((entry) => entry.role !== 'system'),
      }),
    })

    const responsePayload = await parseJson(response)

    if (!response.ok) {
      throw new Error(responsePayload.error?.message || 'Anthropic request failed')
    }

    return responsePayload.content?.map((entry: { text?: string }) => entry.text || '').join('\n') || ''
  }

  if (provider === 'ollama') {
    const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
      }),
    })

    const responsePayload = await parseJson(response)

    if (!response.ok) {
      throw new Error(responsePayload.error || 'Ollama request failed')
    }

    return responsePayload.message?.content || ''
  }

  const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
    }),
  })

  const responsePayload = await parseJson(response)

  if (!response.ok) {
    throw new Error(responsePayload.error?.message || responsePayload.error || 'Provider request failed')
  }

  return responsePayload.choices?.[0]?.message?.content || ''
})
