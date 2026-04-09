# Nik -> Ibis минимален price sync

Този endpoint е първият минимален webhook за връзката `Nik -> Ibis`.

## Обхват

Засега endpoint-ът прави само това:

- приема масив от продукти
- намира продуктите в `Ibis` по `sku`
- update-ва само `sourcePrice`
- преизчислява `price` според текущата `markupPercent` надценка

Засега endpoint-ът **не** прави:

- create на нови продукти
- publish/status логика
- update на категории, описания, изображения, производител, SKU или други полета

## Endpoint

`POST /api/integrations/nik/products/price-sync`

## Защита

Изисква header:

`x-webhook-secret: <NIK_SYNC_WEBHOOK_SECRET>`

Без валиден secret връща `401`.

## Примерен payload

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

## Примерен отговор

```json
{
  "markupPercent": 15,
  "processed": 1,
  "updated": 1,
  "notFound": 0,
  "invalid": 0,
  "items": [
    {
      "sku": "110BH01",
      "status": "updated",
      "sourcePrice": 12.5,
      "price": 14.38
    }
  ]
}
```

## Бърз тест с curl

```bash
curl -X POST "https://new.ibis-electronics.com/api/integrations/nik/products/price-sync" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: CHANGE_ME" \
  -d '[
    {
      "sku": "110BH01",
      "data": {
        "sourcePrice": 12.5
      }
    }
  ]'
```
