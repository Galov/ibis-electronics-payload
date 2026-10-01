# Manual BG → RO article sender

Related RO issue: https://github.com/Galov/ibis-electronics-romania/issues/56. The agreed behavior is **RO drafts for human review**, not automatic publication.

An authenticated administrator uses the Bulgarian **Румънски блог** control on an existing BG article. Save/publish first: the sender reads the current published version, never unsaved form values or an unpublished draft. `POST /api/article-sync/posts/:id/send` sends it; `GET /api/article-sync/posts/:id/status` checks the actual RO receipt. The control is server-side authenticated and never exposes the integration key.

`ARTICLE_SYNC_SEND_ENABLED` defaults off. After separate approval, set it to `true` only when RO is deployed and its article receiver/translation are enabled. The sender reuses the existing server-only `CATALOG_SYNC_API_KEY` and sends only to `https://ibis-electronics.ro/api/article-sync/articles`, with a 15-second timeout and redirects forbidden. No background sender, article hooks, mass send, or cron is added. Product sync and commerce guards are unchanged.

The exact `blog-1.0` contract is mirrored in `src/articleSync/contract.ts` in both repositories. The sender uses a transaction and one uniquely indexed outgoing record per BG article. The canonical content hash covers the source snapshot, with original BG publication date, SEO, media metadata, category IDs, related IDs and link mappings. A changed snapshot increments a monotonic revision. An identical send reuses the original event. A→B→A creates three distinct revision/event IDs. A late status response cannot overwrite a newer event's outgoing record.

`sourcePublishedAt` is the original BG publication date, distinct from RO publication. RO displays public dates in Romanian and does not publish the draft automatically. Only text segments are translated; the rich-text tree is preserved and its references mapped. Existing manually edited RO fields are protected. The complete receiving policy and limitations are documented in RO `docs/article-translation-sync.md`.

Both applications must use the same shared R2 account/bucket/root-key layout. The sender requires original media filenames, raster MIME types, dimensions and sizes; it does not upload/copy files. Unsupported source structures or media fail explicitly before translation. A new BG category can be created in RO under its source identity. Known ordinary BG links are sent with resolved source IDs; unresolved links require review in RO.

The outgoing admin record displays `sending`, `queued`, `translating`, `succeeded`, `superseded`, `failed` or `unknown`. `queued` is not success. Network failures have unknown results: check status, then resend the same article if necessary. Raw infrastructure errors remain in server logs. No automatic recovery after process restarts is promised. RO can recover an expired translation lease on manual resend after one hour.

Validation: generated Payload types/import map; TypeScript; `tests/int/articleSync.int.spec.ts` and `articleSync-source.int.spec.ts`; existing product Catalog Sync tests; production build. HTTP and translation calls in tests are mocked. No real article or production setting is changed by these checks.
