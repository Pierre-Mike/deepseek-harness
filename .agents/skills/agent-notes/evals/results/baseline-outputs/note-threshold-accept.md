# Should this be recorded?

**Yes.** This is a lasting architectural decision that meets the threshold:

- **Architecture** — inter-module communication protocol is a system-wide design choice
- **Contract shared across files** — defines the boundary between Ordering and Billing
- **Reasonably revisited** — you explicitly noted that REST is the default choice most teams make, so a maintainer will ask "why events?" in the future
- **Not captured by code or tests alone** — the *why* (availability during nightly reprocessing) and the *tradeoff* (harder debugging) are decisions, not mechanical facts

---

# Exact note

**Path:** `.agents/notes/implemented/architecture/2026-09-29-events-based-ordering-billing.md`

```md
# Agent Note: Events-based communication between Ordering and Billing

Status: implemented

## Problem

Ordering and Billing have conflicting availability requirements. Ordering accepts customer orders in real time and must remain responsive. Billing performs nightly reprocessing of historical transactions—a batch operation that can take hours. If these modules communicate synchronously (REST, shared database, or polling), Billing's reprocessing window would create latency or unavailability in the user-facing Ordering system.

## Decision

Ordering and Billing communicate exclusively through domain events on a central message bus. Ordering publishes events such as `OrderCreated` and `OrderFulfilled`. Billing subscribes to these events to update its own state and trigger reconciliation logic. Neither module makes direct HTTP calls to the other, and neither shares database tables.

This choice is uncommon for this module pair. Most teams default to synchronous REST because it simplifies debugging. We chose events specifically to ensure that Billing's nightly reprocessing—which runs for hours—does not degrade Ordering's latency or availability.

## Alternatives considered

1. **Synchronous REST API.** Ordering calls Billing to log transactions; Billing calls Ordering to retrieve order details. Simple debugging, but Billing downtime or slow reprocessing would stall order acceptance. Rejected.

2. **Shared database tables.** Both modules read and write `orders`, `transactions`, and related tables. Tightest coupling and no latency, but Billing's long-running queries could lock rows and block Ordering inserts. Rejected.

3. **Polling.** Modules periodically check each other's state. Removes permanent dependency but adds artificial latency and complexity. Rejected in favor of events.

4. **Event-driven (chosen).** Events are immutable records on the bus. Each module consumes only the events it needs. Billing can reprocess its entire history without touching Ordering's tables or endpoints. Ordering remains available throughout.

## Consequences

**Benefits:**
- Ordering is unaffected by Billing's nightly reprocessing. Order acceptance latency and availability are independent of Billing's batch window.
- Modules can deploy, scale, and reprocess independently. Billing can recover from errors by replaying events without requiring Ordering to replay anything.
- Order data is immutable and append-only. Event log is a natural audit trail.

**Costs:**
- **Debugging is harder.** A failed order-to-billing flow requires reading events from the bus, checking subscription state, and tracing async chains. Observability (tracing, monitoring, dead-letter queues) becomes essential, not optional.
- **Billing sees orders eventually.** A reconciliation query run seconds after an order is created may return stale data if the event has not yet been processed.
- **Schema versioning is required.** Adding fields to `OrderCreated` or other events requires coordination. Breaking changes need a versioning strategy (e.g., versioned event types or a schema registry).
- **Idempotency must be enforced.** If an event is reprocessed or delivered twice, Billing must not duplicate charges. This requires idempotent key design in Billing's schema.

These costs are acceptable because Ordering's availability is worth the operational complexity of async debugging.

## Verification

Run these commands to confirm the decision is enforced:

1. **Check that Ordering publishes events:**
   ```bash
   grep -r "eventBus\.publish\|emit(" src/ordering/ | grep -i "order"
   ```
   Should return results like `eventBus.publish(new OrderCreated(...))`. No results means the pattern is not yet implemented.

2. **Check that Billing subscribes to events:**
   ```bash
   grep -r "eventBus\.subscribe\|on(" src/billing/ | grep -i "order"
   ```
   Should return results like `eventBus.subscribe(OrderCreated, ...)`. No results means subscriptions are missing.

3. **Verify no REST calls between modules:**
   ```bash
   grep -r "http\|fetch\|axios" src/ordering/ | grep -i billing
   grep -r "http\|fetch\|axios" src/billing/ | grep -i ordering
   ```
   Both should return empty or only test/mock code.

4. **Verify no shared tables:**
   ```bash
   grep -E "^CREATE TABLE" src/ordering/schema.sql src/billing/schema.sql | cut -d: -f2 | sort | uniq -d
   ```
   Should return empty (no table name appears in both schemas).

5. **Integration test:**
   An integration test should create an order in Ordering and assert that Billing's event handler is invoked with the correct event payload. Look for `tests/integration/ordering-billing.test.ts` or similar. Test should verify that Billing can reprocess events without re-triggering Ordering.

(Exact paths depend on the repo structure; adapt `src/`, `tests/`, and schema file locations to your actual tree.)
```

---

## Summary

- **Record:** Yes. This is an architecture decision with lasting value and a clear tradeoff (availability vs. debugging simplicity).
- **Lifecycle:** `implemented/` — code is done.
- **Date:** 2026-09-29 (today, when the decision is formalized).
- **Dependencies:** This note depends on the message bus infrastructure and schema design being documented elsewhere (possibly in the 2026-05-02 monorepo note or a dedicated events/bus note). Cross-link if those notes exist.