# Production readiness and operations

This guide describes the controls implemented for Chanda AI's current single-host AWS topology and the checks that still require an operator or provider account. “Production ready” is a repeatable operating practice, not only a successful build.

## Architecture boundary

Chanda is a modular monolith with four runtime boundaries:

- Caddy terminates TLS and exposes only HTTP/HTTPS.
- Next.js serves the browser application and proxies authenticated API requests over the private container network.
- NestJS owns HTTP workflows, authorization, provider callbacks, and synchronous database changes.
- The worker consumes durable outbox jobs for indexing and other asynchronous work.

PostgreSQL and Redis are attached only to Docker's internal network. Knowledge and backup buckets are private, encrypted, versioned, and accessible through the EC2 instance role. Administration uses AWS Systems Manager; the security group has no SSH ingress.

This topology is intentionally cost-conscious and not highly available. A host or Availability Zone failure causes downtime until the retained volume or a database backup is restored.

## Request and tenant security

- Firebase verifies identity. Chanda then issues a random application session whose hash—not raw token—is stored in PostgreSQL.
- The session cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`, path-scoped, expiring, and revocable.
- Protected workspace routes use both the session guard and role guard.
- Workspace-owned reads and mutations carry a workspace predicate, including background-job claims and final state transitions.
- Request DTOs are allow-listed, transformed, and reject unknown properties.
- UUID route parameters are parsed before reaching domain logic.
- Public widget capability tokens are high-entropy, hashed at rest, origin-checked when used by a browser, and rate-limited in Redis.
- File uploads are memory-bounded to 8 MB and limited to validated PDF, UTF-8 Markdown, or UTF-8 text.

Same-origin Next.js rewrites keep normal browser API traffic on the application origin. Public widget routes implement a narrow per-workspace CORS policy. No wildcard credentialed CORS policy is enabled.

## Secrets

Secret classes are deliberately separated:

| Secret                                            | Storage                                   | Consumer               |
| ------------------------------------------------- | ----------------------------------------- | ---------------------- |
| Firebase Admin, Stripe, OAuth application secrets | mode-`0600` production environment file   | API                    |
| Workspace AI keys                                 | AES-256-GCM ciphertext in PostgreSQL      | API and worker         |
| Channel access/refresh tokens                     | AES-256-GCM ciphertext in PostgreSQL      | API                    |
| PostgreSQL and Redis passwords                    | mode-`0600` production environment file   | containers             |
| AWS credentials                                   | temporary EC2 role or GitHub OIDC session | EC2 / release workflow |

AI and channel root keys must be independent canonical base64 encodings of 32 random bytes. Ciphertext is context-bound to its workspace and provider/channel. New channel ciphertext uses format version `2`; legacy `v1` rows remain readable so they can be replaced without an outage.

Structured logs redact sensitive field names and common OpenAI, Google, Meta, Telegram, Stripe, authorization-header, and query-string credential patterns. Request logs use route templates instead of raw URLs and never log bodies.

## Webhooks and asynchronous work

- Telegram webhook paths use an unguessable secret and compare it in constant time.
- WhatsApp and Meta callbacks verify the provider signature before parsing or ingesting events.
- Stripe verifies the raw-body signing signature and projects events idempotently.
- Gmail OAuth state is one-time, hashed, expiring, and bound to workspace/user intent.
- External message/event identifiers have uniqueness constraints. Duplicate delivery resolves the existing record instead of creating a second message.
- Database writes that must create background work use the transactional outbox. BullMQ delivery is at least once; workers claim jobs idempotently and verify workspace/document/version identity.

## Network and browser controls

NestJS disables `X-Powered-By`, uses Helmet, sends HSTS in production, and marks API responses `no-store`. Next.js sends CSP, HSTS, frame denial, MIME sniffing protection, a restrictive permissions policy, and a referrer policy. Caddy removes its server header and renews TLS certificates automatically.

The CSP currently permits inline scripts/styles because Next.js and the present styling pipeline require them. Tightening it to per-request nonces is a future defense-in-depth improvement and must be tested with authentication and the widget before launch.

## CI/CD and supply chain

The Verify workflow:

1. Uses SHA-pinned GitHub actions and a digest-pinned PostgreSQL/pgvector image.
2. Installs from the frozen pnpm lockfile.
3. Fails on high-severity dependency advisories.
4. Runs formatting, lint, strict type checks, unit tests, production builds, and PostgreSQL migration integration tests.

Release runs only for a successful `main` push verification. It checks out the verified SHA, publishes an immutable `sha-<commit>` GHCR image with SBOM and provenance, then assumes a least-privilege AWS role through GitHub OIDC. A protected GitHub production environment should require maintainer approval. SSM runs the deployment without SSH; deployment refuses a dirty host, fast-forwards only, runs migrations before services, and waits for health checks.

Dependabot covers npm/pnpm and GitHub Actions updates. Image digests and action SHAs should be reviewed and refreshed on a regular cadence.

## Backups and restore drill

The supplied timer creates a compressed custom-format PostgreSQL dump daily, uploads it to the private backup bucket with server-side encryption, and emits a CloudWatch success metric. The alarm treats a missing daily success as a failure.

A backup is not recovery-ready until this drill succeeds:

1. Choose a recent `s3://<backup-bucket>/postgres/chanda-*.dump` object.
2. Provision an isolated PostgreSQL 17 + pgvector database; never restore over production for a drill.
3. Download the archive through an authorized role.
4. Run `pg_restore --clean --if-exists --no-owner --no-privileges` against the isolated database.
5. Run all migrations to prove forward compatibility.
6. Start an isolated API against the restored database and verify readiness, authentication, workspace listing, inbox, knowledge metadata, and encrypted-credential readability.
7. Record restore duration, recovered backup timestamp, failures, and corrective work.
8. Destroy the isolated environment and securely remove the downloaded archive.

Run the drill before first customer data and at least quarterly. The current 35-day lifecycle is a product/operator choice; adjust it to legal and recovery requirements.

## Launch checklist

- [ ] Production Firebase domains and Admin credentials configured.
- [ ] Gemini authorization keys used; no standard key remains ahead of Google's September 2026 cutoff.
- [ ] Gmail consent verification and required Meta app permissions approved.
- [ ] Stripe live Price, portal, and webhook signing secret verified.
- [ ] Separate AI/channel encryption keys stored, backed up securely, and rotation owner named.
- [ ] DNS, TLS, webhook callbacks, and widget origin policy tested from the public internet.
- [ ] GitHub production environment approval and branch protection enabled.
- [ ] CloudWatch log delivery, CPU/status/backup alarms, and SNS subscription tested.
- [ ] Restore drill completed and recovery time recorded.
- [ ] Load test covers widget ingestion, inbox reads, provider validation, and knowledge indexing.
- [ ] Keyboard/screen-reader browser pass completed with a real authenticated workspace.
- [ ] Privacy policy, retention/deletion policy, subprocessors, and incident contacts published.

## Known operational limits

- One EC2 host, PostgreSQL instance, and Redis instance mean there is no automatic failover.
- The global NestJS throttle is process-local; public widget limits are Redis-backed. Multiple API replicas would require a shared throttler storage adapter.
- Root credential-key rotation requires a controlled re-encryption migration.
- Provider availability, quotas, billing, and app-review decisions remain external dependencies.
- The Gemini Interactions API is current but still documented by Google as beta; pin and test SDK upgrades before deployment.
- The runtime image favors a single deployable artifact and contains the monorepo production runtime; future scale work may split web/API/worker images and reduce each image's contents.
