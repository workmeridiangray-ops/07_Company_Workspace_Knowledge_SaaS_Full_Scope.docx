# Coverage against the scope document

Source: `docs/07_Company_Workspace_Knowledge_SaaS_Full_Scope.docx`. Status is as verified by the test suites in this repo (unit/integration tests, a full-screen smoke run for every role, browser flow tests, an axe WCAG A/AA scan). The product name **Fieldnote** is a placeholder.

| § | Area | Status | Notes |
|---|---|---|---|
| 2 | Public site and access | Built | Home, features, solutions (4), pricing from live plans, add-ons, demo, contact, help (search), updates, policy pages, sign-up, email verification, sign-in, TOTP 2FA, recovery, invitations, workspace switcher, access-denied, session-expired, profile, security, sessions, notification preferences. **Policy text is draft and needs legal approval.** Enterprise SSO and extra languages are not built (spec: explicit selection). |
| 3 | Subscriptions and setup | Built (provider stubbed) | Trial, monthly/yearly, coupons, GST 18%, proration on upgrade, downgrade-impact blocking, failed payment → 7-day grace → read-only, cancellation at period end, invoices, welcome checklist, sample data, export/closure. **Payment provider is a simulator (`PAYMENT_PROVIDER=test`).** A real INR gateway (e.g. Razorpay) must be integrated and its webhooks wired to `chargeInvoice` before taking money. |
| 4 | Roles and isolation | Built | 5 built-in roles + custom roles, 16 permissions (sensitive ones flagged), role editor, audit trail (append-only by DB trigger), session revocation on suspension, time-limited owner-approved support access. Per-branch scoping is expressed as teamspaces (no separate "branch" concept in this product). |
| 5 | Hierarchy and home | Built | Teamspaces (open/closed/private), page tree, favourites, recents, drafts, announcements, trash/archive, move with permission-change preview. |
| 6 | Editor | Built | 15 block types, markdown shortcuts, `/` menu, Tab indent, undo/redo, paste parsing, autosave with status, conflict dialog (keep mine / theirs / both), embeds allow-list, uploads with type/size/content checks. No custom executable blocks (spec: extension). |
| 7 | Databases | Built | 12 property types incl. relation, lookup, rollup; validation; schema protection; CSV import with preview/duplicate review/idempotent commit; duplicate merge; export. |
| 8 | Views | Built | Table, board, calendar, list; shared vs personal saved views; temporary URL filters kept separate; drag-and-drop with explicit confirmation of the effect (plus keyboard "Move to"). Timeline/Gantt not built (spec: extension). |
| 9 | Tasks/projects/goals | Built | Owners, due dates, dependencies (cycle-safe), recurrence in workspace time zone, blocked reasons, milestones, goals that need human confirmation. |
| 10 | SOPs | Built | Draft→review→published→retired, four-eyes approval, immutable versions, effective dates, audience, per-version acknowledgements, reminders, review expiry, "which version applied on date X". |
| 11 | Meetings/templates | Built | Agenda, attendance, decisions (with owner and SOP version), actions as tasks, template gallery/editor/versioning, update review (never silent). Recording/transcription not built (separate providers). |
| 12 | Collaboration | Built (async) | Comments, threads, resolve, mentions, inbox with access re-check on every render, preferences. **No live cursors or real-time co-editing** (spec: separately scoped); simultaneous edits are protected by conflict detection. |
| 13 | Sharing | Built | Private/teamspace/workspace/explicit, guests, expiring links, download control, public publish with review step (blocked for SOPs and record pages), access requests, guest directory, revocation, access review log. |
| 14 | Search/files/recovery | Built | Query-time access-checked search with type/teamspace filters, attachment library, storage meter, version history with compare and restore, trash. No OCR/file-content indexing (extension). |
| 15 | Forms/automation | Built | Form builder (public/internal, safe field types only, nonce + content de-dupe), rules with test-before-enable and no rule-triggers-rule, signed webhooks with retry/dedupe/logs, REST API with keys and idempotency. No third-party connectors (spec: named separate specification); a connector request registry is provided. |
| 16 | Admin analytics | Built | Usage vs limits, ownerless pages, stale pages, SOP reviews, template usage, audit, ZIP export in a documented structure, closure with 30-day retention. |
| 17 | Platform super admin | Built | Overview/MRR, businesses, plan versions (history preserved), coupons, invoices/payments with reference and statuses (paid/pending/failed/disputed/refunded), refunds/credits with mandatory reason, support queue, incidents, job failures with safe retry, outbox, storage, staff roles, audit, announcements/settings. |
| 18 | Integrations/data lifecycle | Built | See §15/16; one payment provider (simulated), one email provider (Resend), CSV, API/webhooks, retention policy. |
| 19 | UI/UX brief | Built | Tokens from the brief (`tailwind.config.ts`), Inter, 8-pt spacing, responsive, visible focus, reduced-motion, loading/empty/error/conflict/plan-limit/restricted states. **A Figma-style design file, clickable prototype and developer handover pack are not part of this repo.** |
| 20 | Engineering/testing | Partly | Isolation, access, billing, conflicts, SOP versioning, import idempotency, audit immutability are covered by `npm test`. Load/recovery targets are **not** defined or tested; backups of the SQLite file are the operator's responsibility (see README). |
| 21–22 | Charges, handover | n/a | Commercial sections of the document; not software. |

## Known limits you should decide on before launch
1. **Database:** SQLite (one node, one volume). Fine for hundreds of tenants; move to Postgres before horizontal scaling.
2. **Payments:** simulator only. **Email:** needs `RESEND_API_KEY` for verification/reset/invitation delivery; otherwise links are queued in the platform outbox.
3. **Scheduler:** in-process timers plus `POST /api/jobs`; use the latter from an external cron for multi-instance deployments.
4. **Legal text, GSTIN/invoice format, data-processing terms** need professional review.
5. Malware scanning of uploads is type/size/magic-byte only; add a scanner (e.g. ClamAV) if you accept arbitrary public uploads.
