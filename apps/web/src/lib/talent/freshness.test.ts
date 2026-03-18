import { describe, expect, it } from 'vitest'

import { buildFreshnessAssessment } from './freshness'

describe('buildFreshnessAssessment', () => {
  it('flags high drift risk when fast-moving APIs are referenced without version pinning', () => {
    const assessment = buildFreshnessAssessment(
      'Recommend the best Stripe and OpenAI setup for production billing and assistants.',
      'apps/web integrations and deployment'
    )

    expect(assessment.status).toBe('high-drift-risk')
    expect(assessment.subjects).toContain('stripe')
    expect(assessment.liveProofRequests.length).toBeGreaterThan(0)
  })

  it('stays stable when the task is local and not dependency-driven', () => {
    const assessment = buildFreshnessAssessment(
      'Tighten the homepage copy and improve the release summary.',
      'apps/web docs and README copy'
    )

    expect(assessment.status).toBe('stable')
    expect(assessment.signals.length).toBe(0)
  })
})
