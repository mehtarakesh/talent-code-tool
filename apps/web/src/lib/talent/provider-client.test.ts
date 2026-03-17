import { describe, expect, it } from 'vitest'

import { buildMessages, normalizeBaseUrl } from './provider-client'

describe('normalizeBaseUrl', () => {
  it('trims a trailing slash from custom provider URLs', () => {
    expect(normalizeBaseUrl('ollama', 'http://localhost:11434/')).toBe('http://localhost:11434')
  })

  it('falls back to provider defaults when no custom URL is provided', () => {
    expect(normalizeBaseUrl('lmstudio')).toBe('http://localhost:1234/v1')
  })
})

describe('buildMessages', () => {
  it('embeds workspace context and prompt into the user message', () => {
    const messages = buildMessages({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
      prompt: 'Plan the next patch.',
      workspaceContext: 'apps/web and docs are active',
    })

    expect(messages).toHaveLength(2)
    expect(messages[1]?.content).toContain('Workspace context:')
    expect(messages[1]?.content).toContain('Plan the next patch.')
  })
})
