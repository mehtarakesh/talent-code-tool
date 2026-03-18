import { describe, expect, it } from 'vitest'

import { createSnapshot, deserializeSnapshots, mergeSnapshots, serializeSnapshots } from './vault'

describe('vault helpers', () => {
  it('creates labeled snapshots for continuity restore', () => {
    const snapshot = createSnapshot({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
      baseUrl: 'http://localhost:11434',
      prompt: 'Prepare a release-safe docs refresh.',
      workspaceContext: 'apps/web docs',
      gate: 'go',
      readinessScore: 88,
      outputPreview: 'Plan and validations',
    })

    expect(snapshot.label).toContain('ollama/qwen2.5-coder:7b')
    expect(snapshot.gate).toBe('go')
  })

  it('keeps the latest snapshots first and serializes cleanly', () => {
    const first = createSnapshot({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
      prompt: 'First',
      workspaceContext: 'apps/web',
      gate: 'draft',
    })
    const second = createSnapshot({
      provider: 'lmstudio',
      model: 'local-model',
      prompt: 'Second',
      workspaceContext: 'apps/web',
      gate: 'go',
    })

    const merged = mergeSnapshots([first], second)
    const roundTrip = deserializeSnapshots(serializeSnapshots(merged))

    expect(merged[0]?.prompt).toBe('Second')
    expect(roundTrip).toHaveLength(2)
    expect(roundTrip[1]?.prompt).toBe('First')
  })
})
