# English product addresses

Products keep the shared Bulgarian `slug`. `englishSlug` is assigned once from the first saved English title; `englishLegacySlug` preserves the original route on `/en/products/…`. Title edits preserve both fields, including saves based on older Payload drafts. Existing English aliases issue a 308 redirect. Bulgarian routing is unchanged.

The allocator reserves Bulgarian slugs, existing English slugs and legacy aliases. Duplicate titles receive a product ID suffix. Unique partial indexes protect concurrent assignments. English translations committed through the translation journal receive their address in the same transaction. Manual English edits queue an address-only task; that task makes no provider calls.

`productHref` supplies product links and canonical URLs. The language switch resolves the same product through `/api/storefront-language`, preserves query strings and fragments, and sets the existing language preference cookie. This endpoint accepts only product paths on the same site and uses public product access rules. English indexing remains disabled pending the separate SEO release.

## Migration

`scripts/localization/englishProductSlugs.mjs` defaults to a read-only plan. It accepts only the approved local rehearsal databases, or the production database with the explicit `IBIS_EN_SLUG_PRODUCTION=confirmed` guard. It does not load environment files itself.

Before applying in production, prepare the release image, enable the existing maintenance gate, stop the app and scheduled writers, and verify that English jobs are idle. Run with `--apply --backup=/private/release-directory`. The directory must be new: before-images and the route plan are written exclusively before the first mutation. The migration writes only the two address fields with compare-and-set guards, then hashes every other product field to verify it stayed identical. It does not modify product versions, prices, stock, source slugs or translated text.

Retain `products.before.bson`, `route-plan.json` and `result.json` privately. For rollback, stop writers and restore only the two address fields from these before-images, guarded against the exact route values in the plan. Never replace complete products from the snapshot. Restoring the old app image alone remains safe because it ignores the additional fields.
