ARG APP_VERSION=0.0.0

# ─────────────────────────────────────────────────────────────────────────────────────
# 🔴 I DUE PREFISSI SONO ARG DI BUILD, NON ENV DI RUNTIME — e non è una preferenza.
#
# `astro:env` inlina nel bundle ogni variabile con `access: 'public'`, di qualunque
# contesto: entrambe finiscono dentro dist/ al momento di `astro build`. Passarle
# all'ambiente del container non dà alcun errore e non ha alcun effetto — il sito
# continua a servire l'origine con cui è stato COSTRUITO. È il modo in cui questa
# trappola inganna: nessun messaggio, nessun log, solo il valore sbagliato.
#
# Conseguenza pratica: l'immagine NON è riusabile fra ambienti. Un tag costruito per
# la produzione contiene la produzione, e ricostruirlo è l'unico modo di cambiarla.
# (Vedi astro.config.mjs §"I DUE PREFISSI" e sito/README.md.)
# ─────────────────────────────────────────────────────────────────────────────────────
ARG API_INTERNA_URL
ARG PUBLIC_MEDIA_ORIGINE

# ── Stage 1: dipendenze complete (build + check dei tipi) ────────────────────────────
# bookworm-slim e non alpine: @tailwindcss/vite porta i binari nativi di Lightning CSS e
# di Oxide, e la variante musl e' quella che si scopre rotta il giorno del deploy. Il
# peso in piu' e' dell'immagine di build, che non viene spedita.
#
# Il tag "22" e non "latest": package.json chiede >=22.12 e .npmrc ha engine-strict, quindi
# su una 20 `npm ci` si rifiuta di partire — qui e' la stessa versione della CI.
FROM node:22-bookworm-slim AS deps
WORKDIR /src
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /src

ARG API_INTERNA_URL
ARG PUBLIC_MEDIA_ORIGINE

# Il fallimento esplicito viene PRIMA di `astro build`. Senza, il messaggio sarebbe
# quello di astro:env sulla variabile mancante: corretto ma lontano dalla causa, che e'
# un `--build-arg` dimenticato nel compose o nella riga di comando.
RUN test -n "$API_INTERNA_URL"      || { echo "ERRORE: --build-arg API_INTERNA_URL non passato. E' una variabile di BUILD: senza, il sito non saprebbe da dove leggere le API." >&2; exit 1; }
RUN test -n "$PUBLIC_MEDIA_ORIGINE" || { echo "ERRORE: --build-arg PUBLIC_MEDIA_ORIGINE non passato. E' l'origine che finisce dentro src/srcset delle foto, nel browser del visitatore." >&2; exit 1; }

ENV API_INTERNA_URL=$API_INTERNA_URL
ENV PUBLIC_MEDIA_ORIGINE=$PUBLIC_MEDIA_ORIGINE

COPY --from=deps /src/node_modules ./node_modules
COPY . .

# ⚠️ `astro build` NON contatta il backend: output 'server' e nessun prerender, quindi
#    entrambe le pagine leggono a ogni richiesta. L'immagine si costruisce anche con il
#    backend spento — e deve, altrimenti un deploy dipenderebbe dallo stato del servizio
#    che sta per sostituire.
RUN npm run build

# ── Stage 3: dipendenze di sola produzione ──────────────────────────────────────────
# L'adapter Node lascia i pacchetti npm ESTERNI al bundle: dist/server/entry.mjs importa
# ancora da node_modules a runtime. Si reinstalla senza devDependencies invece di copiare
# l'albero completo, che porterebbe typescript e @astrojs/check in produzione.
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /src
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# ── Stage 4: runtime ─────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ARG APP_VERSION
LABEL version=$APP_VERSION
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /src/node_modules ./node_modules
COPY --from=build     /src/dist         ./dist
COPY                  package.json      ./

# 'standalone' produce un server HTTP completo: HOST e PORT sono le UNICHE due variabili
# che l'entry legge davvero a runtime (astro.config.mjs le dichiara per il dev server, che
# qui non gira). 0.0.0.0 perche' il lettore e' nginx sull'host, fuori dal container.
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production
EXPOSE 4321

# L'utente `node` (UID 1000) esiste gia' nell'immagine ufficiale. Qui NON serve l'UID
# fisso 10001 del backend: quello esiste per il bind mount dei media, e il sito non
# scrive su disco — legge le API e serve HTML.
USER node

# `/` risponde 200 anche con il backend irraggiungibile (degradazione voluta), quindi
# misura il sito e non il backend. E' quello che si vuole: un backend giu' non deve far
# riavviare in ciclo la vetrina, che ha ancora marca, slogan e orari da mostrare.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4321/ > /dev/null || exit 1

CMD ["node", "./dist/server/entry.mjs"]
