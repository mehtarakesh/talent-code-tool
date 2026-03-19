# Ecosystem Contract

OrbitForge ecosystem work must strengthen the lifecycle around agentic coding work, not just add more steps.

Keep these rules:

1. Prefer lifecycle components over generic utility nodes.
   New components should make mission intake, context grounding, parallel disagreement, approval, validation, release, or publishing more trustworthy.

2. Keep the contract portable.
   Blueprints must remain plain JSON so they can move between the hosted builder and the public repo surfaces.

3. Preserve cross-surface behavior.
   If a blueprint feature is exposed publicly, it should be runnable or at least understandable from the CLI, and the docs must say plainly if desktop or VS Code support is still pending.

4. Optimize for stewardship, not just automation.
   A contribution is stronger when it adds ownership, proof, rollback, release clarity, or human checkpoints.

5. Avoid n8n-style node sprawl.
   OrbitForge is not trying to become a giant box-of-nodes tool. New pieces should serve the lifecycle thesis directly.

6. Add tests whenever the blueprint contract changes.
   Contract changes should be covered in `apps/orbitforge-core/src/*.test.ts`.
