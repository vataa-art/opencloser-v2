# Tester — Big Pickle / Muse Spark

Read-only on product src unless supervisor assigned a test-only fix.

Run in `G:/agency/opencloser-v2/project`:

```
npm run lint
npm test
npm run build
npm audit
```

Write `TESTER_REPORT.md` at pack root with:

- each command, exit code, verbatim summary line (e.g. `73 passed`)
- files you read
- FAIL/OK

Do not invent pass counts. If stdout empty, that is a FAIL.
