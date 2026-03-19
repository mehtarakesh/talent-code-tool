# OrbitForge

OrbitForge is a lifecycle-first AI coding platform for teams that need more than prompt output. It focuses on the local and installable surfaces behind `orbitforge.dev`: VS Code, desktop, CLI, and the shared runtime that keeps them aligned.

![OrbitForge](./assets/branding/orbitforge-social.png)

What OrbitForge is built to do:

- keep local and hosted model workflows aligned across surfaces
- turn risky work into mission boards, approval gates, and validation plans
- let teams reuse portable lifecycle blueprints instead of rebuilding process by hand
- make release-readiness and proof part of the product, not post-run cleanup

This repository focuses on the installable surfaces developers actually run on their machines:

- VS Code extension
- Desktop app
- CLI

The hosted web app and marketing site remain private for now. This public repo is where the shared runtime, provider interoperability, extension experience, desktop workflows, CLI flows, and contributor-facing ecosystem contract are developed in the open.

## Why OrbitForge Exists

Most AI coding tools still break at the points that matter most in real work:

- they look multi-model, but one surface gets all the attention and the rest drift
- they treat local models as a second-class path
- they return polished text instead of release-ready output
- they trust one agent lane too much, even on risky implementation decisions
- they make developers rebuild context every time they switch tools
- they do not give contributors a sharp enough map of what actually needs to improve

OrbitForge exists to solve those failure modes directly.

## Real Pain Points OrbitForge Solves

### 1. Provider freedom usually breaks the moment you change surfaces

The pain:
Most tools say they support many providers, but the CLI, desktop shell, and editor integration do not stay behaviorally aligned. A prompt that works in one surface often needs different settings, different endpoints, or different assumptions in another.

How OrbitForge solves it:
OrbitForge keeps the same provider vocabulary across the public surfaces: `ollama`, `lmstudio`, `openai`, `anthropic`, `openrouter`, and `openai-compatible`. Each surface exposes the same core inputs:

- provider
- model
- base URL
- API key
- workspace context

Why that matters:
Developers can move between VS Code, terminal, and desktop without relearning the product every time. Contributors can also reason about parity gaps directly instead of pretending they do not exist.

Where it lives:

- `apps/orbitforge-vscode`
- `apps/orbitforge-desktop`
- `apps/orbitforge-cli`

### 2. Local AI is still treated like a backup plan instead of a first-class workflow

The pain:
Open-source users, enterprise teams, and privacy-sensitive developers often want Ollama, LM Studio, or another local OpenAI-compatible endpoint. Many tools technically allow this, but the UX is clearly built around hosted keys first and local usage feels bolted on.

How OrbitForge solves it:
OrbitForge keeps local-first paths visible and configurable:

- Ollama defaults are built into the extension, desktop app, and CLI
- LM Studio can be targeted by base URL instead of requiring a special product mode
- OpenAI-compatible endpoints are supported as a general path, not a one-off hack

Why that matters:
The developer can test fast with a local model, move to a hosted model when needed, and keep the same product surface.

### 3. AI coding output is usually fluent, but not shippable

The pain:
A lot of coding assistants return plausible paragraphs that feel helpful in the moment but are weak as implementation artifacts. They skip proof, skip validation, and bury risk. That creates a dangerous illusion of progress.

How OrbitForge solves it:
OrbitForge pushes every surface toward the same release-ready response contract. The default system framing asks for:

1. A concise plan
2. The implementation approach
3. Validation steps
4. Remaining risks

Why that matters:
It turns the assistant into something closer to a shipping collaborator than a chat box. The result is not just "what to do", but also "how to check whether it worked" and "what can still go wrong".

### 4. One AI lane is often too confident for risky engineering work

The pain:
When a tool only gives one answer path, teams often mistake fluency for correctness. The model sounds decisive, but there is no built-in dissent, no structural challenge, and no fast way to compare approaches without running multiple manual prompts.

How OrbitForge solves it:
OrbitForge now ships a shared parallel-agent framework in the public repo. The built-in trio runs:

- `Architect` to decompose the work and identify impacted surfaces
- `Implementer` to propose the concrete patch path
- `Critic` to challenge assumptions and surface missing proof

Those lanes run together, then OrbitForge adds a workflow-specific `Mission Board` with approval gates, handoff steps, and next prompts before producing a converged recommendation.

Why that matters:
It gives developers controlled disagreement without forcing them to choreograph three separate chats. The workflow stays effortless, but the answer quality gets harder to fool and easier to resume later.

### 5. Workspace context is rebuilt by hand every time someone changes tools

The pain:
Developers constantly lose momentum when they jump between editor, desktop shell, and terminal. Most tools do not help much beyond a blank prompt box.

How OrbitForge solves it:
OrbitForge carries workspace context as a first-class input in every surface. The VS Code extension can summarize the current workspace and selection, while the CLI and desktop shell accept explicit context so the same task can be moved between environments without starting from zero.

Why that matters:
Less time is spent repeating the assignment. More time is spent actually executing it.

### 6. Open-source contributors usually do not know what the hard problems are

The pain:
Many repos say "contributions welcome" but provide no real guidance on which product gaps are structural, repetitive, or strategically important. That causes low-signal PRs and leaves the hardest issues untouched.

How OrbitForge solves it:
This repo now ships with Claude Code-ready project memory, rules, skills, and automation so contributors can work on the real gaps:

- provider parity across surfaces
- packaging and release verification
- shared request/response abstractions
- error normalization
- local-first credential and endpoint ergonomics

Why that matters:
Claude Code can contribute to the repo in a targeted way, and human contributors get a clearer map of what actually moves the product forward.

## Open Lifecycle Ecosystem

OrbitForge is now opening a larger surface than “pick a model and press run.”

The hidden pain in agent tooling is that the hardest engineering work still lives outside the agent step:

- mission intake
- context packing
- parallel disagreement
- human approval
- validation proof
- release control
- publish handoff

OrbitForge now exposes that lifecycle as an open contract through:

- `apps/orbitforge-core/src/ecosystem.ts`
- CLI blueprint support with `--list-components`, `--list-blueprints`, and `--blueprint-file`
- starter lifecycle kits for high-trust review and migration workflows
- a private hosted builder that can author compatible JSON blueprints visually

Why this is bigger than workflow-only agent nodes:

The official n8n docs describe an AI agent as a decision-maker inside a workflow. That is useful, but it still centers the agent as one step in a graph. OrbitForge is targeting the wider lifecycle around risky engineering work:

- who owns the mission
- what context is admissible
- which lanes must disagree
- where a human must approve
- what proof counts
- how release and publish obligations are handled

That is the problem OrbitForge is trying to solve better.

Read the open contract here:

- `PLUGIN_ECOSYSTEM.md`

## Agentic Workflows OrbitForge Now Targets

OrbitForge is no longer just “single prompt” tooling. The public repo now includes workflow-aware mission planning for the most common agentic use cases discussed in the wild:

- `general`
  For multi-surface implementation work where the main pain is coordination and task ownership.
- `review`
  For parallel code review, evidence-backed findings, and missing-test detection.
- `migration`
  For long refactors or provider moves where rollout order and rollback matter more than raw code generation.
- `incident`
  For debugging or outage response where containment, competing hypotheses, and rollback need to stay separate.
- `release`
  For go/no-go decisions, packaging checks, and explicit approval gates before ship.

These workflows are available in the shared core and exposed in the public surfaces:

- CLI: `--parallel --workflow review`
- Desktop: execution mode plus workflow selectors
- VS Code: `orbitforge.workflow` plus panel-level workflow selection

## Public Signal Behind This Direction

This agentic layer is not based on a generic “more agents is better” assumption. It follows recurring public signal that the real bottleneck is coordinating long tasks safely:

- Anthropic’s agent-team docs call out plan approval, quality gates, parallel code review, and competing hypotheses as core use cases: <https://docs.anthropic.com/en/docs/claude-code/agent-teams>
- Anthropic’s sub-agent docs emphasize specialized delegated work instead of one giant generalist session: <https://docs.anthropic.com/en/docs/claude-code/sub-agents>
- Cursor’s background-agent docs point in the same direction for long-running work and background execution: <https://docs.cursor.com/background-agent>
- Community discussion keeps repeating that people spend too much time managing agents, context, and intent drift instead of coding: <https://www.reddit.com/r/AI_Agents/comments/1od50u1/anyone_else_feel_like_theyre_spending_more_time/>

## What Is Public In This Repo

Public surfaces:

- `apps/orbitforge-core`
- `apps/orbitforge-vscode`
- `apps/orbitforge-desktop`
- `apps/orbitforge-cli`

Marketplace and release docs:

- `docs/vscode-marketplace-release.md`
- `docs/market-edge.md`
- `docs/github-about.md`

Private for now:

- the hosted `orbitforge.dev` web app
- the marketing site
- the private release infrastructure behind the hosted experience

## Build Commands

```bash
npm install
npm run build:core
npm run test:core
npm run build:extension
npm run build:desktop
npm run build:cli
```

### Ecosystem CLI

```bash
node apps/orbitforge-cli/dist/cli.js --list-components
node apps/orbitforge-cli/dist/cli.js --list-blueprints
node apps/orbitforge-cli/dist/cli.js --parallel --workflow review --blueprint-file ./parallel-review-kit.json
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

## VS Code Release Path

OrbitForge is now set up for:

- packaged VSIX releases
- GitHub Actions CI artifacts
- VS Code Marketplace publishing
- Open VSX publishing

The release guide lives in:

- `docs/vscode-marketplace-release.md`

## Contributing With Claude Code

This repo is now prepared for Claude Code contributors.

It includes:

- `CLAUDE.md` for project memory and contribution rules
- `.claude/rules/` for scope-specific repo guidance
- `.claude/skills/` for niche OrbitForge contribution workflows
- `.github/workflows/claude.yml` so `@claude` can help on issues and PR comments once the repo secret is configured
- `PLUGIN_ECOSYSTEM.md` for the lifecycle/plugin contract

### How to use Claude Code in this repo

1. Open the repo in Claude Code.
2. Let Claude load `CLAUDE.md`.
3. Ask Claude to work on one of the real product gaps below.
4. Use the built-in OrbitForge project skills when the task matches them.

Recommended Claude Code contribution lanes:

- deepen the workflow presets and mission-board quality
- improve or extend the parallel-agent orchestration and convergence rules
- normalize provider errors so the same failure has the same remediation text everywhere
- add streaming support consistently across CLI, desktop, and VS Code
- add secure credential storage instead of plain config entry where the platform supports it
- strengthen packaging validation for Windows and Linux release paths
- extend the lifecycle ecosystem without turning OrbitForge into generic node sprawl
- add blueprint starter kits that solve real engineering stewardship problems

## Claude Code Niche Skills In This Repo

### `/provider-parity-audit`

Use this when touching:

- provider lists
- auth headers
- base URL handling
- model routing
- response parsing
- the parallel agent orchestration runtime

It is meant to stop "fixes" that only improve one surface while the others quietly drift.

### `/surface-shipping-check`

Use this when touching:

- release UX
- packaging
- platform-specific behavior
- public docs about what ships

It is meant to keep the desktop app, CLI, and extension aligned with the repo narrative and build commands.

### `/parallel-agent-upgrade`

Use this when touching:

- agent lane design
- convergence logic
- single vs parallel mode UX
- failure handling for one broken lane

It is meant to make the multi-agent framework stronger without making it harder to use.

### `/ecosystem-plugin-author`

Use this when touching:

- lifecycle components
- blueprint starter kits
- the open JSON blueprint contract
- docs about the ecosystem

It is meant to keep OrbitForge focused on lifecycle stewardship rather than generic node proliferation.

## GitHub Automation For Claude Code

To enable the workflow in `.github/workflows/claude.yml`:

1. Install the Claude GitHub app on this repository.
2. Add the `ANTHROPIC_API_KEY` repository secret.
3. Mention `@claude` on an issue comment or pull request review comment.

That setup lets Claude Code help with review and scoped implementation work inside the public OrbitForge repo.

## Honest Current Gaps

OrbitForge is opinionated about the problems it wants to solve, but the public repo still has open work:

- the parallel-agent runtime can gain stronger convergence heuristics and streaming updates
- the mission-board workflow system is still text-first rather than interactive
- long multi-turn runs still need better state carry-over between sessions
- secure credential storage can be improved, especially outside hosted flows
- Windows and Linux packaging need deeper release-host verification

Those are good contribution targets because they attack real product risk, not just cosmetic cleanup.
