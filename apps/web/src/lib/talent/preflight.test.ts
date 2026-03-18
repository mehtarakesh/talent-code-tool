import { describe, expect, it } from 'vitest'

import { buildPreflightAssessment } from './preflight'

describe('buildPreflightAssessment', () => {
  it('blocks hosted providers without credentials', () => {
    const assessment = buildPreflightAssessment({
      provider: 'openai',
      model: 'gpt-4.1',
      prompt: 'Review the repo and prepare a release patch.',
      workspaceContext: 'apps/web apps/api README docs',
    })

    expect(assessment.gate).toBe('blocked')
    expect(assessment.checks.find((check) => check.id === 'auth')?.status).toBe('blocked')
    expect(assessment.summary).toContain('Preflight blocked')
    expect(assessment.hiddenPainAnalysis.faultlines.some((faultline) => faultline.title === 'Silent auth failure risk')).toBe(true)
    expect(assessment.missionLock.proofRequirements.length).toBeGreaterThan(0)
  })

  it('keeps local providers runnable and recommends a jury for high-risk changes', () => {
    const assessment = buildPreflightAssessment({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
      prompt: 'Ship a coordinated update across web, api, cli, desktop, vscode, docs, and pricing.',
      workspaceContext:
        'apps/web apps/api apps/talent-code-tool-cli apps/talent-code-tool-desktop apps/talent-code-tool-vscode docs README pricing release',
    })

    expect(assessment.checks.find((check) => check.id === 'auth')?.status).toBe('ready')
    expect(assessment.juryRecommendation.length).toBeGreaterThan(1)
    expect(assessment.blastRadius.requiredChecks.length).toBeGreaterThan(2)
    expect(assessment.recoveryPlan.length).toBeGreaterThan(1)
  })

  it('returns go for a scoped local run with enough context', () => {
    const assessment = buildPreflightAssessment({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
      prompt: 'Tighten the docs copy for the homepage.',
      workspaceContext: 'apps/web marketing homepage content and docs copy for the public site',
    })

    expect(assessment.gate).toBe('go')
    expect(assessment.readinessScore).toBeGreaterThan(60)
    expect(assessment.freshness.status).toBe('stable')
  })
})
