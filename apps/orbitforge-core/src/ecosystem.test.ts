import test from 'node:test'
import assert from 'node:assert/strict'

import {
  builtInLifecycleBlueprints,
  compileLifecycleBlueprint,
  listLifecycleComponents,
  validateLifecycleBlueprint,
} from './ecosystem'

test('lists built-in lifecycle components', () => {
  const components = listLifecycleComponents()

  assert.ok(components.some((entry) => entry.componentId === 'parallel-lanes'))
  assert.ok(components.some((entry) => entry.componentId === 'approval-gate'))
})

test('compiles starter blueprint into lifecycle markdown', () => {
  const blueprint = builtInLifecycleBlueprints[0]
  const compiled = compileLifecycleBlueprint(blueprint)

  assert.equal(compiled.issues.length, 0)
  assert.match(compiled.markdown, /Plugin Blueprint/)
  assert.match(compiled.markdown, /Lifecycle stages:/)
  assert.match(compiled.markdown, /Approval gates:/)
})

test('flags unknown components during blueprint validation', () => {
  const issues = validateLifecycleBlueprint({
    blueprintId: 'broken',
    title: 'Broken Flow',
    summary: 'Missing component test',
    goal: 'Catch unknown components',
    nodes: [{ nodeId: 'n1', componentId: 'does-not-exist' }],
  })

  assert.equal(issues[0], 'unknown component: does-not-exist')
})
