---
name: Boot stability & restart-loop fix
description: Rules that keep the server boot fast and crash-resistant; why the port opens before DB work and why there is one shared pool
---

# Production boot stability

## Rule: open the HTTP port before running schema "ensure"/seed/backfill work
The bootstrap registers routes + error handler + static/vite, then calls
`httpServer.listen`, and only fires the heavy idempotent schema setup
(`runStartupTasks()`) from inside the listen callback — never awaited before listen.

**Why:** When all the ensure blocks ran before `listen`, the deployment healthcheck
(default VM probe is `GET /`, not configurable in `.replit`) hit a closed/slow port
during boot and recycled the instance — a SIGTERM / connection-refused /
healthcheck-500 restart loop, worst under a synchronized login spike.

**How to apply:** New startup DB work goes inside `runStartupTasks()`. Never add an
`await <ensureBlock>()` between the bootstrap start and `httpServer.listen`. Keep `/`
and `/healthz` DB-free so the probe stays cheap.

## Rule: one shared bounded connection pool
The app pool and the connect-pg-simple session store must share a single bounded
`pg.Pool`. **Why:** two unbounded pools exhausted Postgres connections under a
login burst, causing 500s on the root path.

## Rule: crash safety vs. fatal classification
`unhandledRejection` is logged and the process kept alive (usually a recoverable
transient). `uncaughtException` is logged and triggers graceful shutdown (the
process may be in an undefined state — don't keep serving). SIGTERM/SIGINT drain
in-flight requests, close the pool, with a force-exit timeout fallback.
