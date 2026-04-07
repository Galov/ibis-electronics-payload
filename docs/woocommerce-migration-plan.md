# WooCommerce Migration Plan

## Goal

Migrate the legacy WooCommerce catalog from [`nikelect_woocdb2019.sql`](/Users/ivogalov/Downloads/Projects/NIK electric/NikElectricPayload/nikelect_woocdb2019.sql) into the current Payload app after the storefront cleanup.

This migration is intentionally catalog-only:

- keep legacy images as external URLs for now
- set `price = 0` on initial import
- do not expose products with `price <= 0` in the storefront
- do not import legacy checkout, payments, shipping rules, orders, or users

## Current Target Schema

### `products`

Implemented in [`src/collections/Products/index.ts`](/Users/ivogalov/Downloads/Projects/NIK electric/NikElectricPayload/nic-electrik-payload/src/collections/Products/index.ts).

Target fields used by the importer:

- `sourceId`
- `title`
- `slug`
- `sku`
- `originalSku`
- `manufacturerCode`
- `description`
- `shortDescription`
- `brand`
- `categories`
- `price`
- `priceInUSD`
- `stockQty`
- `inventory`
- `stockStatus`
- `manageStock`
- `backordersAllowed`
- `imagesMigrated`
- `images[]`
- `legacyAttachmentIDs`
- `legacyProductUrl`
- `legacyModifiedAt`
- `published`

### `categories`

Implemented in [`src/collections/Categories.ts`](/Users/ivogalov/Downloads/Projects/NIK electric/NikElectricPayload/nic-electrik-payload/src/collections/Categories.ts).

Target fields:

- `sourceTermId`
- `sourceTaxonomyId`
- `title`
- `slug`
- `parent`
- `productCount`

### `brands`

Implemented in [`src/collections/Brands.ts`](/Users/ivogalov/Downloads/Projects/NIK electric/NikElectricPayload/nic-electrik-payload/src/collections/Brands.ts).

Target fields:

- `sourceTermId`
- `sourceTaxonomyId`
- `title`
- `slug`
- `productCount`

## Source Model

The dump is a standard WordPress / WooCommerce schema with prefix `nk_`.

Primary source tables:

- `nk_posts`
- `nk_postmeta`
- `nk_terms`
- `nk_term_taxonomy`
- `nk_term_relationships`
- `nk_wc_product_meta_lookup`

Relevant schema anchors in the dump:

- `nk_postmeta`: line `144342`
- `nk_posts`: line `2296229`
- `nk_terms`: line `2856077`
- `nk_term_relationships`: line `2856572`
- `nk_term_taxonomy`: line `2895075`
- `nk_wc_product_meta_lookup`: line `3037343`

Observed taxonomy signals:

- `product_cat` exists in `nk_term_taxonomy`
- `pwb-brand` exists in `nk_term_taxonomy`
- `product_type` exists in `nk_term_taxonomy`
- `simple` exists in `nk_terms`
- `variable` exists in `nk_terms`

Observed variation signal:

- `product_type` row for `simple` has count `8876`
- `variable` exists as a term, but the current dump evidence strongly suggests the catalog is predominantly or entirely simple products for migration purposes

Observed image signals:

- featured image meta uses `_thumbnail_id`
- gallery meta uses `_product_image_gallery`
- attachments store file paths in `_wp_attached_file`
- image alt text is available in `_wp_attachment_image_alt`

Observed taxonomy samples:

- `product_cat` rows include parent-child relationships
- `pwb-brand` rows are flat and use `count` for product totals

## Field Mapping

### Categories

Source:

- `nk_terms.term_id`
- `nk_terms.name`
- `nk_terms.slug`
- `nk_term_taxonomy.term_taxonomy_id`
- `nk_term_taxonomy.parent`
- `nk_term_taxonomy.count`

Filter:

- `nk_term_taxonomy.taxonomy = 'product_cat'`

Target:

- `sourceTermId = term_id`
- `sourceTaxonomyId = term_taxonomy_id`
- `title = terms.name`
- `slug = terms.slug`
- `productCount = term_taxonomy.count`
- `parent = category mapped from term_taxonomy.parent`

### Brands

Source:

- `nk_terms.term_id`
- `nk_terms.name`
- `nk_terms.slug`
- `nk_term_taxonomy.term_taxonomy_id`
- `nk_term_taxonomy.count`

Filter:

- `nk_term_taxonomy.taxonomy = 'pwb-brand'`

Target:

- `sourceTermId = term_id`
- `sourceTaxonomyId = term_taxonomy_id`
- `title = terms.name`
- `slug = terms.slug`
- `productCount = term_taxonomy.count`

### Products

Base source:

- `nk_posts.ID`
- `nk_posts.post_title`
- `nk_posts.post_name`
- `nk_posts.post_content`
- `nk_posts.post_excerpt`
- `nk_posts.post_modified_gmt`
- `nk_posts.guid`
- `nk_posts.post_status`

Filter:

- `nk_posts.post_type = 'product'`

Meta keys used in v1:

- `_sku`
- `_stock`
- `_stock_status`
- `_manage_stock`
- `_backorders`
- `_thumbnail_id`
- `_product_image_gallery`

Optional legacy meta worth checking during implementation:

- `product_original_sku`
- `product_manufacturer`

Confirmed in the dump:

- `product_original_sku` is populated for at least part of the catalog
- `product_manufacturer` is populated for at least part of the catalog
- `products_price_2` exists widely, but is intentionally ignored in v1 because initial Payload prices will be set to `0`

Target:

- `sourceId = posts.ID`
- `title = posts.post_title`
- `slug = posts.post_name`
- `description = posts.post_content`
- `shortDescription = posts.post_excerpt`
- `sku = meta['_sku']`
- `originalSku = meta['product_original_sku'] || null`
- `manufacturerCode = meta['product_manufacturer'] || null`
- `price = 0`
- `priceInUSD = 0`
- `stockQty = parsed meta['_stock'] || 0`
- `inventory = stockQty`
- `stockStatus = normalized meta['_stock_status'] || 'unknown'`
- `manageStock = meta['_manage_stock'] === 'yes'`
- `backordersAllowed = meta['_backorders'] && meta['_backorders'] !== 'no'`
- `legacyModifiedAt = posts.post_modified_gmt`
- `legacyProductUrl = posts.guid`
- `published = posts.post_status === 'publish'`

Relations:

- `categories` come from `nk_term_relationships.object_id = posts.ID` joined to `nk_term_taxonomy.taxonomy = 'product_cat'`
- `brand` comes from `nk_term_relationships.object_id = posts.ID` joined to `nk_term_taxonomy.taxonomy = 'pwb-brand'`

### Images

Target shape:

```ts
images: [
  {
    legacyUrl: string
    storageKey?: string
    alt?: string
  },
]
```

Featured image:

- read attachment ID from `_thumbnail_id`
- load attachment path from attachment meta `_wp_attached_file`
- load alt text from `_wp_attachment_image_alt`

Gallery images:

- read comma-separated IDs from `_product_image_gallery`
- resolve each attachment the same way

Importer rule:

- set `storageKey = undefined`
- set `imagesMigrated = false`
- set `legacyAttachmentIDs` to the collected attachment IDs

Legacy URL resolution rule:

1. prefer attachment post `guid` when present and valid
2. otherwise build URL from `_wp_attached_file`
3. use a single configurable base URL for uploads, for example `https://legacy-domain/wp-content/uploads`

This keeps the data model ready for a later Cloudflare R2 migration:

- current frontend resolves `storageKey` first
- otherwise falls back to `legacyUrl`

## Import Phases

### Phase 1: Extract

Read only the needed source tables and ignore the rest of the dump.

Expected in-memory dictionaries:

- products by `ID`
- post meta grouped by `post_id`
- terms by `term_id`
- taxonomies by `term_taxonomy_id`
- relationships grouped by `object_id`
- attachment metadata by attachment post ID

### Phase 2: Categories

1. Extract all `product_cat` taxonomies.
2. Upsert categories without `parent`.
3. Resolve parent relationships in a second pass.

Upsert key:

- primary: `sourceTaxonomyId`

### Phase 3: Brands

1. Extract all `pwb-brand` taxonomies.
2. Upsert brands.

Upsert key:

- primary: `sourceTaxonomyId`

### Phase 4: Products

1. Extract `post_type = 'product'`.
2. Join post meta.
3. Resolve category and brand relationships from `term_relationships`.
4. Resolve image attachments.
5. Normalize fields.
6. Upsert products in batches.

Upsert keys:

- primary: `sourceId`
- secondary safety check: `slug`

Batch size:

- start with `250`
- increase to `500` if Atlas write latency is acceptable

### Phase 5: Verification

After import, compare:

- total source products vs total Payload products
- total `product_cat` rows vs Payload categories
- total `pwb-brand` rows vs Payload brands
- products with missing `sku`
- products with no category
- products with no images
- products with `price = 0`
- duplicate `slug`
- duplicate `sku`

## Storefront Rules After Import

The storefront must continue to expose only products where:

- `published = true`
- `price > 0`

This means the first migration can safely import the full catalog with `price = 0` without exposing incomplete products publicly.

## Recommended Import Order In Code

1. parse dump into normalized intermediate objects
2. import categories
3. import brands
4. import products
5. run verification report

Recommended implementation layout:

- `scripts/woocommerce/import.ts`
- `scripts/woocommerce/parseDump.ts`
- `scripts/woocommerce/mapCategories.ts`
- `scripts/woocommerce/mapBrands.ts`
- `scripts/woocommerce/mapProducts.ts`
- `scripts/woocommerce/report.ts`

## Deliberate Non-Goals For v1

- importing historical WooCommerce orders
- importing customers
- importing addresses
- importing product reviews
- importing variable products
- importing shipping rules
- importing tax rules
- importing payment records

## Open Questions Before Coding The Importer

These are not blockers for the schema, but they should be confirmed during implementation:

1. Whether any products use gallery IDs beyond `_thumbnail_id`.
2. Whether any products have duplicate or empty slugs that need deterministic repair.
3. What the canonical legacy uploads base URL should be if attachment `guid` is missing or unreliable.
