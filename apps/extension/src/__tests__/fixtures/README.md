# Extractor fixtures

## What these are

Hand-authored HTML that reproduces the **structural signals the extractors
target** — URL grammar, ARIA roles, list semantics, heading order, and the
visible-text labels Classroom renders ("Due ...", "100 points", "Turned in").

## What these are NOT

**These are not captures of a real Google Classroom page.** They were written
from the documented URL grammar and from general Classroom UI conventions, not
from a signed-in session. They contain no real student, teacher, class or
assignment data.

## What that means for the tests

A test passing here proves the extractor correctly reads a page **shaped like
this**. It does *not* prove Google's live markup is shaped like this.

That gap is deliberate and is why the extension ships a diagnostics mode
(`src/extractors/diagnostics.ts`): run it against a real signed-in Classroom
page, and it reports which strategies actually match, without exposing any
schoolwork. Those findings are what should drive the next revision of these
fixtures.

## Updating a fixture from a real page

1. Capture a diagnostic report from the real page (extension popup -> Debug).
2. Adjust the fixture so its structure matches what the report describes.
3. Re-run the tests; a strategy that now fails is a strategy that needs work.

Never paste real Classroom HTML into this directory.
