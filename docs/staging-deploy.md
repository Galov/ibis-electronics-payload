# Staging Deploy

Минимален staging deploy за Hetzner + Docker.

## 1. Подгответе сървъра

- Ubuntu на Hetzner
- Docker и Docker Compose plugin
- публичен DNS запис към сървъра:
  - препоръчително `staging.nikelectric.eu`

## 2. Allowlist в MongoDB Atlas

Добавете публичното IP на Hetzner сървъра в Atlas Network Access.

## 3. Качете проекта

Качете текущото repo на сървъра, например в:

`/opt/nic-electrik-payload`

## 4. Направете staging env файл

Копирайте:

`/opt/nic-electrik-payload/.env.staging.example`

към:

`/opt/nic-electrik-payload/.env.staging`

и попълнете:

- `PAYLOAD_SECRET`
- `DATABASE_URL`
- `NEXT_PUBLIC_SERVER_URL`
- `PAYLOAD_PUBLIC_SERVER_URL`
- `PREVIEW_SECRET`

## 5. Build + run

От директорията на проекта:

```bash
docker compose -f docker-compose.staging.yml up -d --build
```

## 6. Smoke test

Проверете:

- начална страница
- `/shop`
- `/admin`
- login в admin
- някой product page
- legacy изображения

## 7. Reverse proxy / SSL

За истински публичен staging е нужен reverse proxy със сертификат:

- Caddy
- Nginx
- Traefik

Ако искаме, следващата стъпка е да добавим и примерен Caddyfile.

## Полезни команди

```bash
docker compose -f docker-compose.staging.yml logs -f
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml down
docker compose -f docker-compose.staging.yml up -d --build
```
