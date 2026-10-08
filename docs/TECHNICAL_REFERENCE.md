# KnowledgeFlow AI — Technical Reference

> An AI-powered enterprise knowledge-management platform. Teams upload documents and
> meeting transcripts; the system extracts a summary, **decisions**, and **action items**
> (with human-in-the-loop review), tracks tasks, answers questions with a document-grounded
> AI chat, sends proactive notifications, and produces shareable project reports.

This document is generated from an inspection of the current codebase (not from prior notes).
It reflects the final state of the project (September 2026). Account-specific AWS identifiers
have been replaced with placeholders; the deployment itself has since been decommissioned.

---

## 1. Architecture

```
Browser (React SPA on CloudFront)
        │  HTTPS, JWT in Authorization header
        ▼
API Gateway (REST, /prod stage)  ──►  AWS Lambda (Express via serverless-http)
        │                                        │
        │                                        ├──► RDS PostgreSQL + pgvector  (all app data + embeddings)
        │                                        ├──► Amazon S3                  (uploaded document files)
        │                                        ├──► Amazon Bedrock             (Claude Haiku 4.5 + Titan embeddings)
        │                                        └──► Amazon SES                 (invite / reset / digest email)
        │
EventBridge cron (daily 07:00 UTC) ──► Lambda `digest` ──► notifications + SES digest emails
```

**Two deployment targets, one code base.** The Express app has two entry points:
- `backend/src/index.ts` — local dev server (`npm run dev` via `ts-node`, or `node dist/index.js`).
- `backend/src/lambda.ts` — the Lambda handler (`serverless-http`), the entry used in production.

Both mount the **same set of routers**. Because they are separate files, any new router must be
added to **both** (a real bug earlier: routes existed in `index.ts` but not `lambda.ts`, so they
worked locally and 404'd in production).

**Region:** everything runs in `eu-central-1` (Frankfurt).

---

## 2. Frontend

**Stack:** React 19 · Vite 8 · TypeScript 6 · React Router 7 · Axios · `@fontsource/plus-jakarta-sans`. Linting via `oxlint`. No CSS framework — hand-written component CSS files.

### Structure (`frontend/src/`)
- `main.tsx` — React root.
- `App.tsx` — root component: auth/theme state, three router trees (unauthenticated public, login, authenticated app).
- `api/client.ts` — the single Axios instance (base URL, JWT injection, response unwrapping, 401 handling).
- `layouts/AppLayout.tsx` — the authenticated shell (sidebar + header + routed content).
- `pages/` — one component (+ CSS) per screen.
- `components/` — reusable UI (`Avatar`, `Button`, `Card`, `Pill`, `StatCard`, `Input`, modals, `NotificationBell`, `Sidebar`, `Header`, task/create modals).
- `utils/date.ts` — date formatting helpers.

### Routes
| Path | Access | Page |
|---|---|---|
| `/login` | public | Login |
| `/forgot-password` | public | ForgotPassword |
| `/set-password?token=` | public | SetPassword (invite & reset) |
| `/report/:token` | **public (no auth)** | PublicReport (shareable report + PDF) |
| `/dashboard` | authed | Dashboard |
| `/projects`, `/projects/:projectId` | authed | Projects, ProjectDetail |
| `/documents`, `/documents/:documentId` | authed | Documents, DocumentDetail |
| `/upload` | authed | Upload |
| `/action-tracker`, `/tasks/:taskId` | authed | ActionTracker, TaskDetail |
| `/insights` | authed (managers/contributors/admins) | Insights (analytics) |
| `/ai-chat` | authed | AIChat |
| `/timeline` | authed | Timeline |
| `/users` | **admin only** (else redirect) | UserManagement |
| `/settings` | authed | Settings |

The **Insights** sidebar item is hidden from viewer-only members (`canSeeInsights`), and the
**User Management** admin section is hidden for non-admins.

---

## 3. Backend

**Stack:** Node + Express + TypeScript, compiled to `dist/` (`tsc`). Runs as an AWS Lambda via
`serverless-http`. Key deps: `pg`, `bcrypt`, `jsonwebtoken`, `multer` (uploads), `officeparser`
(text extraction), `pdfkit` (report PDFs), `aws-sdk` (v2), `uuid`.

### Layering (`backend/src/`)
- `routes/*.ts` — Express routers; declare paths + middleware, delegate to handlers.
- `handlers/*.ts` — business logic (one file per domain: `auth`, `projects`, `documents`, `ai`, `chat`, `tasks`, `analytics`, `notifications`, `reports`, `dashboard`, `timeline`, `users`).
- `middleware/auth.ts` — `verifyToken`, `requireAdmin`, `requireProjectAccess`.
- `db/connection.ts` — pg `Pool`, SSL, and custom type parsers (see Timezone below).
- `utils/` — `authTokens` (hashed one-time/report tokens), `email` (SES), `embeddings` (Titan/pgvector), `textExtraction` (officeparser), `risk` (project risk scoring).
- `jobs/digest.ts` — EventBridge-scheduled handler → `runDailyDigest()`.
- `types/index.ts` — shared TypeScript types (`AuthUser`, `JWTPayload`, etc.).

### API response envelope
Every endpoint returns `{ success: boolean, data?, error? }`. The frontend Axios interceptor
**unwraps** `{success, data}` so call sites read `response.data` directly.

---

## 4. Database schema (PostgreSQL + pgvector)

Full DDL in `backend/schema.sql`. `CREATE EXTENSION vector` enables semantic search.

| Table | Purpose / notable columns |
|---|---|
| `users` | `system_role` ∈ {admin, member}, `account_status` ∈ {active, inactive, pending}, `password_hash` (bcrypt) |
| `auth_tokens` | SHA-256-hashed one-time tokens; `purpose` (invite/reset/report); `project_id` set for report tokens; `expires_at` |
| `projects` | `name`, `department_name`, `description`, `created_by` |
| `project_members` | join table; `project_role` ∈ {manager, contributor, viewer}; unique (project, user) |
| `documents` | `s3_key`, `file_type`, `document_type`, `status` ∈ {uploaded, processing, processed, failed} |
| `document_texts` | extracted full text (1:1 with document) |
| `document_chunks` | **`embedding vector(1024)`** per chunk — the semantic index (HNSW cosine) |
| `ai_summaries` | AI summary + `review_status` ∈ {draft, confirmed, rejected}, `ai_confidence`, reviewer |
| `decisions` | extracted decisions + `source_excerpt`, review status, confidence |
| `action_items` | tasks: `assigned_to_user_id`, `deadline`, `status` ∈ {draft, confirmed, in_progress, completed, cancelled, rejected}, `risk_level` ∈ {low, medium, high}, full audit columns (reviewed/completed/cancelled by/at) |
| `task_status_history` | append-only status transitions (`changed_by`, `change_note`) |
| `task_notes` | progress/completion notes |
| `chat_conversations` | groups chat messages; AI-generated `title` |
| `chat_messages` | `question`, `answer`, `sources_json` (JSONB citations) |
| `notifications` | in-app notifications: `type` (e.g. task_assigned, digest), `title`, `body`, `link`, `read_at` |

**Referential integrity for user deletion:** every `*_by` / `user_id` reference is
`ON DELETE SET NULL` (history preserved) or `ON DELETE CASCADE` (memberships, tokens,
notifications, chat), so deleting a user is clean and never orphans a foreign key.

**Indexes** exist on membership lookups, documents-by-project, action-items by project/assignee/
status/deadline, chat by conversation/project-user, notifications by user, and the HNSW vector index.

### Timezone handling (`db/connection.ts`)
Custom pg type parsers avoid off-by-hours/day bugs:
- `DATE` (OID 1082) returned as raw `YYYY-MM-DD` string (a deadline never shifts a day).
- `TIMESTAMP` (OID 1114, "without time zone") interpreted as **UTC wall-clock**.

---

## 5. Authentication & Authorization

**Authentication** — stateless JWT.
- Login (`POST /auth/login`) verifies the password with **bcrypt** (`compare`) and issues an
  **HS256 JWT signed with `JWT_SECRET`, expiring in 24h**. Passwords are hashed with bcrypt
  (10 salt rounds). No server-side session store exists.
- `verifyToken` middleware validates the JWT, loads the (active) user, and attaches their
  `project_roles`. It rejects inactive/unknown users.
- The frontend stores the token + user in `localStorage` under `auth`; the Axios request
  interceptor attaches `Authorization: Bearer <token>` to every call. A `401` clears the
  stored auth and redirects to `/login`.

**Account provisioning** — no self-signup. Admins create users; the user activates via a
**one-time invite link** (`/set-password?token=`), setting their own password. Password reset
uses the same hashed-token flow. Raw tokens live only in the link; the DB stores the SHA-256 hash.

**Authorization** — two-level RBAC:
- **System role** (`users.system_role`): `admin` or `member`. `requireAdmin` gates user
  management and other admin-only routes.
- **Project role** (`project_members.project_role`): `manager`, `contributor`, `viewer`.
  `requireProjectAccess` checks the user is a member of the target project (admins bypass).
  Finer rules live in handlers (e.g. viewers cannot upload; only admins/managers create report
  links; analytics access is full/limited/none).

**Public (no-auth) routers:** `auth` and `reports` only. Every other router applies
`router.use(verifyToken)`.

---

## 6. API surface

Base URL (prod): `https://<api-id>.execute-api.eu-central-1.amazonaws.com/prod`

| Router | Endpoints (method path — access) |
|---|---|
| **auth** (public) | `POST /auth/login`; `GET /auth/invite/:token`; `POST /auth/set-password`; `POST /auth/forgot-password`; `GET /auth/me` (authed) |
| **projects** | `GET /` · `POST /` · `GET/PUT/DELETE /:projectId` · `POST /:projectId/report-link` · `POST /:projectId/members` · `DELETE /:projectId/members/:userId` |
| **documents** | `GET /` · `POST /upload` (multipart) · `GET /project/:projectId` · `GET/PATCH/DELETE /:documentId` · `POST /:documentId/text` |
| **ai** | `POST /process/:documentId` · summary/decision/action-item `review` + `PATCH` edits · `GET /summary|/decisions/:documentId` |
| **chat** | `POST /:projectId` (ask) · `GET /:projectId/conversations[/:id]` · `GET /:projectId/my-history` · `GET /:projectId/history` |
| **tasks** | `GET /` · `POST /` · `GET /project/:projectId` · `GET/PUT/DELETE /:taskId` · `POST /:taskId/assign` · `POST /:taskId/notes` |
| **analytics** | `GET /` (RBAC-scoped) |
| **notifications** | `GET /` · `POST /read` · `PATCH /:id/read` · `POST /run-digest` (admin trigger) |
| **reports** (public) | `GET /:token` (report JSON) · `GET /:token/pdf` |
| **dashboard** | `GET /` · `GET /project/:projectId` · `GET /my-metrics` |
| **timeline** | `GET /:projectId` |
| **users** (admin) | `GET /` · `POST /` · `PUT /:userId` · `PUT /:userId/memberships` · `PATCH /:userId/status` · `DELETE /:userId` |

---

## 7. Key subsystems

### 7.1 Document processing pipeline (`handlers/documents.ts` + `handlers/ai.ts`)
1. Upload (`POST /documents/upload`, multer) → file stored in **S3** (`s3_key`); a `documents`
   row is created. Viewers are rejected; unsupported file types are rejected up front.
2. **Text extraction** (`utils/textExtraction.ts`): `officeparser` for `pdf/docx/pptx/xlsx/odt/odp/ods`;
   UTF-8 decode for `txt/md/csv/log/json/vtt/srt`. Extraction never throws (a failure won't fail the upload).
3. **AI extraction** (`POST /ai/process/:documentId`): Bedrock **Claude Haiku 4.5** returns a JSON
   `{summary, decisions[], action_items[]}` with `source` excerpts and confidences. Rows are written
   as **`draft`** (human-in-the-loop). Re-processing is idempotent (deletes prior AI-generated drafts).
4. **Embedding** (`utils/embeddings.ts`): the extracted text is chunked (~2500 chars, 250 overlap)
   and each chunk embedded with **Amazon Titan Text Embeddings V2 (1024-dim)**, stored in
   `document_chunks`. Document status → `processed`.

### 7.2 Semantic + hybrid AI chat (`handlers/chat.ts`)
- Retrieval blends **vector similarity** (pgvector cosine, `embedding <=> query`) with a small
  **keyword bonus** (`score = cosine + min(kw*0.03, 0.15)`), keeps the best chunk per document,
  returns the top 3, and applies a **confidence floor (≥ 0.3)**.
- **Keyword fallback** when a document has no embeddings or no confident semantic match.
- **Citations:** answers reference `[Document N]`, remapped to real document names; sources stored
  in `chat_messages.sources_json`.
- **NO_INFO guardrail:** if nothing relevant is found, the assistant explicitly declines
  ("could not find this information…") rather than hallucinating.
- Conversations are grouped and given an **AI-generated title** for the history sidebar.
- Scope is **per-project** and RBAC-checked (`requireProjectAccess`).

### 7.3 Notifications & digests (`handlers/notifications.ts`, `jobs/digest.ts`)
- **Event-driven:** assigning a task to someone else writes a `task_assigned` notification
  (from task create, task owner-change, and AI action-item confirmation).
- **Scheduled digest:** an EventBridge cron (`cron(0 7 * * ? *)`, 07:00 UTC) runs the `digest`
  Lambda → `runDailyDigest()`: per user, counts overdue + upcoming (7-day) tasks, writes one in-app
  digest notification and sends a **SES digest email**.
- **Housekeeping:** each run **auto-prunes digest notifications older than 7 days**; it also
  replaces the previous *unread* digest so unread duplicates don't stack.
- **Bell UI** (`NotificationBell.tsx`) polls `GET /notifications` every 60s, shows an unread badge,
  supports "mark all read", and marks-on-click.

### 7.4 Analytics (`handlers/analytics.ts`, `pages/Insights.tsx`)
Single RBAC-scoped `GET /analytics` returning `access_level` (`full`/`limited`/`none`), summary
counts, activity-over-time, task-status & risk distributions, throughput by owner, and per-project
breakdowns. Viewers are excluded; managers/contributors get a scoped view; admins get everything.

### 7.5 Reports (`handlers/reports.ts`, `pages/PublicReport.tsx`)
- Admin/manager calls `POST /projects/:projectId/report-link` → creates a multi-use **`report`
  token (7-day expiry)** and returns a **public CloudFront link** `/report/:token`.
- The public page (no auth) renders a slide-deck project brief (overview stats, team + roles,
  decisions, open action items, recent activity).
- **PDF** via `pdfkit` at `GET /reports/:token/pdf`. API Gateway `binaryMediaTypes: application/pdf`
  returns binary only when the request `Accept` header is `application/pdf`, so the frontend fetches
  with that header and downloads the resulting blob.

### 7.6 Risk scoring (`utils/risk.ts`)
A leading-indicator model over **active** work (confirmed/in_progress):
`score = 2·overdue + 2·dueSoon + 1·highRisk + 1·unassigned`, bucketed to Low/Medium/High
(shown on the dashboard "Project risk overview").

---

## 8. External integrations

| Service | Use | Config |
|---|---|---|
| **Amazon RDS (PostgreSQL)** | all app data + pgvector embeddings | `DB_*` env; SSL `rejectUnauthorized:false`; pool |
| **Amazon S3** | uploaded document files | `S3_BUCKET`, `S3_REGION` |
| **Amazon Bedrock** | Claude **Haiku 4.5** (`eu.anthropic.claude-haiku-4-5-20251001-v1:0`) for extraction/chat; **Titan Text Embeddings V2** (`amazon.titan-embed-text-v2:0`, 1024-dim) | `BEDROCK_REGION`, `BEDROCK_MODEL_ID`, `EMBEDDING_MODEL_ID` |
| **Amazon SES** | invite / reset / digest email | `EMAIL_ENABLED`, `EMAIL_FROM`, `SES_REGION` — see Limitations (sandbox) |

IAM permissions for these are granted to the Lambda execution role in `serverless.yml`
(S3 object CRUD, `bedrock:InvokeModel`, `ses:SendEmail`, Secrets Manager read, VPC ENI, logs).

---

## 9. Environment variables (no secrets)

**Backend** (`backend/.env`, loaded at deploy via `useDotenv`):

| Var | Meaning |
|---|---|
| `PORT`, `NODE_ENV` | server port / environment |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | RDS connection (password is a secret) |
| `JWT_SECRET` | JWT signing key (secret) |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | local AWS creds (secret; in Lambda the IAM role is used instead) |
| `S3_BUCKET`, `S3_REGION` | document storage |
| `BEDROCK_REGION`, `BEDROCK_MODEL_ID`, `EMBEDDING_MODEL_ID` | Bedrock chat + embedding models |
| `EMAIL_ENABLED`, `EMAIL_FROM`, `SES_REGION` | SES email delivery |
| `FRONTEND_URL` | base URL used to build emailed/report links — **must be the CloudFront URL in prod** (passed at deploy time) |

**Frontend** (`frontend/.env*`): `VITE_API_BASE_URL` — the API Gateway base URL baked into the build
(`.env.production` points at `/prod`).

> Secrets (DB password, JWT secret, AWS keys) live only in local `.env` files and are **not**
> committed. Production Lambda uses its IAM role for AWS access.

---

## 10. Testing

There is **no automated test suite** (the backend `npm test` is a placeholder; no `*.test.*`/`*.spec.*`
files exist). Verification to date has been done **manually** and via:
- Direct API calls against the deployed endpoints (login, chat, analytics, notifications, reports).
- Browser walkthroughs of the live site (semantic chat with citations, Insights dashboard,
  notification bell, public report + PDF download).
- Ad-hoc Node scripts importing `dist/db/connection.js` for schema/data checks.

This is the clearest gap for future work (see §14).

---

## 11. Deployment

**Backend** — Serverless Framework **v3** (`backend/serverless.yml`), stage `prod`, region `eu-central-1`:
- Two functions: **`api`** (Express via `serverless-http`, `dist/lambda.handler`) and **`digest`**
  (scheduled `cron(0 7 * * ? *)`).
- Lambda runs **inside the VPC** (subnets + security group) to reach RDS privately.
- `apiGateway.binaryMediaTypes: application/pdf` for report PDFs.
- Packaging ships the precompiled `dist/` + `node_modules`, excluding `serverless`, `typescript`,
  and non-runtime `*.d.ts` / `*.map` / `*.md` files to stay under Lambda's **250 MiB unzipped** limit.
- Deploy flow: `npm run build` → `npm ci --omit=dev` (slim deps) → `serverless deploy --stage prod`,
  passing `FRONTEND_URL=<cloudfront>` so links resolve to the live site.

**Frontend** — Vite build → sync to **S3** → CloudFront invalidation:
- S3 origin bucket: `<frontend-bucket>`
- CloudFront distribution `<distribution-id>` → **https://<distribution>.cloudfront.net**
- SPA deep-link fallback: 403/404 → `/index.html` so `/report/:token`, `/set-password`, etc. resolve.

**Networking cost note:** the VPC Lambda reaches AWS services via **VPC endpoints** (SES + Bedrock
interface endpoints, S3 gateway endpoint) rather than a NAT gateway.

### 11.1 Live AWS resources (as deployed)

Inspected directly from the account (`<account-id>`, region `eu-central-1`).

**Lambda functions** (both deployed from the same `dist/` package, ~61.5 MB code):

| Function | Handler | Runtime / Arch | Memory | Timeout |
|---|---|---|---|---|
| `knowledgeflow-ai-backend-prod-api` | `dist/lambda.handler` | nodejs20.x / x86_64 | 512 MB | 30 s |
| `knowledgeflow-ai-backend-prod-digest` | `dist/jobs/digest.handler` | nodejs20.x / x86_64 | 512 MB | 120 s |

- Configured env vars on the Lambda: `DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET,
  S3_BUCKET, S3_REGION, SES_REGION, EMAIL_ENABLED, EMAIL_FROM, FRONTEND_URL, NODE_ENV`
  (secret values not reproduced here).
- `EMAIL_ENABLED=true`, `EMAIL_FROM="KnowledgeFlow AI <<verified-sender>>"`,
  `FRONTEND_URL=https://<distribution>.cloudfront.net`.
- **`BEDROCK_MODEL_ID` and `EMBEDDING_MODEL_ID` are *not* set on the Lambda**, so the models come
  from the code defaults: chat = `eu.anthropic.claude-haiku-4-5-20251001-v1:0`,
  embeddings = `amazon.titan-embed-text-v2:0`. `BEDROCK_REGION` also falls back to `S3_REGION`.

**API Gateway:** REST API `<api-id>`, stage `/prod`, `{proxy+}` → the `api` Lambda;
`binaryMediaTypes: application/pdf`.

**S3 buckets** (both `eu-central-1`, all public-access blocks **ON** = fully private):

| Bucket | Role | Notes |
|---|---|---|
| `<documents-bucket>` | uploaded documents | AES256 default encryption; versioning off; ~17 objects (~48 KB) |
| `<frontend-bucket>` | built SPA | served via CloudFront (no S3 website hosting; origin access); ~730 KB |

**CloudFront:** distribution `<distribution-id>` → `<distribution>.cloudfront.net`, origin = the
frontend bucket, SPA fallback 403/404 → `/index.html`.

**RDS (PostgreSQL):**

| Property | Value |
|---|---|
| Identifier | `knowledgeflow-dev-db` |
| Endpoint | `<rds-endpoint>:5432` |
| Engine | PostgreSQL **18.3** (+ pgvector extension) |
| Class / storage | `db.t4g.micro` / 20 GB gp2 |
| Storage encrypted | **Yes** |
| Multi-AZ | No (single-AZ, `eu-central-1c`) |
| Backup retention | **1 day** |
| Publicly accessible flag | **Yes**, but the security group (`<security-group-id>`) allows port 5432 **only** from one developer IP (`/32`) and the Lambda security group (`<security-group-id>`) |
| VPC | `<vpc-id>` |

Both local dev and the deployed Lambda connect to **this same RDS instance**, which is why the
schema is identical across environments.

---

## 12. Security decisions

- **Passwords:** bcrypt (10 rounds); never stored or logged in plaintext.
- **Tokens:** invite/reset/report tokens are random and stored **hashed (SHA-256)**; the raw value
  exists only in the link. Invite/reset are one-time; report tokens are multi-use with a 7-day expiry.
- **JWT:** short-lived (24h), signed with a server secret; `401` auto-clears the client session.
- **RBAC** enforced server-side at two levels (system + project); the UI hides controls but the API
  is the source of truth.
- **Database access is SSL-enforced and encrypted at rest.** RDS is in a VPC and its security group
  allows port 5432 only from the Lambda security group and one developer IP. **Caveat (found in
  live inspection):** the instance's `PubliclyAccessible` flag is `true` (it has a public endpoint
  so local dev can connect) — the security group is what actually restricts access. Setting it to
  `false` and moving local access behind a bastion/VPN would harden this. Automated backups retain
  only **1 day**.
- **S3 buckets are fully private** (all public-access blocks on); the documents bucket uses AES256
  default encryption. The frontend bucket is reachable only through CloudFront.
- **Least-privilege IAM:** the Lambda role grants only the specific S3/Bedrock/SES/logs/Secrets/ENI
  actions it needs.
- **Secrets** are kept out of the repo (local `.env`, Lambda IAM role, optional Secrets Manager read).

---

## 13. Major technical decisions

- **TypeScript everywhere** (front and back) for a shared type vocabulary and safer refactors.
- **Express-on-Lambda** (`serverless-http`) — one Express app runs both locally and serverless,
  avoiding a rewrite for cloud.
- **pgvector inside the existing RDS** for semantic search — deliberately avoiding a separate
  always-on vector service (an OpenSearch Serverless collection was removed for cost).
- **Hybrid retrieval + citations + NO_INFO guardrail** rather than keyword-only search, so the
  assistant is grounded and declines gracefully.
- **Human-in-the-loop AI**: every AI-extracted summary/decision/action item starts as `draft` and
  must be reviewed — trust over automation.
- **Stateless JWT** (no session table) — simple and Lambda-friendly (the tradeoff: no real
  device/session management; see Limitations).
- **Two-level RBAC** to model both org-wide admins and per-project roles.
- **Cost-conscious infra**: VPC endpoints instead of NAT; serverless (pay-per-use) compute + CDN.

---

## 14. Limitations

- **SES sandbox:** digest/invite/reset emails only deliver to **verified** SES recipients; for
  others the email is skipped (in-app notifications still work). Leaving sandbox is an AWS request.
- **No automated tests / CI.**
- **Stateless auth:** no server-side session list, so there's no real "active devices" view or
  token revocation before expiry; logout is client-side only.
- **AWS SDK v2** is used (deprecation-warned); not yet migrated to v3.
- **Single-AZ RDS** (`db.t4g.micro`, 20 GB), no read replica, **1-day backup retention**, and the
  `PubliclyAccessible` flag is on — fine for a demo, but not HA/hardened for production.
- **OCR-heavy / very large documents** may not extract well (officeparser + Lambda limits).
- **Deployment is manual** (build → prune deps → deploy → invalidate), and new routers must be
  wired into **both** `index.ts` and `lambda.ts`.
- **Report links are shareable by anyone** who has the URL until they expire (by design).

## 15. Future work

- Add an **automated test suite** (unit + API integration) and **CI/CD**.
- **Migrate to AWS SDK v3**; consider Secrets Manager for all secrets.
- **Move SES out of sandbox** for real email delivery.
- **Global semantic search** across all accessible projects (reuse the embeddings).
- **Verified / freshness layer** (mark sources verified or stale; prefer verified in chat).
- **Session/device management** or refresh tokens if stronger auth lifecycle is needed.
- **Outbound integrations** (push confirmed action items to Slack/Jira/Asana).
- Unify the two Express entry points (or generate one from the other) to remove the dual-mount risk.
