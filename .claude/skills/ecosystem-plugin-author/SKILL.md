# Ecosystem Plugin Author

Use this skill when contributing to the OrbitForge plugin ecosystem.

## Goal

Improve OrbitForge as a lifecycle-first agentic system, not just a collection of isolated nodes.

## What Good Contributions Look Like

- New lifecycle components that improve ownership, proof, approvals, release control, or publishing
- Better starter blueprints for real engineering workflows
- Runtime changes that keep blueprint behavior consistent across CLI, desktop, and VS Code
- Documentation that makes the lifecycle problem and OrbitForge contract easier to understand

## What To Check First

1. Read `CLAUDE.md`
2. Read `.claude/rules/ecosystem-contract.md`
3. Read `PLUGIN_ECOSYSTEM.md`
4. Inspect `apps/orbitforge-core/src/ecosystem.ts`
5. Inspect `apps/orbitforge-core/src/index.ts`

## Working Pattern

1. Identify the lifecycle gap.
   Ask which stage is weak: intake, context, parallelize, approval, validation, release, or publish.

2. Decide whether the change belongs in:
   - component manifest
   - blueprint starter kit
   - runtime compilation
   - CLI/documentation

3. Keep the output contract plain JSON.
   A hosted builder may author the blueprint, but the open repo must still understand it without hidden state.

4. Add or update tests.
   Blueprint and lifecycle behavior changes should be reflected in `apps/orbitforge-core/src/*.test.ts`.

5. Update docs honestly.
   If a feature is CLI-only or still partial on one surface, say so.
