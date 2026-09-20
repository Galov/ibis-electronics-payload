# BG -> RO price and stock updates

## Status and safety

BG implementation only. The 1.3 contract below is proposed for the RO implementation;
the existing 1.1 commerce receiver does NOT accept it. Do not enable before coordinated
RO deployment and verification. No RO code, production secrets, or configuration are
changed here. `ROMANIA_UPDATES_SEND_ENABLED` must remain absent or `false`.
It is independent of the manual content guard `CATALOG_SYNC_SEND_ENABLED`.

There are no descriptions, titles, SEO, media, categories, publication state, or AI calls
in these messages. Price and stock are independent lanes. Manual content sync is unchanged.

## Trigger and persistence

Only a successful existing-product `product.price_stock_updated` NIK webhook can trigger
this path. It uses the final saved BG retail `price` in EUR (after the existing BG markup),
NOT BG `sourcePrice`. Stock uses the absolute saved `stockQty`, including zero. Stock is
not forwarded when absent from the incoming webhook. Only changed lane values create an
event. Products without `catalogSync.lastSuccessfulEventId` remain excluded: new products
still require the explicit content workflow. NIK create/delete/deactivate, BG checkout,
general admin saves, and maintenance scripts do not trigger it.

The BG product update and the lane journal update share a MongoDB transaction. No HTTP
is sent before commit. Known transient write/unique-key conflicts are retried up to three
times. The existing NIK price validation, markup, images, and publication handling remain
unchanged. With the new guard off, the old path runs without journal writes or HTTP calls.

`romania-update-streams` is a private, API-inaccessible collection. Its unique key is
`<BG product ID>:price` or `:stock`. Each lane has an increasing integer revision and an
immutable event for that revision. A -> B -> A creates three versions. Retrying an event
reuses its exact ID, revision, timestamp, and value. New absolute values supersede older
pending values in the journal; this is latest-state delivery, not a full event history.
The revision journal must not be deleted/reset when resuming, or ordering would be lost.

Network failures do not undo the committed BG update. Sanitized error codes and times
are retained; keys, headers, content payloads, and raw remote error bodies are not logged.
Response writes are conditional on the current event ID, so a late response cannot erase
a newer pending revision. Multiple requests may deliver the same revision; RO must dedupe.
Before delivery, BG rechecks that the journal's value still matches the current BG product;
stale journal values are superseded locally rather than sent after a later content/admin update.

## Proposed receiver contract

Authenticated server-to-server requests use the existing `CATALOG_SYNC_API_KEY`,
`Authorization: Bearer ...`, and `POST https://ibis-electronics.ro/api/catalog-sync/products`.

Stock example (eventId below is illustrative; BG supplies a SHA-256-based ID):

```json
{
  "schemaVersion": "1.3",
  "eventType": "product.stock_updated",
  "eventId": "bg-stock-<sha256>",
  "sourceRevision": 7,
  "sourceUpdatedAt": "2026-09-20T10:00:00.000Z",
  "product": { "sourceProductId": "BG_PRODUCT_ID", "stockQty": 3 }
}
```

Price uses the same envelope, `eventType: product.price_updated`, a `bg-price-...` ID,
and ONLY `{ "sourceProductId": "BG_PRODUCT_ID", "sourcePriceEUR": 11.5 }` as product.
`sourceRevision` is independent for each product/lane. Do not compare it to content sync
revisions, commerce timestamps, or the other lane's revision. Timestamps are audit metadata;
revision numbers determine ordering. Missing or extra fields must be rejected.

Required RO behavior:

- Resolve only an existing product by its BG `sourceProductId`. Never create a product.
- Deduplicate identical event IDs. Reject reused revision/ID with different data.
- Atomically apply a lane only if its revision is newer; older revisions are superseded.
- Stock: update quantity/inventory and derive availability only. Do NOT recalculate prices.
- Price: accept the final BG EUR price; convert in RO using its active stored EUR/RON rate
  and currency buffer. Do NOT update quantities. BG performs no currency conversion.
- All editorial fields and publication state remain unchanged, including through hooks
  and version creation. No translation job may be invoked.
- Guard the field update and revision comparison in the same transaction, including under
  concurrent processing of the two lanes or two revisions of one lane.
- Return HTTP 200/202 with the exact eventId and a recognized status. Existing
  `GET /api/catalog-sync/events/:eventId` must expose eventual succeeded/superseded/failed.
- A retry after failed processing must be able to resume the same event safely.

## Recovery and explicit operational limitation

No worker, cron, automatic timer, or notification architecture is introduced. The first
POST occurs immediately after a NIK update commits. An unchanged subsequent NIK webhook
can retry an outstanding lane. An HTTP 202 is only `accepted`, not success.

```sh
pnpm romania:updates list 50
pnpm romania:updates status 50
pnpm romania:updates retry 50
```

`list` is read-only. `status` checks accepted events without POSTing. `retry` retries
pending/failed events and checks accepted ones. Commands are bounded to 100 records;
repeat explicitly for further pages. Both network commands require the new guard.
They read products to reject stale values but write only the journal, never products or content-sync state.

Without further NIK activity or an explicit command, pending deliveries and asynchronous
RO failures are NOT automatically retried/detected. Guaranteed unattended recovery would
require a separately approved scheduler/process. There are no per-failure emails.

After RO deployment, activation is a separate authorized operation. Initial stock alignment
remains the separately managed one-off task. Disabled-period changes are not retroactively
queued; perform a fresh comparison/alignment before enabling.
