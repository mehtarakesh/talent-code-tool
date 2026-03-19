# OrbitForge VS Code Extension

![OrbitForge cover](./assets/cover.png)

OrbitForge brings the lifecycle-first OrbitForge experience into VS Code.

Instead of stopping at chat and code generation, OrbitForge helps you run work with:

- provider parity across local and hosted models
- parallel architect / implementer / critic lanes
- workflow-aware mission boards
- starter blueprints for review, migration, incident, and release work
- portable lifecycle contracts that also work in the OrbitForge CLI

## Why Install OrbitForge

Most coding extensions help you prompt a model.

OrbitForge is built for the harder problems:

- moving between local and hosted providers without changing your workflow
- making risky changes with structured disagreement instead of one overconfident answer
- keeping context visible when a task spans editor, CLI, and release decisions
- turning agent runs into something that is easier to review, validate, and ship

## Features

- `OrbitForge: Open Panel`
  Opens the OrbitForge panel with execution mode and workflow controls.
- `OrbitForge: Explain Selection`
  Reviews the current selection and suggests the safest next edit.
- `OrbitForge: Plan From Workspace`
  Summarizes the workspace and asks OrbitForge for the next implementation plan.
- `OrbitForge: Parallel Workspace Plan`
  Runs the built-in architect / implementer / critic trio for a release-oriented plan.
- `OrbitForge: Run Starter Blueprint`
  Launches a built-in lifecycle blueprint directly in the current workspace.
- `OrbitForge: Run Blueprint File`
  Runs a JSON blueprint exported from the OrbitForge ecosystem builder or CLI.

## Supported Providers

- Ollama
- LM Studio
- OpenAI
- Anthropic
- OpenRouter
- OpenAI-compatible endpoints

## Ecosystem Blueprints

OrbitForge now supports open lifecycle blueprints.

That means the same flow can be:

- designed visually in the private hosted OrbitForge builder
- committed as plain JSON in git
- run in the CLI
- executed inside this VS Code extension

Starter blueprints currently include:

- Parallel Review Kit
- Migration Flight Plan

## Install

### From Marketplace

Once published, install `OrbitForge` from the VS Code Marketplace or Open VSX.

### From VSIX

```bash
code --install-extension orbitforge-vscode-0.2.0.vsix
```

## Configure

Open VS Code Settings and search for `OrbitForge`.

Important settings:

- `orbitforge.provider`
- `orbitforge.baseUrl`
- `orbitforge.model`
- `orbitforge.apiKey`
- `orbitforge.agentMode`
- `orbitforge.workflow`

## Development

```bash
npm install
npm run build:extension
npm run package:extension
```

## Support

See [SUPPORT.md](./SUPPORT.md) for issue reporting and release questions.
