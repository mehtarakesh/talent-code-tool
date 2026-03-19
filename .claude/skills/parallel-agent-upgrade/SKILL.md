# Parallel Agent Upgrade

Use this skill when a task touches the OrbitForge multi-lane orchestration runtime.

## Goal

Keep the built-in parallel trio powerful without making it feel heavy, confusing, or manual.

## When To Use It

Use this skill when the task involves:

- new agent lanes
- convergence rules
- workflow presets
- mission-board structure
- lane prompts
- output formatting
- partial-failure behavior
- streaming or live-progress behavior
- UI affordances for choosing single vs parallel execution

## Workflow

1. Inspect `apps/orbitforge-core` first.
2. Confirm the single-agent path stays simple.
3. Improve the parallel trio only if the UX stays intuitive.
4. Check how the change lands in CLI, desktop, and VS Code.
5. Update public docs if the user-facing workflow changed.
6. Run the relevant tests and build commands before finishing.

## OrbitForge-Specific Guardrails

- do not turn the feature into manual agent choreography
- keep the default trio easy to understand
- keep workflow-specific approval gates and handoffs obvious
- keep failure output actionable when one lane breaks
- prefer readable convergence over clever-but-opaque scoring
