import { BrowserWindow, app, ipcMain } from 'electron'
import path from 'node:path'
import { runOrbitForgeTask } from 'orbitforge-core'

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
  const {
    provider,
    model,
    baseUrl,
    apiKey,
    prompt,
    workspaceContext,
    mode,
    workflow,
  } = requestPayload as Record<string, string>

  return runOrbitForgeTask({
    provider: provider as
      | 'ollama'
      | 'lmstudio'
      | 'openai'
      | 'anthropic'
      | 'openrouter'
      | 'openai-compatible',
    model,
    baseUrl,
    apiKey,
    prompt,
    workspaceContext,
    mode: mode === 'parallel' ? 'parallel' : 'single',
    workflow:
      workflow === 'review' || workflow === 'migration' || workflow === 'incident' || workflow === 'release'
        ? workflow
        : 'general',
  })
})
