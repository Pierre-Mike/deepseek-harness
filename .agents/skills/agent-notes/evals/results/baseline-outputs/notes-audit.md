# Notes Audit

## Findings

| Note | Decision | Assertion | Evidence | Status |
|---|---|---|---|---|
| implemented/architecture/2026-06-11-events-between-contexts.md | "Ordering and Billing communicate via domain events only, never synchronous HTTP" | No HTTP clients between ordering and billing | src/billing/client.ts:9 `await http.post('http://ordering.internal/api/orders/confirm', ...)` | **Violated** |
| implemented/architecture/2026-06-11-events-between-contexts.md | Event publisher at src/ordering/events/publisher.ts | Path src/ordering/events/publisher.ts exists and exports publish function | File does not exist; publishing moved to src/ordering/outbox.ts | **Stale fact** |
| proposed/feature/2026-09-01-pdf-export.md | (unbuilt proposal) | No acceptance criteria to verify | Proposal only; no code path exists | **N/A** |

## Remedies (ranked)

1. **Fix the code violation (highest priority):** Remove the synchronous HTTP call in src/billing/client.ts:9. Route the confirmation through the domain event system: `src/ordering/outbox.ts` publishes a `ConfirmationRequested` event, `src/billing` subscribes via its event handler. This restores the architecture decision.

2. **Update the implemented note (required with the code fix):** Rewrite `## Decision` to name the current path: "Events are published by src/ordering/outbox.ts" (not events/publisher.ts). Run the evidence command (grep and file check) and record the result in `## Verification`.

3. **Proposed feature:** No action until the PDF export is scheduled for implementation. At that time, write acceptance criteria and record the entry point.

---

**Note:** `check-notes.ts` passes because it validates structure and links, not code conformance. The gate reports zero, but the architecture is violated.