import MarkdownIt from 'markdown-it'

export type MissionHeading = {
  id: string
  text: string
  level: number
}

export type CodeFamily = 'docs' | 'script' | 'typed' | 'data' | 'generic'

export type MissionCodeBlock = {
  id: string
  language: string
  displayLanguage: string
  family: CodeFamily
  content: string
}

export type MissionRenderPayload = {
  renderedHtml: string
  headings: MissionHeading[]
  codeBlocks: MissionCodeBlock[]
}

type RenderEnv = {
  headings: MissionHeading[]
  codeBlocks: MissionCodeBlock[]
  usedHeadingIds: Set<string>
  renderedCodeByIndex: Record<number, string>
}

type ResolvedLanguage = {
  language: string
  shikiLanguage:
    | 'md'
    | 'python'
    | 'java'
    | 'ts'
    | 'tsx'
    | 'javascript'
    | 'jsx'
    | 'json'
    | 'bash'
    | 'yaml'
    | 'sql'
    | 'diff'
    | 'text'
  displayLanguage: string
  family: CodeFamily
}

const markdownEngine = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
})

let highlighterPromise: Promise<{ codeToHtml: (code: string, options: Record<string, unknown>) => string }> | null = null

type MarkdownRule = ((...args: any[]) => string) | undefined

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

  return slug || 'section'
}

function uniqueHeadingId(text: string, usedIds: Set<string>) {
  const base = slugify(text)
  let candidate = base
  let counter = 2

  while (usedIds.has(candidate)) {
    candidate = `${base}-${counter}`
    counter += 1
  }

  usedIds.add(candidate)
  return candidate
}

function resolveLanguage(info: string): ResolvedLanguage {
  const normalized = info.trim().split(/\s+/)[0]?.toLowerCase() || 'text'

  switch (normalized) {
    case 'md':
    case 'markdown':
      return { language: 'md', shikiLanguage: 'md', displayLanguage: 'MD', family: 'docs' }
    case 'py':
    case 'python':
      return { language: 'py', shikiLanguage: 'python', displayLanguage: 'PY', family: 'script' }
    case 'java':
      return { language: 'java', shikiLanguage: 'java', displayLanguage: 'JAVA', family: 'typed' }
    case 'ts':
    case 'typescript':
      return { language: 'ts', shikiLanguage: 'ts', displayLanguage: 'TS', family: 'typed' }
    case 'tsx':
      return { language: 'tsx', shikiLanguage: 'tsx', displayLanguage: 'TSX', family: 'typed' }
    case 'js':
    case 'javascript':
      return { language: 'js', shikiLanguage: 'javascript', displayLanguage: 'JS', family: 'typed' }
    case 'jsx':
      return { language: 'jsx', shikiLanguage: 'jsx', displayLanguage: 'JSX', family: 'typed' }
    case 'json':
      return { language: 'json', shikiLanguage: 'json', displayLanguage: 'JSON', family: 'data' }
    case 'bash':
    case 'sh':
    case 'shell':
    case 'zsh':
      return { language: 'bash', shikiLanguage: 'bash', displayLanguage: 'BASH', family: 'script' }
    case 'yaml':
    case 'yml':
      return { language: 'yaml', shikiLanguage: 'yaml', displayLanguage: 'YAML', family: 'data' }
    case 'sql':
      return { language: 'sql', shikiLanguage: 'sql', displayLanguage: 'SQL', family: 'data' }
    case 'diff':
    case 'patch':
      return { language: 'diff', shikiLanguage: 'diff', displayLanguage: 'DIFF', family: 'data' }
    default:
      return {
        language: normalized || 'text',
        shikiLanguage: 'text',
        displayLanguage: (normalized || 'text').toUpperCase(),
        family: 'generic',
      }
  }
}

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(async ({ createHighlighter }) =>
      (await createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['md', 'python', 'java', 'ts', 'tsx', 'javascript', 'jsx', 'json', 'bash', 'yaml', 'sql', 'diff', 'text'],
      })) as unknown as { codeToHtml: (code: string, options: Record<string, unknown>) => string }
    )
  }

  return highlighterPromise
}

function renderPlainCode(code: string) {
  return `<pre class="of-plain-code"><code>${escapeHtml(code)}</code></pre>`
}

async function renderCodeBlock(block: MissionCodeBlock, resolvedLanguage: ResolvedLanguage) {
  try {
    const highlighter = await getHighlighter()
    return highlighter.codeToHtml(block.content, {
      lang: resolvedLanguage.shikiLanguage,
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    })
  } catch {
    return renderPlainCode(block.content)
  }
}

function wrapCodeBlock(block: MissionCodeBlock, codeHtml: string) {
  return `<figure class="of-code-frame" data-code-block-id="${escapeHtml(block.id)}" data-family="${escapeHtml(block.family)}">
    <figcaption class="of-code-toolbar">
      <div class="of-code-meta">
        <span class="of-code-badge">${escapeHtml(block.displayLanguage)}</span>
        <span class="of-code-family">${escapeHtml(block.family)}</span>
      </div>
      <button type="button" class="of-code-copy" data-copy-code="${escapeHtml(block.id)}">Copy</button>
    </figcaption>
    <div class="of-code-surface">${codeHtml}</div>
  </figure>`
}

export async function renderMissionOutput(markdown: string): Promise<MissionRenderPayload> {
  const env: RenderEnv = {
    headings: [],
    codeBlocks: [],
    usedHeadingIds: new Set<string>(),
    renderedCodeByIndex: {},
  }
  const tokens = markdownEngine.parse(markdown, env as never) as Array<{
    type: string
    tag: string
    info: string
    content: string
    attrSet?: (name: string, value: string) => void
  }>

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token.type === 'heading_open') {
      const nextToken = tokens[index + 1]
      const text = nextToken?.content?.trim() || `Section ${env.headings.length + 1}`
      const id = uniqueHeadingId(text, env.usedHeadingIds)
      const level = Number(token.tag.replace('h', '')) || 2
      token.attrSet?.('id', id)
      env.headings.push({ id, text, level })
      continue
    }

    if (token.type === 'link_open') {
      token.attrSet?.('target', '_blank')
      token.attrSet?.('rel', 'noreferrer noopener')
      continue
    }

    if (token.type === 'fence' || token.type === 'code_block') {
      const resolvedLanguage = resolveLanguage(token.info || 'text')
      const block: MissionCodeBlock = {
        id: `code-${env.codeBlocks.length + 1}`,
        language: resolvedLanguage.language,
        displayLanguage: resolvedLanguage.displayLanguage,
        family: resolvedLanguage.family,
        content: token.content,
      }
      env.codeBlocks.push(block)
      const highlightedHtml = await renderCodeBlock(block, resolvedLanguage)
      env.renderedCodeByIndex[index] = wrapCodeBlock(block, highlightedHtml)
    }
  }

  const defaultFenceRule = markdownEngine.renderer.rules.fence as MarkdownRule
  const defaultCodeBlockRule = markdownEngine.renderer.rules.code_block as MarkdownRule

  markdownEngine.renderer.rules.fence = (...args: any[]) => {
    const [_tokens, idx, options, internalEnv, self] = args
    const renderEnv = internalEnv as RenderEnv
    return (
      renderEnv.renderedCodeByIndex[idx] ||
      defaultFenceRule?.(_tokens, idx, options, internalEnv, self) ||
      renderPlainCode(_tokens[idx]?.content || '')
    )
  }

  markdownEngine.renderer.rules.code_block = (...args: any[]) => {
    const [_tokens, idx, options, internalEnv, self] = args
    const renderEnv = internalEnv as RenderEnv
    return (
      renderEnv.renderedCodeByIndex[idx] ||
      defaultCodeBlockRule?.(_tokens, idx, options, internalEnv, self) ||
      renderPlainCode(_tokens[idx]?.content || '')
    )
  }

  const renderedHtml = markdownEngine.renderer.render(tokens as never, markdownEngine.options, env as never)

  markdownEngine.renderer.rules.fence = defaultFenceRule
  markdownEngine.renderer.rules.code_block = defaultCodeBlockRule

  return {
    renderedHtml,
    headings: env.headings,
    codeBlocks: env.codeBlocks,
  }
}
