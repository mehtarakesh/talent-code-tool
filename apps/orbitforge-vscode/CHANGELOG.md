# Changelog

## 0.10.0

- upgraded the panel into an adaptive pro mission client with a bounded result shell, sticky step rail, and utility sidecards
- added host-side markdown rendering with syntax-aware code blocks and language-family styling
- added rendered, raw, and split mission views plus local copy actions for code blocks, anchors, and full mission output
- added renderer tests for headings, markdown structures, code families, unknown language fallback, and lane error output

## 0.9.0

- routed the main VS Code commands into the interactive OrbitForge panel instead of opening markdown-only result documents
- added runtime controls in the panel for provider, base URL, and model selection
- added detected Ollama model chips and one-click runtime refresh/save actions

## 0.8.1

- added Ollama model auto-detection with fallback to an installed local model
- switched the default Ollama model to `qwen2.5-coder:7b`
- improved missing-model errors so runs explain how to recover

## 0.8.0

- added true per-lane streaming for parallel missions with lane headers
- added core streaming hooks for agent-level token callbacks

## 0.7.0

- added provider streaming for single-lane missions (Ollama and OpenAI-compatible)
- added git branch scaffolding and diff proposal tooling in the panel
- added mission session tabs with streaming output per session

## 0.6.0

- added mission sessions with tabs inside the panel so multiple runs stay open
- added exportable mission history to markdown or JSON
- upgraded streaming playback to run per-session with timeline updates

## 0.5.0

- added a mission timeline inside the panel to show context, lanes, runtime, and completion stages
- added streaming-style output playback so results feel live inside the panel
- added pinned presets to keep your favorite missions one click away

## 0.4.0

- added mission history with restore and rerun support inside VS Code
- added slash commands in the interactive panel for presets, workflows, scope changes, blueprint runs, and history recall
- added live run logs in the panel so OrbitForge shows how it is staging context and dispatching lanes
- added `OrbitForge: Mission History` for command-palette access to saved workspace missions

## 0.3.0

- added `OrbitForge: Guided Session` for a Claude Code / Codex-style launch flow inside VS Code
- upgraded the OrbitForge panel with preset mission cards, context-scope controls, starter blueprint launching, and live workspace context refresh
- added a status bar entry so OrbitForge is always one click away during editor work

## 0.2.0

- added marketplace-ready metadata, branding assets, and release docs
- added `Run Starter Blueprint` command
- added `Run Blueprint File` command
- aligned the extension with the public OrbitForge lifecycle ecosystem contract

## 0.1.0

- initial OrbitForge panel, selection explain, and workspace planning commands
