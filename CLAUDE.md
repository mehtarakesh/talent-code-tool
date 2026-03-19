# OrbitForge Claude Guide

This file gives Claude Code the persistent project context it needs to contribute usefully to the public OrbitForge repository.

## Repo Purpose

OrbitForge is the public repo for the local product surfaces behind `orbitforge.dev`.

This repo includes:

- `apps/orbitforge-core`
- `apps/orbitforge-vscode`
- `apps/orbitforge-desktop`
- `apps/orbitforge-cli`

This repo does not include:

- the hosted web app
- the marketing site
- private production infrastructure

Do not promise web-app changes from this repository. Keep public-repo claims scoped to the extension, desktop app, and CLI.

## Product Thesis

OrbitForge exists to solve a few specific problems:

- provider support drifting across product surfaces
- local models being treated as second-class
- AI output sounding complete without being release-ready
- risky implementation choices being made from a single unchallenged agent lane
- long tasks losing structure because approval gates, handoffs, and follow-up prompts are not explicit
- workspace context getting lost between editor, shell, and desktop

When making changes, optimize for those problems first.

## Surface Map

### VS Code extension

Path:
- `apps/orbitforge-vscode`

Key job:
- editor-native request flow
- selection and workspace-context helpers

### Desktop app

Path:
- `apps/orbitforge-desktop`

Key job:
- cross-platform GUI for provider-driven coding sessions

### CLI

Path:
- `apps/orbitforge-cli`

Key job:
- terminal-native execution for scripted or fast local workflows

### Shared orchestration core

Path:
- `apps/orbitforge-core`

Key job:
- shared provider invocation
- parallel agent orchestration
- workflow-aware mission boards
- shared result formatting

## Build Commands

```bash
npm install
npm run build:core
npm run test:core
npm run build:extension
npm run build:desktop
npm run build:cli
```

## Packaging Commands

```bash
npm run package:extension
npm run package:desktop
npm run package:desktop:mac
npm run package:desktop:win
npm run package:desktop:linux
npm run package:cli
```

## Critical Contribution Rules

### 1. Preserve provider parity

If you change provider logic in one surface, inspect the shared core and the other surfaces too.

The provider vocabulary should remain aligned across the repo:

- `ollama`
- `lmstudio`
- `openai`
- `anthropic`
- `openrouter`
- `openai-compatible`

### 2. Preserve the release-ready output contract

OrbitForge is not supposed to return vague prose. The response framing should continue to push toward:

1. plan
2. implementation approach
3. validation
4. remaining risks

Do not weaken that contract casually.

### 3. Preserve the parallel-agent framework

OrbitForge now has a built-in parallel trio:

- architect
- implementer
- critic

If you change that framework:

- keep the lanes intuitive
- keep the converged output readable
- keep the single-agent path fast
- avoid adding complexity that makes the feature feel like manual orchestration

### 4. Preserve workflow clarity

OrbitForge now has workflow presets:

- `general`
- `review`
- `migration`
- `incident`
- `release`

If you change them:

- keep the pain point and use case obvious
- keep approval gates actionable
- keep handoffs readable
- keep the workflow useful without needing a second explanation

### 5. Prefer local-first ergonomics

When choosing defaults, do not optimize only for hosted SaaS providers. Local Ollama and local OpenAI-compatible endpoints are a core part of the product story.

### 6. Keep docs honest

If a capability is private, partial, or not implemented in this public repo, say so plainly in the README or comments rather than implying it already exists.

### 7. Preserve the ecosystem contract

OrbitForge now exposes an open lifecycle ecosystem through `apps/orbitforge-core/src/ecosystem.ts`.

Treat that as a public contract.

New ecosystem work should strengthen:

- mission intake
- context packing
- parallel disagreement
- approval
- validation
- release
- publish

Avoid generic node sprawl that weakens the lifecycle thesis.

## Definition Of Done

A good OrbitForge change usually means:

- the affected surface still builds
- docs match what the code actually does
- provider changes were checked for parity
- user-facing errors are still actionable
- remaining risk is called out clearly

## High-Value Claude Code Tasks

Claude Code should prioritize these over generic cleanup:

- shared provider adapter extraction
- stronger convergence heuristics for the parallel-agent runtime
- workflow-specific mission-board improvements and interactive checkpoints
- consistent response parsing and error normalization
- packaging verification improvements for Windows and Linux
- secure credential handling improvements
- workspace-context fidelity improvements across surfaces
- ecosystem blueprint portability and validation
- lifecycle starter kits for review, migration, incident, and release work

## OrbitForge Project Skills

Available project skills:

- `/provider-parity-audit`
- `/surface-shipping-check`
- `/parallel-agent-upgrade`
- `/ecosystem-plugin-author`

Use them when the task matches. They are meant to keep contributions focused on product risk instead of random refactors.
