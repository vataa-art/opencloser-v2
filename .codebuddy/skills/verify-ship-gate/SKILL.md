---
name: verify-ship-gate
description: Verification before claiming done — lint, tests, build, honest blockers. Always use before finishing.
---

# Verify before done

Never mark complete on intent. Run and paste real exits:

1. `npm run lint` → exit 0  
2. `npm test` → all pass (baseline 35)  
3. `npm run build` → exit 0  
4. If Rust changed: `cargo check` with gnu env  
5. If security claim: describe **how** verified (e.g. localStorage empty of raw key)  
6. Update `G:\agency\opencloser-v2\docs\HANDOFF.md` + `project/HANDOFF.md` with what changed  

## Done criteria for current P0 mission
- Secure key storage implemented (not plain localStorage) **or** explicit blocker documented
- Relay requires app session auth **or** explicit blocker
- Tests green
- No secrets in repo

If blocked (e.g. needs admin MSVC), say blocked + exact next human step — do not invent success.
