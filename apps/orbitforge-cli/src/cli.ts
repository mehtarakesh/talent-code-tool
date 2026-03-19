#!/usr/bin/env node

import { readFileSync } from 'node:fs'

import {
  builtInLifecycleBlueprints,
  getProviderDefaults,
  listLifecycleComponents,
  parseAgentIds,
  parseWorkflow,
  runOrbitForgeTask,
  type OrbitForgeLifecycleBlueprint,
  type AgentMode,
  type AgentWorkflow,
  type ProviderId,
} from 'orbitforge-core'

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
  const defaults = getProviderDefaults(provider)

  switch (provider) {
    case 'ollama':
      return process.env.OLLAMA_BASE_URL || defaults.baseUrl
    case 'lmstudio':
      return process.env.LMSTUDIO_BASE_URL || defaults.baseUrl
    case 'anthropic':
      return process.env.ANTHROPIC_BASE_URL || defaults.baseUrl
    case 'openrouter':
      return process.env.OPENROUTER_BASE_URL || defaults.baseUrl
    case 'openai-compatible':
      return process.env.OPENAI_COMPATIBLE_BASE_URL || defaults.baseUrl
    case 'openai':
    default:
      return process.env.OPENAI_BASE_URL || defaults.baseUrl
  }
}

function printHelp() {
  console.log(`OrbitForge CLI

Usage:
  orbitforge --provider ollama --model deepseek-coder:33b --prompt "Plan the next patch"
  orbitforge --parallel --prompt "Find the safest implementation path"
  orbitforge --parallel --workflow review --prompt "Review this risky change"
  orbitforge --list-components
  orbitforge --list-blueprints
  orbitforge --blueprint-file ./review-flow.json --parallel --prompt "Run this lifecycle"

Options:
  --provider         ollama | lmstudio | openai | anthropic | openrouter | openai-compatible
  --model            Model identifier
  --base-url         Override provider base URL
  --api-key          API key for hosted providers
  --prompt           Task prompt to run
  --workspace        Optional workspace context string
  --parallel         Run the built-in architect / implementer / critic trio
  --workflow         general | review | migration | incident | release
  --agents           Optional comma-separated agent list for parallel mode
  --list-components  Print the built-in lifecycle plugin components
  --list-blueprints  Print the built-in starter blueprints
  --blueprint-file   Load a lifecycle blueprint JSON file and attach it to the run
  --temperature      Optional temperature, default 0.2
  --json             Print the structured run result as JSON
  --help             Show this help message`)
}

function printLifecycleComponents() {
  const components = listLifecycleComponents()

  process.stdout.write(
    `OrbitForge lifecycle components\n\n${components
      .map((entry) => `- [${entry.stage}] ${entry.componentId}: ${entry.title} — ${entry.summary}`)
      .join('\n')}\n`
  )
}

function printBuiltInBlueprints() {
  process.stdout.write(
    `OrbitForge starter blueprints\n\n${builtInLifecycleBlueprints
      .map((entry) => `- ${entry.blueprintId}: ${entry.title} — ${entry.summary}`)
      .join('\n')}\n`
  )
}

function loadBlueprintFromFile(pathValue: string): OrbitForgeLifecycleBlueprint {
  return JSON.parse(readFileSync(pathValue, 'utf8')) as OrbitForgeLifecycleBlueprint
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  if (args['list-components']) {
    printLifecycleComponents()
    return
  }

  if (args['list-blueprints']) {
    printBuiltInBlueprints()
    return
  }

  const provider = String(args.provider || 'ollama') as ProviderId
  const defaults = getProviderDefaults(provider)
  const model = String(args.model || defaults.model)
  const prompt = String(args.prompt || '')
  const mode: AgentMode = args.parallel ? 'parallel' : 'single'
  const workflow: AgentWorkflow = parseWorkflow(typeof args.workflow === 'string' ? args.workflow : undefined) || 'general'
  const blueprint =
    typeof args['blueprint-file'] === 'string' ? loadBlueprintFromFile(String(args['blueprint-file'])) : undefined

  if (!prompt.trim()) {
    printHelp()
    process.exitCode = 1
    return
  }

  const result = await runOrbitForgeTask({
    provider,
    model,
    prompt,
    baseUrl: String(args['base-url'] || envOrDefault(provider)),
    apiKey: typeof args['api-key'] === 'string' ? args['api-key'] : undefined,
    workspaceContext: typeof args.workspace === 'string' ? args.workspace : undefined,
    temperature: typeof args.temperature === 'string' ? Number(args.temperature) : 0.2,
    mode,
    workflow,
    agents: typeof args.agents === 'string' ? parseAgentIds(args.agents) : undefined,
    blueprint,
  })

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  process.stdout.write(`${result.summary}\n\n${result.output}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'OrbitForge CLI failed.'}\n`)
  process.exit(1)
})
