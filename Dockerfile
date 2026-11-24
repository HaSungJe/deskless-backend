# syntax=docker/dockerfile:1
# 앱 하나를 이미지 하나로 — APP 인자로 고른다 (gateway | user-service | admin-service | scheduler)
#   docker build --build-arg APP=gateway -t deskless/gateway .
# 베이스는 Debian slim: bcrypt 가 glibc 용 prebuild 만 제공한다(Alpine/musl 이면 소스 빌드가 필요).

# Node 24 LTS(Krypton) — 패치 버전까지 고정한다(PC 에 받아 둔 옛 이미지가 쓰이지 않게). 보안 패치가 나오면 이 줄을 올린다.
# 하한 24.22.1(2026-11 보안 권고) — package.json engines 와 같이 본다
ARG NODE_IMAGE=node:24.22.3-slim

# ── 1. 전체 의존성 ──
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. 앱 빌드 ──
FROM deps AS build
ARG APP
COPY tsconfig.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs
RUN test -n "$APP" || (echo "APP build-arg 가 필요합니다 (gateway | user-service | admin-service | scheduler)" && exit 1)
RUN npx nest build "$APP"
# 빌드 산출물의 루트 모듈을 불러와 본다(서버는 띄우지 않는다) — 데코레이터 필드 타입이 같은 파일 아래의 클래스면 실행 때 바로 죽는 것을 이미지 빌드에서 잡는다(scripts/check-build-load.mjs 와 같은 확인)
RUN node --input-type=module -e "await import('./dist/apps/${APP}/apps/${APP}/src/${APP}.module.js')"

# ── 3. 운영 의존성만 ──
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── 4. 실행 이미지 ──
FROM ${NODE_IMAGE} AS runtime
ARG APP
ENV NODE_ENV=production \
    APP=${APP}
WORKDIR /app
# package.json 의 "type": "module" 이 있어야 dist 의 .js 가 ESM 으로 실행된다
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist/apps/${APP} ./dist/apps/${APP}
# 내부 파일 저장소 폴더(AWS_S3_BUCKET 이 빌 때) — 빈 공용 파일 볼륨(deskless 차트)이 처음 붙을 때 이 폴더의 소유자(node)를 물려받는다
RUN mkdir -p /app/storage/files && chown -R node:node /app/storage
USER node
CMD ["sh", "-c", "exec node dist/apps/${APP}/apps/${APP}/src/main.js"]
