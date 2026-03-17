#!/usr/bin/env node

type ProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'openrouter' | 'openai-compatible'

type TalentRequest = {
  provider: ProviderId
  model: string
  baseUrl: string
  apiKey?: string
  prompt: string
  workspaceContext?: string
  temperature?: number
}

const defaultSystemPrompt = `You are CodeOrbit AI, a release-ready software engineer.
Always return:
1. A concise plan.
2. The implementation approach.
3. Validation steps.
4. Remaining risks.`

function parseArgs(argv: string[]) {
  const parsed: Record<string, string | boolean> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const next = argv[index + 1]

    if (!next || next.startsWith('--')) {
      parsed[key] = true
      continue
    }

    parsed[key] = next
    index += 1
  }

  return parsed
}

function envOrDefault(provider: ProviderId) {
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

async function readJson(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Unexpected response: ${text.slice(0, 400)}`)
  }
}

function buildMessages(input: TalentRequest) {
  const workspace = input.workspaceContext?.trim()
    ? `Workspace context:\n${input.workspaceContext.trim()}`
    : 'Workspace context: not provided.'

  return [
    { role: 'system', content: defaultSystemPrompt },
    { role: 'user', content: `${workspace}\n\nTask:\n${input.prompt.trim()}` },
  ]
}

async function callProvider(input: TalentRequest) {
  if (input.provider === 'anthropic') {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': input.apiKey || process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 2400,
        temperature: input.temperature ?? 0.2,
        system: defaultSystemPrompt,
        messages: buildMessages(input).filter((message) => message.role !== 'system'),
      }),
    })

    const payload = await readJson(response)

    if (!response.ok) {
      throw new Error(payload.error?.message || payload.error?.type || 'Anthropic request failed')
    }

    return payload.content?.map((entry: { text?: string }) => entry.text || '').join('\n') || ''
  }

  if (input.provider === 'ollama') {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    return payload.message?.content || ''
  }

  const apiKey =
    input.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_COMPATIBLE_API_KEY ||
    ''

  const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/chat/completions`, {
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
    throw new Error(payload.error?.message || payload.error || 'Provider request failed')
  }

  return payload.choices?.[0]?.message?.content || ''
}

function printHelp() {
  console.log(`CodeOrbit AI CLI

Usage:
  codeorbit --provider ollama --model deepseek-coder:33b --prompt "Plan the next patch"

Options:
  --provider         ollama | lmstudio | openai | anthropic | openrouter | openai-compatible
  --model            Model identifier
  --base-url         Override provider base URL
  --api-key          API key for hosted providers
  --prompt           Task prompt to run
  --workspace        Optional workspace context string
  --temperature      Optional temperature, default 0.2
  --help             Show this help message`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const provider = String(args.provider || 'ollama') as ProviderId
  const model = String(args.model || 'deepseek-coder:33b')
  const prompt = String(args.prompt || '')

  if (!prompt.trim()) {
    printHelp()
    process.exitCode = 1
    return
  }

  const request: TalentRequest = {
    provider,
    model,
    prompt,
    baseUrl: String(args['base-url'] || envOrDefault(provider)),
    apiKey: typeof args['api-key'] === 'string' ? args['api-key'] : undefined,
    workspaceContext: typeof args.workspace === 'string' ? args.workspace : undefined,
    temperature: typeof args.temperature === 'string' ? Number(args.temperature) : 0.2,
  }

  const output = await callProvider(request)
  process.stdout.write(`${output}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Talent CLI failed.'}\n`)
  process.exit(1)
})
