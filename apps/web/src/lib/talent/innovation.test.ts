import { describe, expect, it } from 'vitest'

import { buildBlastRadius, buildReleaseContract, buildShipMemo } from './innovation'

describe('buildReleaseContract', () => {
  it('derives deliverables and validations from the workspace context', () => {
    const contract = buildReleaseContract(
      'Refresh the web UI and docs, then update the API route.',
      'apps/web, apps/api, docs/readme, vscode'
    )

    expect(contract.deliverables).toContain('Shippable interface updates with responsive states')
    expect(contract.deliverables).toContain('Updated API contract or route behavior')
    expect(contract.validations).toContain('Run web build and route smoke checks')
    expect(contract.validations).toContain('Build and package the VS Code extension')
  })
})

describe('buildBlastRadius', () => {
  it('raises the risk tier when a prompt spans multiple product surfaces', () => {
    const blastRadius = buildBlastRadius(
      'Ship a release across web, api, cli, desktop, vscode, pricing, and docs.',
      'apps/web apps/api apps/talent-code-tool-cli apps/talent-code-tool-desktop apps/talent-code-tool-vscode README'
    )

    expect(blastRadius.score).toBeGreaterThanOrEqual(80)
    expect(blastRadius.riskLevel).toBe('critical')
    expect(blastRadius.requiredChecks.length).toBeGreaterThan(2)
    expect(blastRadius.releaseBlockers.length).toBeGreaterThan(0)
  })
})

describe('buildShipMemo', () => {
  it('includes the risk level and model takeaway in the generated memo', () => {
    const contract = buildReleaseContract('Write launch notes for the release.', 'docs readme')
    const blastRadius = buildBlastRadius('Write launch notes for the release.', 'docs readme')
    const memo = buildShipMemo('Write launch notes for the release.', 'ollama', 'qwen2.5-coder:7b', contract, blastRadius, 'Summarize the release path clearly.')

    expect(memo).toContain('CodeOrbit AI shipped a ollama/qwen2.5-coder:7b session')
    expect(memo).toContain(`Risk score: ${blastRadius.score}/100 (${blastRadius.riskLevel})`)
    expect(memo).toContain('Latest model takeaway:')
  })
})
