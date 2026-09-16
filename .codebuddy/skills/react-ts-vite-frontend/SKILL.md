---
name: react-ts-vite-frontend
description: React 19 + TypeScript strict + Vite 6 frontend conventions for OpenCloser. Use when editing UI/stores/services.
---

# React / TS / Vite (OpenCloser)

## Conventions
- Strict TypeScript: fix real type errors; do not weaken `strict` or blanket `any`.
- Feature folders under `src/features/{crm,voice,hunter,onboarding}`.
- State: Zustand stores in `src/stores`.
- Tauri invoke via `@tauri-apps/api` — keep dynamic/static import pattern consistent; avoid breaking existing invokes.
- Vitest tests in `src/test` — keep **35+** passing; add tests for new security-sensitive logic.
- `tsconfig.json` must keep `exclude` of `src-tauri` (target codegen binaries break tsc).

## Commands
```bat
npm run lint
npm test
npm run build
```

## Do not
- Move `vite` back into runtime if it belongs in devDependencies without verifying package.json intent
- Store secrets in frontend state unencrypted
- Force `npm audit fix --force` without recording break risk (esbuild low is known)
