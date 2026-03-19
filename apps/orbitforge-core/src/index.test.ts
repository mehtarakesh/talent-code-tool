import test from 'node:test'
import assert from 'node:assert/strict'

import { parseAgentIds, parseWorkflow, runOrbitForgeTask, type ProviderInvocation } from './index'

test('single mode uses one provider invocation and returns the raw output', async () => {
  const invocations: ProviderInvocation[] = []

  const result = await runOrbitForgeTask(
    {
      provider: 'ollama',
      model: 'deepseek-coder:33b',
      baseUrl: 'http://localhost:11434',
      prompt: 'Plan the patch.',
    },
    {
      invoker: async (invocation) => {
        invocations.push(invocation)
        return 'single-agent-output'
      },
    }
  )

  assert.equal(result.mode, 'single')
  assert.equal(result.workflow, 'general')
  assert.match(result.output, /OrbitForge Single Agent Run/)
  assert.match(result.output, /single-agent-output/)
  assert.match(result.missionBoard, /Mission Board/)
  assert.equal(result.summary, 'Single agent run completed with a mission board.')
  assert.equal(invocations.length, 1)
})

test('parallel mode runs architect, implementer, critic, and a synthesis lane', async () => {
  const invocations: ProviderInvocation[] = []

  const result = await runOrbitForgeTask(
    {
      provider: 'ollama',
      model: 'deepseek-coder:33b',
      baseUrl: 'http://localhost:11434',
      prompt: 'Ship a new provider feature.',
      workspaceContext: 'CLI, desktop, and VS Code all need parity.',
      mode: 'parallel',
      workflow: 'migration',
    },
    {
      invoker: async (invocation) => {
        invocations.push(invocation)

        if (invocation.systemPrompt.includes('Synthesizer')) {
          return 'Merged recommendation'
        }

        if (invocation.systemPrompt.includes('Architect')) {
          return 'Architect output'
        }

        if (invocation.systemPrompt.includes('Implementer')) {
          return 'Implementer output'
        }

        return 'Critic output'
      },
    }
  )

  assert.equal(result.mode, 'parallel')
  assert.equal(result.workflow, 'migration')
  assert.equal(result.agents.length, 3)
  assert.equal(invocations.length, 4)
  assert.match(result.summary, /3\/3 agent lanes completed and converged/)
  assert.match(result.output, /Migration Flight Plan/)
  assert.match(result.output, /Mission Board/)
  assert.match(result.output, /Converged Recommendation/)
  assert.match(result.output, /Architect Lane/)
  assert.match(result.output, /Implementer Lane/)
  assert.match(result.output, /Critic Lane/)
})

test('parallel mode still returns lane output when one agent fails', async () => {
  const result = await runOrbitForgeTask(
    {
      provider: 'ollama',
      model: 'deepseek-coder:33b',
      baseUrl: 'http://localhost:11434',
      prompt: 'Find regressions.',
      mode: 'parallel',
      agents: ['architect', 'critic'],
    },
    {
      invoker: async (invocation) => {
        if (invocation.systemPrompt.includes('Critic')) {
          throw new Error('Critic lane failed')
        }

        return 'Architect survived'
      },
    }
  )

  assert.equal(result.agents.length, 2)
  assert.match(result.summary, /1\/2 agent lanes completed/)
  assert.match(result.output, /Critic lane failed/)
})

test('parseAgentIds removes duplicates and invalid agent names', () => {
  const agentIds = parseAgentIds('architect,critic,architect,unknown')

  assert.deepEqual(agentIds, ['architect', 'critic'])
})

test('parseWorkflow accepts known workflow ids only', () => {
  assert.equal(parseWorkflow('review'), 'review')
  assert.equal(parseWorkflow('release'), 'release')
  assert.equal(parseWorkflow('unknown'), undefined)
})

test('single review workflow exposes approval gates in the mission board', async () => {
  const result = await runOrbitForgeTask(
    {
      provider: 'ollama',
      model: 'deepseek-coder:33b',
      baseUrl: 'http://localhost:11434',
      prompt: 'Review this risky database change.',
      workflow: 'review',
    },
    {
      invoker: async () => 'review-output',
    }
  )

  assert.equal(result.workflow, 'review')
  assert.match(result.missionBoard, /Parallel Review/)
  assert.match(result.missionBoard, /Approval gates:/)
  assert.match(result.missionBoard, /proof gap/i)
})
