---
name: windows-dev-paths
description: Windows/MSYS path and toolchain rules for this host. Use before shell/build commands.
---

# Windows terminal paths (this host)

- Hermes/agent bash is **git-bash/MSYS**, not PowerShell.
- Native tools (node, cargo, rustc) need **Windows paths**: `C:/Users/...` or `G:/tools/...`, not `/c/Users` when passed to native exe (MSYS conversion may break).
- Prefer PowerShell for WorkBuddy/codebuddy CLI itself.
- Scratch for native tools: `$env:LOCALAPPDATA\Temp` not `/tmp`.
- Rust: `G:\tools\rustup`, `G:\tools\cargo`, linker `G:\tools\mingw64\mingw64\bin`.
- Agency materials: `G:\agency\...`
- Never create project venv from Hermes python home.
