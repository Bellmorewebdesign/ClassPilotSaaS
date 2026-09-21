# Recorded extension payload

`extension-payload.json` is **generated**, not hand-written. It is the exact
output of the real extension extractors (`apps/extension/src/extractors/*`)
run against the sanitized fixtures in
`apps/extension/src/__tests__/fixtures/`.

It exists so the API can be tested against what the extension actually
produces, rather than against a payload someone imagined the extension
produces. It captures details a hand-written fixture would miss — the
`extraction` provenance blocks, the exact null-vs-absent choices, and the fact
that one class legitimately arrives twice (once from the home page card, once
from its class page) and must be deduped.

## Regenerating it

Run the extractors against the extension fixtures and write the result here.
Do this after changing an extractor's output shape:

```bash
# from apps/extension, with a temporary test that calls the extractors and
# writes this file — see the git history of this README for the snippet.
pnpm --filter @classpilot/extension test
```

The contract test in `apps/extension/src/__tests__/contract.test.ts` asserts
that live extractor output still satisfies the shared Zod schema, so a drift
between this recording and the extractors shows up there first.
