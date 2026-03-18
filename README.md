# CodeOrbit AI

CodeOrbit AI is a model-agnostic coding workspace that runs as:

- A web app
- A VS Code extension
- A desktop app
- A cross-platform CLI

It is designed to keep teams out of vendor lock-in while still supporting the fast, agent-style coding workflow people want from tools like Claude Code. CodeOrbit can talk to Ollama, LM Studio, Anthropic, OpenAI, OpenRouter, and other OpenAI-compatible endpoints from one product family.

## At A Glance

- `Web app`: browser workbench, docs, pricing, downloads
- `VS Code extension`: panel, selection explain, workspace planning
- `Desktop app`: Electron shell for macOS, Windows, Linux
- `CLI`: cross-platform `codeorbit` binary
- `Providers`: Ollama, LM Studio, OpenAI, Anthropic, OpenRouter, OpenAI-compatible
- `Release layer`: mission lock, proof gate, preflight gate, blast radius, release contract, model jury, hidden pain detector, freshness sentinel, continuity vault, auto-heal recovery, session capsule, ops ledger, ship memo

## Install Matrix

| Surface | Status | Build Command | Notes |
| --- | --- | --- | --- |
| Web | Ready | `npm run build:web` | Includes product site and workbench |
| VS Code | Ready | `npm run build:extension` | Package with `npm run package:extension` |
| Desktop | Ready | `npm run build:desktop` | Package on target OS for final installers |
| CLI | Ready | `npm run build:cli` | Cross-platform Node CLI |

## Architecture

CodeOrbit AI is organized as one release-focused product family:

1. `apps/web` handles the public site, browser workbench, and provider-backed API routes.
2. `apps/codeorbit-ai-vscode` gives the same workflow inside VS Code.
3. `apps/codeorbit-ai-desktop` wraps the product in an Electron shell for desktop delivery.
4. `apps/codeorbit-ai-cli` exposes the same provider model for shell and CI usage.
5. The shared release logic lives in the web product layer through provider routing, preflight assessment, blast-radius analysis, and ship-summary generation.

Request flow:

`Prompt -> Mission Lock + Release Gate Preflight + Hidden Pain Detector -> Proof Requirements + Blast Radius -> Primary Run / Auto-Heal Recovery / Model Jury -> Proof Gate -> Ops Ledger -> Session Capsule + Ship Memo`

## The Revolutionary Problem This Repo Solves

The biggest unsolved problem in AI coding is not raw model quality.

It is this:

`Humans lose control of the original assignment once the workflow becomes iterative.`

That failure shows up as:

- silent intent drift
- polished but unproven answers
- users re-explaining the same constraints across tools
- teams trusting “done” language without real proof

CodeOrbit AI is built to solve that workflow failure directly through `Mission Lock` and `Proof Gate`.

### Mission Lock

Mission Lock freezes:

- the true north-star objective
- immutable constraints
- non-goals
- proof requirements

So the system does not quietly drift away from the real assignment as the run evolves.

### Proof Gate

Proof Gate checks whether the output is:

- evidence-backed
- missing validation
- making unsupported completion claims
- safe enough for human review

So the user stops rewarding confident-sounding answers that have no proof behind them.

### Why this is revolutionary

Most tools optimize for generating an answer.

CodeOrbit AI optimizes for preserving the original human intent and measuring whether the answer is trustworthy.

That changes the role of the tool from:

- “generate something helpful”

to:

- “protect the assignment from drift and refuse to confuse confidence with completion”

### Example

Prompt:

`Ship a fast release for web, docs, and pricing without breaking local-provider support.`

What CodeOrbit AI does differently:

1. `Mission Lock` freezes:
   - keep local-provider support
   - update web, docs, and pricing together
   - do not call this done without proof
2. `Hidden Pain Detector` warns that “fast release” conflicts with a multi-surface blast radius
3. `Proof Gate` will reject output that says “production-ready” without build, smoke-check, or validation evidence
4. `Auto-Heal Recovery` can recover if the chosen provider lane fails

The result:

- the assignment stays intact
- the user sees hidden contradictions early
- output is judged by proof, not tone

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

## Deep Pain Points Most People Miss

These are the more dangerous problems because teams usually do not name them directly.

### Hidden pain point: humans are carrying invisible coordination work in their heads

What usually happens:
- The prompt sounds clear to the author, but it quietly depends on missing repo context, unstated owners, and invisible release tasks.
- When the output goes wrong, people say “the model was bad” even though the actual failure was hidden human context.

How CodeOrbit AI handles it:
- `Hidden Pain Detector` scores operator burden.
- It surfaces contradiction-heavy prompts, missing inputs, invisible costs, and faultlines before the run.

Why this changes everything:
- The tool starts reducing human orchestration load, not just generating text.

### Hidden pain point: teams forget that the original task is the first thing to get corrupted

What usually happens:
- The first prompt contains the real intent.
- A few iterations later, the workflow is now optimizing for what the model last said, not what the human originally needed.

How CodeOrbit AI handles it:
- `Mission Lock` freezes the original assignment into a reusable structure.
- The workbench shows immutable constraints, non-goals, proof requirements, and drift risks before generation.

Why this changes everything:
- The system becomes accountable to the assignment, not just to the latest response.

### Hidden pain point: polished language tricks humans into trusting unfinished work

What usually happens:
- An answer sounds complete because it says things like “implemented”, “fixed”, or “production-ready”.
- The team moves forward before anyone notices the proof is missing.

How CodeOrbit AI handles it:
- `Proof Gate` scores trust, flags unsupported completion claims, and lists the missing evidence.
- This creates a visible difference between “well-written output” and “proven output”.

Why this changes everything:
- It directly attacks the false-confidence loop that makes AI coding dangerous.

### Hidden pain point: switching tools destroys momentum more than model quality does

What usually happens:
- A good run in the browser does not transfer cleanly to desktop, CLI, or editor workflows.
- The human manually restates the task, forgets key constraints, and loses continuity.

How CodeOrbit AI handles it:
- `Session Capsule` packages the exact run state into a portable payload.
- Another surface can restore the same provider lane, prompt, workspace context, and release status.

Why this changes everything:
- The workflow becomes continuous across surfaces instead of resetting every time the user changes tools.

### Hidden pain point: community advice gets stale faster than AI tools admit

What usually happens:
- Users ask for the “best” SDK, package, or integration pattern.
- The model answers confidently, but the recommendation is already stale because APIs, pricing, and platform behavior moved.

How CodeOrbit AI handles it:
- `Freshness Sentinel` detects fast-moving dependencies and raises a live-verification requirement.
- It asks for canonical docs, pinned versions, and maintenance signals before trusting the generated guidance.

Why this changes everything:
- The tool stops turning stale internet memory into fresh technical debt.

### Hidden pain point: checkpointing is fragile right when confidence is highest

What usually happens:
- A strong run is interrupted by a refresh, crash, or surface switch.
- The user loses the exact state that made the run valuable.

How CodeOrbit AI handles it:
- `Continuity Vault` stores automatic local snapshots of the workbench state.
- The user can restore a strong run without reconstructing the entire context from memory.

Why this changes everything:
- Good sessions survive interruption instead of disappearing at the worst possible moment.

### Hidden pain point: provider failure recovery is treated like the user's job

What usually happens:
- Missing models, auth problems, and network failures push the user into manual retry loops.
- The human becomes the fallback router.

How CodeOrbit AI handles it:
- `Auto-Heal Recovery Lanes` prepare safer fallback routes before the run.
- The chat execution path can recover through alternative lanes when a failure is recoverable.

Why this changes everything:
- Reliability improves without asking the user to become an expert in provider debugging.

## Signature Features

These are the headline features this repo now centers on for public differentiation:

1. `Mission Lock`
Freeze the true assignment into immutable constraints, non-goals, and proof requirements before the run can drift.

2. `Proof Gate`
Score whether the output is actually evidence-backed and reject confident but unsupported completion language.

3. `Model Jury`
Run the same task across multiple model ballots and compare disagreement, speed, and output quality before committing to a risky path.

4. `Blast Radius Simulator`
Estimate which surfaces a change will hit and where validation effort needs to go before code generation starts.

5. `Release Contract Generator`
Turn prompts into explicit deliverables, validations, and rollback clauses instead of relying on implied acceptance criteria.

6. `Release Gate Preflight`
Score readiness before generation, block unsafe runs, recommend jury members, and generate a recovery playbook before the first risky request leaves the app.

7. `Ops Ledger`
Track run history, failures, and next-step recovery guidance so the tool gets better after failed attempts instead of just erroring out.

8. `Ship Memo Autowriter`
Generate public-facing rollout notes, README snippets, and launch summaries directly from the working session.

9. `Hidden Pain Detector`
Find contradictions, missing assumptions, invisible coordination costs, and unspoken proof gaps before they sabotage the run.

10. `Session Capsule`
Carry the same run across web, desktop, CLI, and editor surfaces without rebuilding context by hand.

11. `Continuity Vault`
Keep automatic local snapshots so strong runs survive refreshes, tool switches, and checkpoint failures.

12. `Auto-Heal Recovery Lanes`
Keep fallback provider paths ready so the system can recover from missing-model, auth, network, or compatibility failures.

13. `Freshness Sentinel`
Detect stale dependency and API advice before fast-moving external systems turn model output into maintenance debt.

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
| Intent drift prevention through mission locking | No | No | Yes |
| Proof-backed trust scoring for model output | No | No | Yes |
| Preflight release gate before model execution | No | No | Yes |
| Hidden contradiction and missing-context detection | No | No | Yes |
| Portable session continuity across surfaces | Partial | No | Yes |
| Automatic continuity snapshots and restore | No | No | Yes |
| Auto-heal provider recovery lanes | Partial | Partial | Yes |
| Freshness guard for stale SDK and API advice | No | No | Yes |
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

## Contributor Setup

```bash
npm install
npm run test:web
npm run build:web
npm run build:cli
npm run build:extension
npm run build:desktop
```

Recommended local provider setup:

- Ollama: `http://localhost:11434`
- LM Studio: `http://localhost:1234/v1`
- Hosted providers: set API keys before using cloud routes

Recommended first smoke tests:

1. Open the web app and hit `/api/talent/preflight`
2. Run the workbench with a local Ollama model
3. Run `npm run build:extension`
4. Run `npm run build:desktop`

## Launch Assets

The repo is ready for the next public-facing upgrades:

- product screenshots from `/app`, `/docs`, and `/pricing`
- a short GIF showing preflight -> jury -> ship memo
- GitHub Actions for web build and test automation
- a tagged GitHub release with desktop, CLI, and extension artifacts

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
- Web smoke checks for `/api/talent/providers`, `/api/talent/preflight`, and the auto-heal chat route
- 19 passing unit tests for provider helpers, release heuristics, hidden pain analysis, mission locking, proof gating, freshness checks, continuity vault snapshots, session capsules, and recovery planning

This publish repo contains the source-ready product surfaces and the root workspace manifest needed to build them together.

## Sources For The Comparison Framing

- Anthropic Claude Code docs: https://docs.anthropic.com/en/docs/claude-code
- Anthropic Claude Code overview: https://www.anthropic.com/claude-code

For `OpenConsole`, no single authoritative public spec was confidently verified during this pass, so the repo treats that comparison as a documented console-style baseline rather than a source-verified product claim.
