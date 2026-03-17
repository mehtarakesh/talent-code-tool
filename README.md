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

## Signature Features

These are the five headline features this repo now centers on for public differentiation:

1. `Model Jury`
Run the same task across multiple model ballots and compare disagreement, speed, and output quality before committing to a risky path.

2. `Blast Radius Simulator`
Estimate which surfaces a change will hit and where validation effort needs to go before code generation starts.

3. `Release Contract Generator`
Turn prompts into explicit deliverables, validations, and rollback clauses instead of relying on implied acceptance criteria.

4. `Ops Ledger`
Track run history, failures, and next-step recovery guidance so the tool gets better after failed attempts instead of just erroring out.

5. `Ship Memo Autowriter`
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
| Enterprise positioning without single-vendor lock-in | Partial | Partial | Yes |

## Repo Stats

Current CodeOrbit AI footprint in this repo:

- 4 user-facing surfaces: web, desktop, CLI, VS Code
- 6 provider families supported: Ollama, LM Studio, OpenAI, Anthropic, OpenRouter, OpenAI-compatible
- 14 Next.js page routes in `apps/web/src/app`
- 2 Talent web API routes
- 3 installable app surfaces alongside the web product

## Surfaces

### Web

- Product site
- Download center
- Docs
- Pricing
- Browser workbench with provider switching

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
- `npm run build:extension`
- `npm run build:desktop`
- `npm run build:cli`
- `npm run package:extension`
- `npm run package:cli`
- `npm run package:desktop`
- Web smoke checks for `/`, `/app`, `/docs`, `/download`, `/pricing`, and `/api/talent/providers`
- Live web API prompt against local Ollama using `qwen2.5-coder:7b`
- Live CLI prompt against local Ollama using `qwen2.5-coder:7b`

This publish repo contains the product surfaces only. The verification and gap-analysis documents live in the original working repository.

## Sources For The Comparison Framing

- Anthropic Claude Code docs: https://docs.anthropic.com/en/docs/claude-code
- Anthropic Claude Code overview: https://www.anthropic.com/claude-code

For `OpenConsole`, no single authoritative public spec was confidently verified during this pass, so the repo treats that comparison as a documented console-style baseline rather than a source-verified product claim.
