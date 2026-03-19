# OrbitForge Plugin Ecosystem

OrbitForge is not trying to be a generic node canvas.

The bigger problem is that most agent tooling still leaves the hardest engineering work outside the graph:

- mission intake
- context packing
- parallel disagreement
- human approval
- validation proof
- release control
- publish handoff

That is the gap OrbitForge targets.

## The Pain This Solves

Typical workflow tools help a team automate steps.

They do not necessarily make risky engineering work more trustworthy.
The hidden failures usually happen between steps:

- nobody locked the non-goals before agents started improvising
- context lived in three tabs and one person’s head
- one model answer sounded good enough, so nobody forced dissent
- the run ended with output, but not with approval criteria or proof
- release notes, rollback, and ownership were still manual cleanup

OrbitForge turns those lifecycle gaps into explicit components and blueprints.

## What A Plugin Means In OrbitForge

OrbitForge has two open layers:

1. Component manifests
   These define reusable lifecycle building blocks such as `mission-intake`, `context-pack`, `parallel-lanes`, `approval-gate`, `validation-matrix`, `release-gate`, and `publish-pack`.

2. Lifecycle blueprints
   These are JSON contracts that assemble components into a complete agentic workflow.

The shared runtime lives in:

- `apps/orbitforge-core/src/ecosystem.ts`
- `apps/orbitforge-core/src/index.ts`

## Why This Is Bigger Than Workflow-Only Agent Nodes

The official n8n docs describe an agent as a decision-maker that chooses tools during a workflow run. That is useful, but it still treats the agent as one step inside a broader automation graph.

OrbitForge is solving a different problem:

- not just how an agent chooses tools
- but how teams govern the entire lifecycle around agentic work

In OrbitForge, a blueprint can define:

- who owns the mission
- what context is admissible
- which lanes must disagree in parallel
- where a human must approve
- which proof is required
- what release and publish obligations exist

That makes OrbitForge better suited for high-trust coding, migration, incident, and release workflows where the failure mode is not “missing automation,” but “fluent output with weak stewardship.”

## Current Open Contract

Built-in lifecycle stages:

- `intake`
- `context`
- `parallelize`
- `approval`
- `validation`
- `release`
- `publish`

Built-in starter kits:

- `parallel-review-kit`
- `migration-flight-plan`

CLI support:

- `orbitforge --list-components`
- `orbitforge --list-blueprints`
- `orbitforge --blueprint-file ./my-flow.json`

## Contributor Model

Good ecosystem contributions for OrbitForge are not random nodes.

High-value contributions:

- stronger lifecycle components for review, migration, incident, and release
- validation components that force evidence, rollback, or ownership
- better blueprint starter kits for real engineering use cases
- runtime improvements that keep blueprint behavior consistent across CLI, desktop, and VS Code
- docs that explain the lifecycle problem clearly and honestly

Weak contributions:

- components that duplicate existing lifecycle stages without improving trust
- features that only work in one surface
- automation that produces output without adding approval, proof, or release structure

## Blueprint Example

```json
{
  "blueprintId": "review-kit",
  "title": "Parallel Review Kit",
  "summary": "A review flow with dissent, approval, and proof before merge.",
  "goal": "Turn risky review work into a structured disagreement-and-proof workflow.",
  "visibility": "community",
  "nodes": [
    { "componentId": "mission-intake", "label": "Review Brief", "notes": "", "config": { "owner": "Release engineer" } },
    { "componentId": "context-pack", "label": "Surface Context", "notes": "", "config": { "sources": "PR diff, tests, architecture notes" } },
    { "componentId": "parallel-lanes", "label": "Review Lanes", "notes": "", "config": { "workflow": "review", "lanes": "architect,implementer,critic" } },
    { "componentId": "approval-gate", "label": "Human Sign-off", "notes": "", "config": { "criteria": "Findings are evidence-backed." } }
  ]
}
```

## How To Contribute

1. Read `CLAUDE.md`.
2. Read `.claude/rules/ecosystem-contract.md`.
3. Use `.claude/skills/ecosystem-plugin-author/SKILL.md` if you are contributing through Claude Code.
4. Keep the blueprint contract plain JSON and cross-surface.
5. Add tests in `apps/orbitforge-core/src/*.test.ts`.
