export type ProviderDefinition = {
  id: string
  name: string
  tagline: string
  baseUrl: string
  localFirst: boolean
  apiStyle: 'ollama' | 'anthropic' | 'openai-compatible'
  models: string[]
  strengths: string[]
}

export type InnovationFeatureCard = {
  title: string
  detail: string
}

export const providerCatalog: ProviderDefinition[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    tagline: 'Best for private local coding sessions',
    baseUrl: process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434',
    localFirst: true,
    apiStyle: 'ollama',
    models: ['deepseek-coder:33b', 'qwen2.5-coder:32b', 'codellama:34b'],
    strengths: ['Local inference', 'Offline-friendly', 'Strong code editing loops'],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    tagline: 'Desktop-hosted OpenAI-compatible endpoint',
    baseUrl: process.env.NEXT_PUBLIC_LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
    localFirst: true,
    apiStyle: 'openai-compatible',
    models: ['local-model', 'deepseek-coder', 'qwen-coder'],
    strengths: ['Works with desktop models', 'OpenAI-compatible', 'Fast local iteration'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'Cloud frontier models for coding and reasoning',
    baseUrl: process.env.NEXT_PUBLIC_OPENAI_BASE_URL || 'https://api.openai.com/v1',
    localFirst: false,
    apiStyle: 'openai-compatible',
    models: ['gpt-4.1', 'gpt-4o', 'o4-mini'],
    strengths: ['Tool use', 'Strong coding quality', 'Large ecosystem'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    tagline: 'Claude-family models for long-horizon coding tasks',
    baseUrl: process.env.NEXT_PUBLIC_ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    localFirst: false,
    apiStyle: 'anthropic',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1'],
    strengths: ['Long context', 'Strong planning', 'Reliable refactors'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Broker multiple hosted models behind one endpoint',
    baseUrl: process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    localFirst: false,
    apiStyle: 'openai-compatible',
    models: ['anthropic/claude-sonnet-4', 'openai/gpt-4.1', 'google/gemini-2.0-flash'],
    strengths: ['Model brokering', 'Fallback routing', 'Provider diversity'],
  },
]

export const featureColumns = [
  {
    title: 'Model Jury',
    detail: 'Compare multiple model ballots on the same task before a risky implementation lands.',
  },
  {
    title: 'Blast Radius Simulator',
    detail: 'Estimate what a change touches, how risky it is, and where verification effort should go.',
  },
  {
    title: 'Release Contract + Ship Memo',
    detail: 'Turn prompts into explicit acceptance criteria and public-facing rollout notes in the same session.',
  },
  {
    title: 'Release Gate Preflight',
    detail: 'Score readiness, catch missing credentials or weak workspace context, and stop unsafe runs before they start.',
  },
]

export const innovationFeatureCards: InnovationFeatureCard[] = [
  {
    title: 'Model Jury',
    detail: 'A first-class multi-model ballot system to expose disagreement, latency, and confidence before you commit.',
  },
  {
    title: 'Blast Radius Simulator',
    detail: 'Heuristic risk analysis that predicts impacted surfaces and validation hotspots before code changes begin.',
  },
  {
    title: 'Release Contract Generator',
    detail: 'Transforms vague prompts into deliverables, validations, and rollback clauses that reviewers can enforce.',
  },
  {
    title: 'Release Gate Preflight',
    detail: 'Adds a real release gate with readiness scoring, blocked checks, recommended jury members, and retry playbooks.',
  },
  {
    title: 'Ops Ledger',
    detail: 'Stores run history, failures, and next-step suggestions so retries improve instead of repeating the same mistake.',
  },
  {
    title: 'Ship Memo Autowriter',
    detail: 'Generates public-facing notes, README snippets, and launch summaries directly from the working session.',
  },
]

export const comparisonRows = [
  {
    feature: 'Native Ollama support',
    claudeCode: 'No',
    openConsole: 'Partial',
    talent: 'Yes',
  },
  {
    feature: 'LM Studio preset',
    claudeCode: 'No',
    openConsole: 'Partial',
    talent: 'Yes',
  },
  {
    feature: 'Release checklist and launch pack',
    claudeCode: 'Partial',
    openConsole: 'No',
    talent: 'Yes',
  },
  {
    feature: 'Website, docs, pricing, downloads in one surface',
    claudeCode: 'No',
    openConsole: 'No',
    talent: 'Yes',
  },
  {
    feature: 'VS Code + web product parity',
    claudeCode: 'Partial',
    openConsole: 'No',
    talent: 'Yes',
  },
  {
    feature: 'First-class multi-model jury workflow',
    claudeCode: 'No',
    openConsole: 'Partial',
    talent: 'Yes',
  },
  {
    feature: 'Blast-radius simulation before editing',
    claudeCode: 'No',
    openConsole: 'No',
    talent: 'Yes',
  },
  {
    feature: 'Autogenerated release contract and ship memo',
    claudeCode: 'Partial',
    openConsole: 'No',
    talent: 'Yes',
  },
  {
    feature: 'Preflight release gate before model execution',
    claudeCode: 'No',
    openConsole: 'No',
    talent: 'Yes',
  },
]

export const releaseChecklist = [
  'Provider configured and reachable',
  'Prompt plan reviewed before generation',
  'Patch summary captured for reviewers',
  'Release preflight gate reviewed',
  'Validation commands pass locally',
  'Extension package builds successfully',
  'Website docs and pricing updated',
]

export const pricingPlans = [
  {
    name: 'Starter',
    price: '$0',
    audience: 'Solo builders validating local and hosted models',
    features: ['Web app access', '1 local workspace', 'Manual provider setup', 'Community docs'],
  },
  {
    name: 'Pro',
    price: '$39',
    audience: 'Engineers shipping across cloud and local providers',
    features: ['VS Code extension', 'Provider presets', 'Reusable prompt kits', 'Release workbench'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    audience: 'Platform teams standardizing coding workflows',
    features: ['SSO and policy packs', 'Shared model registry', 'Audit exports', 'Priority onboarding'],
  },
]

export const downloadArtifacts = [
  {
    name: 'CodeOrbit Web',
    detail: 'Browser workspace for planning, patching, and release coordination.',
    href: '/app',
  },
  {
    name: 'CodeOrbit for macOS',
    detail: 'Electron desktop target configured for DMG and ZIP packaging.',
    href: '/docs#desktop',
  },
  {
    name: 'CodeOrbit for Windows',
    detail: 'Electron desktop target configured for NSIS installer and ZIP packaging.',
    href: '/docs#desktop',
  },
  {
    name: 'CodeOrbit for Linux',
    detail: 'Electron desktop target configured for AppImage and tar.gz packaging.',
    href: '/docs#desktop',
  },
  {
    name: 'CodeOrbit CLI for macOS, Linux, and Windows',
    detail: 'Cross-platform Node CLI with the `codeorbit` binary.',
    href: '/docs#cli',
  },
  {
    name: 'CodeOrbit VS Code Extension',
    detail: 'Workspace package ready to build into a VSIX.',
    href: '/docs#vscode-extension',
  },
  {
    name: 'Launch Docs',
    detail: 'Setup guides, provider recipes, and enterprise rollout notes.',
    href: '/docs',
  },
]

export const docsSections = [
  {
    id: 'overview',
    title: 'Overview',
    body: 'CodeOrbit AI is a model-agnostic coding copilot with first-class support for Ollama, LM Studio, Anthropic, OpenAI, and OpenAI-compatible endpoints.',
  },
  {
    id: 'gap-analysis',
    title: 'Gap Analysis',
    body: 'This release closes the biggest gaps we found when comparing Claude Code-style agent workflows with console-first multi-model UIs: local-provider parity, release readiness, product packaging, and editor/browser consistency.',
  },
  {
    id: 'signature-features',
    title: 'Signature Features',
    body: 'The current public-share build centers on five signature features plus a release gate layer: Model Jury, Blast Radius Simulator, Release Contract Generator, Ops Ledger, Ship Memo Autowriter, and Release Gate Preflight.',
  },
  {
    id: 'release-gate',
    title: 'Release Gate Preflight',
    body: 'Before a run starts, the preflight engine scores readiness, validates credentials and endpoint strategy, flags missing workspace context, recommends jury members, and blocks obviously unsafe release attempts.',
  },
  {
    id: 'providers',
    title: 'Provider Setup',
    body: 'Use native Ollama for localhost 11434, LM Studio for localhost 1234/v1, or any OpenAI-compatible endpoint. Anthropic support uses the native Messages API path.',
  },
  {
    id: 'vscode-extension',
    title: 'VS Code Extension',
    body: 'Install dependencies at the repo root, run the extension build script, then package with VSCE for distribution. The extension exposes panel, selection, and workspace commands.',
  },
  {
    id: 'desktop',
    title: 'Desktop Apps',
    body: 'The Electron desktop client packages for macOS, Windows, and Linux. Use the builder targets for DMG, NSIS, AppImage, ZIP, and tar.gz outputs depending on platform.',
  },
  {
    id: 'cli',
    title: 'CLI',
    body: 'The CLI ships as the `codeorbit` binary and works in Terminal, PowerShell, Command Prompt, or any POSIX shell that supports Node 18+.',
  },
  {
    id: 'enterprise',
    title: 'Enterprise Rollout',
    body: 'Enterprise teams can standardize provider registries, capture release receipts, and share curated model presets without locking the team to a single vendor.',
  },
]
