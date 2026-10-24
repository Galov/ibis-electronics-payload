# BG/EN product localization: audit and migration preparation

Prepared 2026-10-24 on `codex/english-storefront`.

## Rollback checkpoint

The existing English storefront is committed at `4828713`. The local tag
`checkpoint/bg-en-before-localization-2026-10-24` marks that commit. The tag has not
been pushed. Existing unrelated stock-repair scripts are excluded from this work.
A Git checkout restores code only; it does not restore migrated database data.

## Agreed data model

There is one product ID and one SKU. Prices, source prices, stock, inventory,
images, relationships, publication status, slug and integration journals remain
shared. Localize product `title`, `description`, `shortDescription`, `meta.title`
and `meta.description`; localize category `title`, `meta.title`, `meta.description`.
The descriptions are currently textarea strings, not Lexical documents.
Keep existing slugs and URLs. Do not localize entire product or SEO groups.

Payload's installed Mongo adapter builds localized scalar fields as locale-keyed
objects (`node_modules/@payloadcms/db-mongodb/dist/models/buildSchema.js`). Thus
legacy `title: "Име"` must become `title: { bg: "Име" }` before the new schema
reads it. Null, empty and absent fields must retain their distinct meanings.
Existing version documents need the same treatment under `version.*`; restoring
an unmigrated version would otherwise reintroduce the old shape.

## Integration audit and activation requirements

| Path / integration | Current behavior | Required before activation |
| --- | --- | --- |
| `src/endpoints/nik-price-sync.ts` | NIK finds by sourceId/SKU, creates products with BG title/optional description, updates shared price and stock. | Explicit `locale: 'bg'` on product/category reads and writes. BG imports must preserve EN. Keep event IDs and stock/price contracts unchanged. |
| `scripts/woocommerce/payloadImport.ts` | Imports/upserts categories and products with scalar BG titles/descriptions. | Explicit BG locale on reads/writes. Rehearse repeat import after translation and verify EN survives. |
| `src/services/catalogSync/{index,manual,batch,categories}.ts` | Loads products, ancestors and category titles to build content events for ibis-electronics.ro. No explicit locale is set. | Explicit BG on all source lookups, including populated relations and category parents; preserve ACL and request transaction context. |
| `src/services/catalogSync/fingerprints.ts` | Content hash excludes price/stock but includes normalized source text. | Calculate from explicit BG projection. EN-only edit must leave BG hash and RO content status unchanged. |
| `src/services/romaniaUpdates/index.ts` | Separate price/stock journal; only products already sent through content workflow are eligible. Compares saved vs previous shared values. | Preserve existing revision, replay and superseding behavior. EN-only save must not emit price/stock events. |
| `src/services/nikOrders/contract.ts` | Sends `BG:<orderId>` and SKU/quantity to nikelectric.com. | Keep identity, quantities and idempotency unchanged. Language must not create a second product/order stream. |
| `src/collections/Products/index.ts`, `src/merchant/tasks.ts` | Product saves invoke review-queue hooks and queue Merchant; Merchant loads source product without explicit locale. | Merchant must read BG. Guard EN-only text saves from unnecessary Merchant/review churn; shared commercial edits must still trigger normal behavior. |
| `scripts/{syncProductCompatibilityFields,recalculateRetailPrices}.ts`, `scripts/woocommerce/{repairProductSlugs,mergeDuplicateCategories}.ts` | Maintenance reads/writes existing product/category data. | Audit explicit BG where text is read; preserve shared slugs and EN text. Never use a stale localized whole-document replacement. |
| `src/endpoints/productVersionsAudit.ts` | Version audit/repair tools inspect product history. | Verify version schemas and tools against localized objects and migrate all retained product versions. |
| `src/articleSync/` | Separate article synchronization, including related product URLs. | Articles are outside this migration. Shared product IDs/slugs must preserve related URLs; do not accidentally localize articles in this phase. |
| Storefront queries, search, cart population, SEO and cached helpers | Existing queries largely rely on implicit source language. | Pass locale explicitly; include language/fallback in cache keys. Verify populated categories/products and search in both languages. |

This audits the BG repository's contracts, not the implementation or current
configuration of the two remote sites. Remote acceptance must be rehearsed against
staging or transport mocks, without sending migration events to production.
The unrelated untracked NIK stock scripts are not part of this migration and must
receive their own locale audit before being run after activation.

## Offline preparation tool

This preparation is not a deployment migration. The files are
`scripts/localization/plan.ts` and `scripts/localization/prepare.ts`.
The tool imports neither Payload configuration nor database clients, makes no
network calls and cannot execute live writes or hooks. It produces a field-level
plan and rehearses forward and reverse conversion in memory.

Prepare a private JSON snapshot with keys `products`, `categories` and, when
present, `productVersions` / `categoryVersions`. Each value is an array of **raw**
Mongo exported documents using `_id`; do not use locale-flattened REST exports.
Keep Extended JSON wrappers for IDs/dates/numbers. Both main collections are
required, even if empty. Version keys are logical aliases: verify physical names
on the clone. The installed adapter derives names as `_products_versions` etc.,
but adapter pluralization/custom dbName may affect actual collection names.
Products have versions via the ecommerce plugin. Export every retained version;
include category versions only if they exist in the deployed schema.

```sh
pnpm exec tsx scripts/localization/prepare.ts /private/snapshot.json /private/plan.json
```

The output is exclusively created with mode 0600 and contains original BG text;
keep snapshots and plans outside Git. The tool preserves existing BG/EN objects,
is idempotent, blocks unknown value shapes, duplicate IDs and unsafe paths, and
refuses stale forward or reverse patches. Reverse conversion refuses to erase
EN translations or changed BG text. Tests cover these cases.
This is a rehearsal on the supplied data; an empty export cannot prove production
coverage. Verify export counts against the clone, including version counts.

## Deployment sequence (not executed)

1. Take a consistent full Mongo backup and verify restoration to an isolated clone.
   Record collection names/counts/indexes and deployed code revision. Pause import,
   admin content writes, orders and scheduled integration workers during the final
   cutover; disabling the UI alone does not stop webhook or job writes.
2. Export raw documents from that clone and run the offline planner. Compare ID,
   SKU, slug, price/stock, relations, integration journals, dates and document counts
   before/after. Review every unexpected shape instead of coercing it.
3. Implement explicit BG integration behavior, EN query/cache behavior and hook
   guards together with the localized schema. Generate types and validate TS.
   Rehearse Mongo indexes, draft publish/restore and search with the new schema.
4. Build a separately reviewed database executor using guarded field updates,
   durable per-document journaling and full preflight before writes. It must avoid
   Payload hooks, preserve BSON types and timestamps, detect concurrent edits and
   support restart/partial-run recovery. **No database executor is included yet.**
5. On the clone, test NIK create/replay/price/stock, Woo repeat import, RO category
   paths/content hash, RO price/stock revisions and NIK order SKU contract. Test
   that EN-only text edits produce no commercial events or BG content changes.
   Then rehearse rollback, including refusal after translations/new writes.
6. Only after successful rehearsal, schedule the maintenance window, migrate raw
   fields before starting localized code, run read-only smoke checks, then resume
   writers/workers. Keep public EN noindex until translated content is reviewed.
7. Before new localized writes, rollback can restore original fields plus old code.
   After writes resume, do not unwrap fields or restore the old backup blindly:
   that could erase translations, orders or stock changes. Prefer roll-forward or
   an explicitly reconciled restore with all commercial changes preserved.

## OpenAI translation phase

Translation runs only after schema/integration rehearsal. It updates EN text on
the same product, never shared commercial fields. Track the BG source fingerprint,
translation status and errors; invalidate stale translations when BG text changes.
Check the source fingerprint again before saving an async translation. Use a
protected server-side API key and explicit administrative batch start. No paid API
requests, migration, configuration activation or external sync is part of this
preparation commit.

## Integration preparation implemented

The source-language options now explicitly select BG without fallback for NIK,
WooCommerce, RO catalog loaders/category ancestry/batches/state writes, RO update
reads, Merchant reads and the tracked catalog maintenance scripts. A small type
bridge is isolated in `src/i18n/catalogSource.ts` until localized types are generated.
Payload ignores these locale options while localization is disabled; no schema
or database activation is included.

EN text-only updates skip Merchant queueing and do not complete product review.
Shared-field changes still follow the existing hooks. Woo incremental updates keep
existing product slugs; destructive replacement is blocked for localized catalogs.
The legacy version repair writer is blocked when localization is enabled, pending
its separate adaptation to full locale documents. Offline planning remains available.
No translation jobs or paid API requests have been introduced in this stage.
