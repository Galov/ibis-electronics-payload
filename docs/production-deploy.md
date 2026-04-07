# Production Deploy

Production deploy за `Ibis Electronics` с:

- `GitHub Actions` за build
- `GHCR` за Docker image
- `Ubuntu VPS` само за runtime

## Как работи

1. push към `main`
2. GitHub Actions build-ва Docker image
3. image-ът се качва в `ghcr.io`
4. workflow-ът се логва по SSH в сървъра
5. на сървъра се изпълнява:

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

Сървърът не build-ва приложението.

## Какво трябва да има на сървъра

- Ubuntu
- Docker
- Docker Compose plugin
- директория на приложението, например:
  - `/opt/ibis-electronics`
- файлове:
  - `docker-compose.production.yml`
  - `.env.production`

## GitHub Repository Variables

Добави следните `Repository variables`:

- `NEXT_PUBLIC_SERVER_URL`
- `PAYLOAD_PUBLIC_SERVER_URL`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH`
- `DEPLOY_PORT` (по желание, default `22`)

## GitHub Repository Secrets

Добави следния `Repository secret`:

- `DEPLOY_SSH_KEY`

Това е private key-ът, с който Actions ще влиза в сървъра.

## Примерен `.env.production`

```env
NODE_ENV=production
PAYLOAD_SECRET=replace-me
DATABASE_URL=replace-me
NEXT_PUBLIC_SERVER_URL=https://ibis-electronics.com
PAYLOAD_PUBLIC_SERVER_URL=https://ibis-electronics.com
PREVIEW_SECRET=replace-me
ECONT_BASE_URL=https://ee.econt.com/services
ECONT_USERNAME=replace-me
ECONT_PASSWORD=replace-me
SPEEDY_USERNAME=replace-me
SPEEDY_PASSWORD=replace-me
```

## Първоначален setup на VPS

Примерно:

```bash
sudo mkdir -p /opt/ibis-electronics
sudo chown -R $USER:$USER /opt/ibis-electronics
cd /opt/ibis-electronics
```

После качи:

- `docker-compose.production.yml`
- `.env.production`

## Публичен или частен GHCR пакет

Ако repo-то е `public`, image-ът в `GHCR` може да е публичен и сървърът да pull-ва без допълнителен login.

След първия publish провери в GitHub:

- `Packages`
- `ibis-electronics-payload`
- visibility да е `public`, ако искаш VPS-ът да pull-ва без token

Ако по-късно repo-то стане `private`, ще трябва:

- или пакетът да остане public
- или да добавиш `docker login ghcr.io` на сървъра с token

## Забележка

Workflow-ът е направен така, че:

- build няма да тръгва, ако липсват `NEXT_PUBLIC_SERVER_URL` и `PAYLOAD_PUBLIC_SERVER_URL`
- deploy няма да тръгва, ако липсват VPS variables / SSH key

Тоест можеш да подготвиш всичко предварително, без да купуваш сървъра още днес.
