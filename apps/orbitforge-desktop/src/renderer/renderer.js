const providerInput = document.getElementById('provider')
const modelInput = document.getElementById('model')
const baseUrlInput = document.getElementById('baseUrl')
const modeInput = document.getElementById('mode')
const workflowInput = document.getElementById('workflow')
const apiKeyInput = document.getElementById('apiKey')
const workspaceInput = document.getElementById('workspaceContext')
const promptInput = document.getElementById('prompt')
const statusLine = document.getElementById('statusLine')
const output = document.getElementById('output')
const runButton = document.getElementById('runButton')

const defaults = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'deepseek-coder:33b' },
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'deepseek-coder' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4' },
  'openai-compatible': { baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
}

providerInput.addEventListener('change', () => {
  const preset = defaults[providerInput.value]
  baseUrlInput.value = preset.baseUrl
  modelInput.value = preset.model
})

runButton.addEventListener('click', async () => {
  statusLine.textContent =
    modeInput.value === 'parallel' ? 'Running architect, implementer, and critic lanes...' : 'Running single agent...'
  output.textContent = 'OrbitForge is working...'

  try {
    const result = await window.talentDesktop.runPrompt({
      provider: providerInput.value,
      model: modelInput.value,
      baseUrl: baseUrlInput.value,
      mode: modeInput.value,
      workflow: workflowInput.value,
      apiKey: apiKeyInput.value,
      workspaceContext: workspaceInput.value,
      prompt: promptInput.value,
    })

    statusLine.textContent = result.summary
    output.textContent = result.output
  } catch (error) {
    statusLine.textContent = 'Run failed.'
    output.textContent = error instanceof Error ? error.message : 'Desktop request failed.'
  }
})
