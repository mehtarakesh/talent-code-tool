# CodeOrbit AI

CodeOrbit AI is a model-agnostic coding workspace that runs as:

- A web app
- A VS Code extension
- A desktop app
- A cross-platform CLI

It is designed to keep teams out of vendor lock-in while still supporting the fast, agent-style coding workflow people want from tools like Claude Code. CodeOrbit can talk to Ollama, LM Studio, Anthropic, OpenAI, OpenRouter, and other OpenAI-compatible endpoints from one product family.

## Why This Is The Better Option

Most coding tools make you choose between two tradeoffs:

- Strong coding UX, but locked to one model vendor
- Broad model support, but weak release workflow and weak editor parity

CodeOrbit AI is positioned to close that gap.

### Better than single-vendor coding tools

- You can run local models through Ollama or LM Studio instead of being forced onto one hosted vendor.
- You can keep the same workflow across browser, desktop, CLI, and VS Code.
- You can switch providers without rebuilding the product surface.
- You can use the same repo for solo local work, team rollout, and enterprise packaging.

### Better than console-first multi-model tools

- It has a release story, not just a prompt box.
- It ships a website, docs, pricing, download center, extension, desktop app, and CLI together.
- It includes platform packaging for desktop and artifact packaging for CLI and VS Code.
- It is easier to explain internally because the product is organized around shipping work, not only chatting with models.

## Obvious Pain Points We Solve

These are not abstract AI problems. They are the practical reasons teams get stuck when they try to use coding agents in real work.

### 1. Teams get locked into one model vendor

Pain point:
- A lot of coding tools only work well with one hosted model provider.
- That makes it hard to use Ollama, LM Studio, or a cheaper fallback when cost, privacy, or rate limits matter.

How CodeOrbit AI solves it:
- The same product surfaces support Ollama, LM Studio, OpenAI, Anthropic, OpenRouter, and OpenAI-compatible endpoints.
- The provider layer is implemented once and reused across the web app, CLI, desktop app, and VS Code extension.

Why that matters:
- You keep the workflow and swap the model, instead of rebuilding the workflow every time the provider changes.

### 2. AI tools start risky runs without checking whether the task is actually ready

Pain point:
- Most tools let you send a prompt immediately, even if credentials are missing, the scope is too broad, or the task obviously needs review first.
- That creates failed runs, wasted tokens, and risky patches.

How CodeOrbit AI solves it:
- `Release Gate Preflight` scores readiness before execution.
- It checks model selection, endpoint strategy, credential readiness, workspace-context quality, and release risk.
- It can mark a run as `go`, `needs-review`, or `blocked` before the first model call starts.

Why that matters:
- The user gets stopped before an unsafe run, not after a bad output or broken release.

### 3. Teams do not know what a prompt might break

Pain point:
- Prompt-based tools usually help generate code, but they do not tell you what else will be affected.
- That means release risk stays invisible until much later.

How CodeOrbit AI solves it:
- `Blast Radius Simulator` estimates impacted areas, required checks, watchouts, and release blockers from the task and workspace context.
- It turns prompt scope into a visible risk score and a concrete validation plan.

Why that matters:
- The team sees the likely cost of the change before editing starts.

### 4. Acceptance criteria stay vague, so AI output is hard to review

Pain point:
- Prompts often say “build this” or “improve that,” but do not define deliverables, validation, or rollback expectations.
- Reviewers then have to guess what “done” means.

How CodeOrbit AI solves it:
- `Release Contract Generator` converts the prompt into explicit deliverables, validations, and rollback clauses.
- The contract is generated in the workbench before and during the run.

Why that matters:
- Review becomes objective instead of subjective.

### 5. One model answer is treated like truth

Pain point:
- Teams often trust the first model response without checking whether another model would disagree on the plan, edge cases, or implementation route.
- That is especially risky for release-sensitive work.

How CodeOrbit AI solves it:
- `Model Jury` runs the same task across multiple recommended model lanes.
- The preflight layer can recommend jury members automatically for higher-risk work.
- The jury view compares ballots, failures, and synthesis in one place.

Why that matters:
- You can compare before committing, instead of discovering disagreement after code lands.

### 6. Failed runs do not make the next run smarter

Pain point:
- When a model call fails, most tools just return an error string.
- The user is left to guess whether the problem was auth, network, missing model, or scope.

How CodeOrbit AI solves it:
- `Ops Ledger` records request outcomes, durations, and recovery notes.
- `Recovery Playbook` turns common failures into specific next-step guidance.

Why that matters:
- Retry quality improves because the tool explains what to do next.

### 7. Shipping stalls because docs and rollout notes are done last

Pain point:
- Even after the code is ready, teams still need README updates, feature summaries, launch notes, and release messaging.
- That work often gets skipped or delayed.

How CodeOrbit AI solves it:
- `Ship Memo Autowriter` produces public-facing rollout notes from the prompt, contract, blast radius, and latest model output.
- The docs site and README are part of the same product surface, not an afterthought.

Why that matters:
- The repo is easier to share publicly and easier to explain internally.

## Signature Features

These are the headline features this repo now centers on for public differentiation:

1. `Model Jury`
Run the same task across multiple model ballots and compare disagreement, speed, and output quality before committing to a risky path.

2. `Blast Radius Simulator`
Estimate which surfaces a change will hit and where validation effort needs to go before code generation starts.

3. `Release Contract Generator`
Turn prompts into explicit deliverables, validations, and rollback clauses instead of relying on implied acceptance criteria.

4. `Release Gate Preflight`
Score readiness before generation, block unsafe runs, recommend jury members, and generate a recovery playbook before the first risky request leaves the app.

5. `Ops Ledger`
Track run history, failures, and next-step recovery guidance so the tool gets better after failed attempts instead of just erroring out.

6. `Ship Memo Autowriter`
Generate public-facing rollout notes, README snippets, and launch summaries directly from the working session.

## Comparison

The Claude Code benchmark is based on Anthropic's public Claude Code documentation. `OpenConsole` could not be confidently tied to a single canonical public spec during this pass, so the comparison below uses the common baseline of browser-first multi-provider consoles.

| Capability | Claude Code style workflow | OpenConsole-style console | CodeOrbit |
| --- | --- | --- | --- |
| Native Ollama support | No | Partial | Yes |
| LM Studio preset | No | Partial | Yes |
| Browser workbench | Partial | Yes | Yes |
| VS Code extension | Partial | Usually no | Yes |
| Desktop app target | No | Usually no | Yes |
| CLI target | Partial | Usually no | Yes |
| Release-oriented docs and download center | No | No | Yes |
| Preflight release gate before model execution | No | No | Yes |
| Enterprise positioning without single-vendor lock-in | Partial | Partial | Yes |

## Repo Stats

Current CodeOrbit AI footprint in this repo:

- 4 user-facing surfaces: web, desktop, CLI, VS Code
- 6 provider families supported: Ollama, LM Studio, OpenAI, Anthropic, OpenRouter, OpenAI-compatible
- 14 Next.js page routes in `apps/web/src/app`
- 3 Talent web API routes, including a preflight release gate
- Core unit tests around preflight, provider routing helpers, and release heuristics

## Surfaces

### Web

- Product site
- Download center
- Docs
- Pricing
- Browser workbench with provider switching
- Release gate preflight with readiness scoring and blocked-check enforcement

Code:

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/app/page.tsx`
- `apps/web/src/app/docs/page.tsx`
- `apps/web/src/app/download/page.tsx`
- `apps/web/src/app/pricing/page.tsx`

### VS Code Extension

- Command palette integration
- Prompt panel
- Explain selection flow
- Workspace planning command

Code:

- `apps/codeorbit-ai-vscode/src/extension.ts`

### Desktop App

- Electron desktop shell
- Direct provider calls from desktop UI
- Packaging scripts for macOS, Windows, and Linux

Code:

- `apps/codeorbit-ai-desktop/src/main.ts`
- `apps/codeorbit-ai-desktop/src/preload.ts`
- `apps/codeorbit-ai-desktop/src/renderer/index.html`

### CLI

- `codeorbit` binary
- Works in Terminal, PowerShell, Command Prompt, and CI shells
- Supports hosted and local providers

Code:

- `apps/codeorbit-ai-cli/src/cli.ts`

## Provider Support

CodeOrbit currently ships presets for:

- Ollama
- LM Studio
- OpenAI
- Anthropic
- OpenRouter
- Any OpenAI-compatible endpoint

The web, desktop, and CLI surfaces all use this same provider model.

## Quick Start

```bash
npm install

# Build surfaces
npm run build:web
npm run test:web
npm run build:extension
npm run build:desktop
npm run build:cli

# Package artifacts
npm run package:extension
npm run package:cli
npm run package:desktop
```

## Platform Notes

### macOS

- Web: supported
- VS Code extension: supported
- Desktop: verified in this repo on March 17, 2026
- CLI: supported

### Windows

- Web: supported
- VS Code extension: supported
- Desktop: packaging scripts added via `npm run package:desktop:win`
- CLI: supported

### Linux

- Web: supported
- Desktop: packaging scripts added via `npm run package:desktop:linux`
- CLI: supported

## Verification Summary

Verified on March 17, 2026 on `Darwin arm64`, Node `v20.19.3`, npm `10.8.2`.

Successful checks:

- `npm install`
- `npm run build:web`
- `npm run test:web`
- `npm run build:extension`
- `npm run build:desktop`
- `npm run build:cli`
- `npm run build:extension`
- `npm run build:desktop`
- `npm run build:cli`
- Web smoke checks for `/api/talent/providers` and `/api/talent/preflight`
- 9 passing unit tests for provider helpers, release heuristics, and preflight gating

This publish repo contains the source-ready product surfaces and the root workspace manifest needed to build them together.

## Sources For The Comparison Framing

- Anthropic Claude Code docs: https://docs.anthropic.com/en/docs/claude-code
- Anthropic Claude Code overview: https://www.anthropic.com/claude-code

For `OpenConsole`, no single authoritative public spec was confidently verified during this pass, so the repo treats that comparison as a documented console-style baseline rather than a source-verified product claim.
