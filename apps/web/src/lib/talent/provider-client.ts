export type ProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'openrouter' | 'openai-compatible'

export type TalentMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type TalentRequest = {
  provider: ProviderId
  model: string
  baseUrl?: string
  apiKey?: string
  temperature?: number
  prompt: string
  workspaceContext?: string
}

export const defaultSystemPrompt = `You are CodeOrbit AI, a release-ready software engineer.
Always return:
1. A concise plan.
2. The implementation approach.
3. Validation steps.
4. Remaining risks.`

export function buildMessages(input: TalentRequest): TalentMessage[] {
  const workspace = input.workspaceContext?.trim()
    ? `Workspace context:\n${input.workspaceContext.trim()}`
    : 'Workspace context: not provided.'

  return [
    { role: 'system', content: defaultSystemPrompt },
    {
      role: 'user',
      content: `${workspace}\n\nTask:\n${input.prompt.trim()}`,
    },
  ]
}

export function normalizeBaseUrl(provider: ProviderId, customBaseUrl?: string) {
  if (customBaseUrl?.trim()) {
    return customBaseUrl.trim().replace(/\/$/, '')
  }

  switch (provider) {
    case 'ollama':
      return process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    case 'lmstudio':
      return process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
    case 'anthropic':
      return process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'
    case 'openrouter':
      return process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    case 'openai-compatible':
      return process.env.OPENAI_COMPATIBLE_BASE_URL || 'http://localhost:1234/v1'
    case 'openai':
    default:
      return process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  }
}

export async function readJson(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Unexpected provider response: ${text.slice(0, 400)}`)
  }
}

async function callOpenAICompatible(input: TalentRequest) {
  const baseUrl = normalizeBaseUrl(input.provider, input.baseUrl)
  const apiKey =
    input.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_COMPATIBLE_API_KEY ||
    ''

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature ?? 0.2,
      messages: buildMessages(input),
    }),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.error || 'OpenAI-compatible request failed')
  }

  return payload.choices?.[0]?.message?.content || 'No response content returned.'
}

async function callAnthropic(input: TalentRequest) {
  const baseUrl = normalizeBaseUrl(input.provider, input.baseUrl)
  const apiKey = input.apiKey || process.env.ANTHROPIC_API_KEY || ''
  const messages = buildMessages(input).filter((message) => message.role !== 'system')

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 2400,
      temperature: input.temperature ?? 0.2,
      system: defaultSystemPrompt,
      messages,
    }),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.error?.type || 'Anthropic request failed')
  }

  return payload.content?.map((entry: { text?: string }) => entry.text || '').join('\n') || 'No response content returned.'
}

async function callOllama(input: TalentRequest) {
  const baseUrl = normalizeBaseUrl(input.provider, input.baseUrl)
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      stream: false,
      options: {
        temperature: input.temperature ?? 0.2,
      },
      messages: buildMessages(input),
    }),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(payload.error || 'Ollama request failed')
  }

  return payload.message?.content || 'No response content returned.'
}

export async function runTalentPrompt(input: TalentRequest) {
  if (!input.prompt.trim()) {
    throw new Error('Prompt is required.')
  }

  if (!input.model.trim()) {
    throw new Error('Model is required.')
  }

  switch (input.provider) {
    case 'anthropic':
      return callAnthropic(input)
    case 'ollama':
      return callOllama(input)
    case 'lmstudio':
    case 'openrouter':
    case 'openai-compatible':
    case 'openai':
    default:
      return callOpenAICompatible(input)
  }
}
