# Nik -> Ibis product sync

Това е общият webhook endpoint за синхронизация `Nik -> Ibis`.

## Поддържани събития

- `product.created`
- `product.price_stock_updated`
- `product.deactivated`
- `product.deleted`

За backward compatibility endpoint-ът приема и стария минимален формат:

```json
[
  {
    "sku": "110BH01",
    "data": {
      "sourcePrice": 12.5
    }
  }
]
```

Той се третира като:

- `product.price_stock_updated`

## Endpoint

`POST /api/integrations/nik/products/price-sync`

## Защита

Изисква header:

`x-webhook-secret: <NIK_SYNC_WEBHOOK_SECRET>`

Без валиден secret връща `401`.

## Общ формат

```json
{
  "event": "product.price_stock_updated",
  "items": [
    {
      "sourceId": 123,
      "sku": "110BH01",
      "data": {
        "sourcePrice": 12.5,
        "stockQty": 4
      }
    }
  ]
}
```

Търсенето на продукта става:

1. по `sourceId`
2. fallback по `sku`

## product.created

```json
{
  "event": "product.created",
  "items": [
    {
      "sourceId": 123,
      "sku": "110BH01",
      "data": {
        "title": "Резервна част пример",
        "description": "Пълно описание",
        "shortDescription": "Кратко описание",
        "originalSku": "110BH01",
        "manufacturerCode": "AR81",
        "sourcePrice": 12.5,
        "stockQty": 8,
        "published": true,
        "legacyProductUrl": "https://old-ibis.example/product/110BH01",
        "legacyModifiedAt": "2026-04-09T10:30:00.000Z",
        "brand": {
          "sourceTermId": 55
        },
        "categories": [
          {
            "sourceTermId": 101
          },
          {
            "sourceTermId": 102
          }
        ],
        "images": [
          {
            "legacyUrl": "https://old-ibis.example/uploads/110BH01.jpg",
            "alt": "Резервна част пример"
          }
        ]
      }
    }
  ]
}
```

Задължителни полета за `product.created`:

- `sku`
- `data.title`
- `data.sourcePrice`
- `data.stockQty`

`sourceId` е optional само за `product.created`.

Ако `sourceId` липсва:

- продуктът пак може да се създаде в `Ibis`
- create логиката използва `sku` като идентификатор за този сценарий
- полето `sourceId` остава празно в `Ibis`

Поддържани допълнителни полета:

- `description`
- `shortDescription`
- `originalSku`
- `manufacturerCode`
- `published`
- `legacyProductUrl`
- `legacyModifiedAt`
- `brand.sourceTermId`
- `categories[].sourceTermId`
- `images[].legacyUrl`
- `images[].alt`

Поведение при снимките:

- `Ibis` опитва да свали всяка снимка от подадения `legacyUrl`
- качва я в своето `R2`
- ако качването мине, записва и `storageKey`
- ако свалянето или качването се провали, продуктът пак се създава, но за съответната снимка остава само `legacyUrl`

## product.price_stock_updated

```json
{
  "event": "product.price_stock_updated",
  "items": [
    {
      "sourceId": 123,
      "sku": "110BH01",
      "data": {
        "sourcePrice": 12.5,
        "stockQty": 4
      }
    }
  ]
}
```

Задължително:

- `sourceId` или `sku`
- `data.sourcePrice`

По желание:

- `data.stockQty`
- `data.images`

`price` в `Ibis` се преизчислява автоматично от `sourcePrice` + текущата `markupPercent`.

Ако `data.images` присъства в payload-а:

- `Ibis` заменя текущите снимки на продукта
- сваля новите изображения
- качва ги в своето `R2`
- записва новите `storageKey` стойности

Ако `data.images` липсва:

- снимките не се пипат

## product.deactivated

```bash
curl -X POST "https://new.ibis-electronics.com/api/integrations/nik/products/price-sync" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: CHANGE_ME" \
  -d '{
    "event": "product.deactivated",
    "items": [
      {
        "sourceId": 123,
        "sku": "110BH01"
      }
    ]
  }'
```

Прави:

- `published = false`

## product.deleted

```bash
curl -X POST "https://new.ibis-electronics.com/api/integrations/nik/products/price-sync" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: CHANGE_ME" \
  -d '{
    "event": "product.deleted",
    "items": [
      {
        "sourceId": 123,
        "sku": "110BH01"
      }
    ]
  }'
```

Прави:

- delete на продукта от `Ibis`

## Примерен отговор

```json
{
  "event": "product.price_stock_updated",
  "markupPercent": 15,
  "processed": 1,
  "created": 0,
  "updated": 1,
  "deactivated": 0,
  "deleted": 0,
  "notFound": 0,
  "invalid": 0,
  "exists": 0,
  "items": [
    {
      "sku": "110BH01",
      "sourceId": 123,
      "status": "updated",
      "sourcePrice": 12.5,
      "price": 14.38
    }
  ]
}
```
