import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('talentDesktop', {
  runPrompt: (payload: Record<string, string>) => ipcRenderer.invoke('talent:run', payload),
})
