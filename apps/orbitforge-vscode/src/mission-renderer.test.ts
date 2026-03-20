import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMissionOutput } from './mission-renderer'

test('extracts headings and renders core markdown structures', async () => {
  const payload = await renderMissionOutput(`
# Mission Board

Intro paragraph with \`inline code\`.

## Risks

- gate one
- gate two

> Keep rollback proof visible.

| Step | Owner |
| --- | --- |
| Validate | Critic |
`)

  assert.equal(payload.headings.length, 2)
  assert.deepEqual(payload.headings.map((heading) => heading.id), ['mission-board', 'risks'])
  assert.match(payload.renderedHtml, /<table>/)
  assert.match(payload.renderedHtml, /mission-board/)
  assert.match(payload.renderedHtml, /Keep rollback proof visible/)
})

test('classifies and decorates supported code families', async () => {
  const payload = await renderMissionOutput(`
## Languages

\`\`\`md
# docs
\`\`\`

\`\`\`py
print("hello")
\`\`\`

\`\`\`java
class Mission {}
\`\`\`

\`\`\`ts
const lane = "architect"
\`\`\`

\`\`\`json
{"ship": true}
\`\`\`

\`\`\`diff
- old
+ new
\`\`\`
`)

  assert.deepEqual(
    payload.codeBlocks.map((block) => [block.language, block.family]),
    [
      ['md', 'docs'],
      ['py', 'script'],
      ['java', 'typed'],
      ['ts', 'typed'],
      ['json', 'data'],
      ['diff', 'data'],
    ]
  )
  assert.match(payload.renderedHtml, /data-code-block-id="code-1"/)
  assert.match(payload.renderedHtml, /data-family="docs"/)
  assert.match(payload.renderedHtml, /data-family="script"/)
  assert.match(payload.renderedHtml, /data-family="typed"/)
  assert.match(payload.renderedHtml, /data-family="data"/)
})

test('falls back safely for unknown languages', async () => {
  const payload = await renderMissionOutput(`
\`\`\`brainfuck
+[>++++<-]>+.
\`\`\`
`)

  assert.equal(payload.codeBlocks.length, 1)
  assert.equal(payload.codeBlocks[0].family, 'generic')
  assert.match(payload.renderedHtml, /of-code-frame/)
  assert.doesNotMatch(payload.renderedHtml, /undefined/)
})

test('renders lane errors as navigable sections', async () => {
  const payload = await renderMissionOutput(`
## Architect Lane Error

model 'deepseek-coder:33b' not found

## Implementer Lane Error

Check installed Ollama models before dispatch.
`)

  assert.deepEqual(
    payload.headings.map((heading) => heading.text),
    ['Architect Lane Error', 'Implementer Lane Error']
  )
  assert.match(payload.renderedHtml, /Architect Lane Error/)
  assert.match(payload.renderedHtml, /Implementer Lane Error/)
  assert.match(payload.renderedHtml, /deepseek-coder:33b/)
})
