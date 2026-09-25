# Local changes to this checkout

This tree was extracted from `InvisiProxy-master.zip` and verified byte-identical
to upstream `QuiteAFancyEmerald/InvisiProxy` at commit
`c83303a4567d91cf07a4815c0e0a9f25c4ddbec0` (v7.0.2). Only the changes below
differ from upstream.

## 1. Vendored Ultraviolet package (`package.json`, `vendor/`)

Upstream pins `@titaniumnetwork-dev/ultraviolet` to a GitHub **release asset**
(`releases/download/v3.2.10-headers/...tgz`). `objects.githubusercontent.com`
is not reachable from this sandbox, so the dependency could not be downloaded.

`vendor/titaniumnetwork-dev-ultraviolet-3.2.10-headers.tgz` was rebuilt from the
same source: the `v3.2.10-headers` tag fetched from `codeload.github.com`, built
with `node build.js`, then packaged with `npm pack`. `lib/index.cjs` exports the
`uvPath` symbol the build script imports, and `dist/` contains the same file set
as the release artifact.

- sha256: `732154a712a76afd0b0deffe40699d26b50988508a1d679d42b97d22b8a3a44d`
- `package.json` dependency changed to `file:./vendor/titaniumnetwork-dev-ultraviolet-3.2.10-headers.tgz`

To go back to upstream's URL once that host is reachable, restore the original
`https://github.com/...` spec and delete `vendor/`.

## 2. `PREVIEW_MODE` env flag (`src/server.mjs`)

Helmet's default `frameguard` sends `X-Frame-Options: SAMEORIGIN`, which blocks
the app from being embedded in an iframe on another origin — including sandbox
preview frames. With `PREVIEW_MODE=1` the frameguard is disabled so the site can
be previewed. Unset (the default, and what a real deployment should use), the
upstream clickjacking protection is unchanged.

## Running it

```sh
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
export NODE_OPTIONS=--dns-result-order=ipv4first

pnpm install --ignore-scripts   # --ignore-scripts skips playwright's ~150MB chromium download
node run-command.mjs build      # writes views/dist (generated, git-ignored)
PREVIEW_MODE=1 node backend.js  # http://localhost:8080
```

Avoid `pnpm start`: it chains stop → build → start and expects the PM2 process
manager, which is awkward in a sandbox.

## Disguised routes

`config.json` has `disguiseFiles: true`, so upstream route names are rewritten:

| Upstream | Served as |
| --- | --- |
| `/` and `/login` | entry-point page (sets the loader key, then loads the site) |
| `/uv/*` | `/network/networking.*` |
| `/scram/*` | `/worker/*` |
| `/epoxy/*`, `/libcurl/*`, `/baremux/*` | `/epoch/*`, `/unix/*`, `/gmt/*` |
| `/wisp/` | `/cron/` |

The Wisp websocket is served through the main port at `/cron/`, so no separate
port or reverse proxy is needed for the client to reach it. If the fake
"403 Forbidden" page appears, clear localStorage for the site and reload — that
page is the loader refusing to run without its key.
