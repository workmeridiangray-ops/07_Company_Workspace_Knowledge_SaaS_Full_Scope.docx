export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pw_hash TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0, verify_code TEXT, totp_secret TEXT, totp_enabled INTEGER DEFAULT 0,
  platform_role TEXT, suspended INTEGER DEFAULT 0, notif_prefs TEXT DEFAULT '{}', title TEXT DEFAULT '',
  timezone TEXT DEFAULT 'Asia/Kolkata', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT UNIQUE NOT NULL,
  created_at TEXT, last_seen TEXT, expires_at TEXT NOT NULL, ua TEXT, ip TEXT, revoked INTEGER DEFAULT 0, pending_2fa INTEGER DEFAULT 0, ws_id TEXT);
CREATE TABLE IF NOT EXISTS reset_tokens(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS plans(
  id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, price_month INTEGER NOT NULL, price_year INTEGER NOT NULL,
  limits TEXT NOT NULL, features TEXT DEFAULT '[]', version INTEGER DEFAULT 1, effective_from TEXT NOT NULL, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS workspaces(
  id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'trial',
  trial_ends TEXT, timezone TEXT DEFAULT 'Asia/Kolkata', branding TEXT DEFAULT '{}', billing TEXT DEFAULT '{}',
  setup TEXT DEFAULT '{}', created_at TEXT NOT NULL, closed_at TEXT, close_reason TEXT);
CREATE TABLE IF NOT EXISTS roles(id TEXT PRIMARY KEY, ws TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, perms TEXT NOT NULL, builtin INTEGER DEFAULT 0, UNIQUE(ws,name));
CREATE TABLE IF NOT EXISTS memberships(
  id TEXT PRIMARY KEY, ws TEXT NOT NULL REFERENCES workspaces(id), user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id), status TEXT DEFAULT 'active', is_guest INTEGER DEFAULT 0, created_at TEXT, UNIQUE(ws,user_id));
CREATE TABLE IF NOT EXISTS invitations(
  id TEXT PRIMARY KEY, ws TEXT NOT NULL, email TEXT NOT NULL, role_id TEXT NOT NULL, is_guest INTEGER DEFAULT 0, token_hash TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', expires_at TEXT NOT NULL, invited_by TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS subscriptions(
  id TEXT PRIMARY KEY, ws TEXT NOT NULL UNIQUE, plan_id TEXT NOT NULL, plan_version INTEGER, interval TEXT DEFAULT 'month',
  status TEXT NOT NULL, period_start TEXT, period_end TEXT, grace_until TEXT, cancel_at_period_end INTEGER DEFAULT 0, coupon TEXT, seats_extra INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS invoices(
  id TEXT PRIMARY KEY, ws TEXT NOT NULL, number TEXT UNIQUE NOT NULL, description TEXT, amount INTEGER NOT NULL, tax INTEGER NOT NULL,
  status TEXT NOT NULL, plan_code TEXT, plan_version INTEGER, issued_at TEXT NOT NULL, reference TEXT);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY, ws TEXT NOT NULL, invoice_id TEXT, amount INTEGER, status TEXT, provider TEXT, reference TEXT, failure TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS payment_methods(id TEXT PRIMARY KEY, ws TEXT NOT NULL, brand TEXT, last4 TEXT, exp TEXT, is_default INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS coupons(id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, percent INTEGER NOT NULL, active INTEGER DEFAULT 1, uses INTEGER DEFAULT 0, max_uses INTEGER);
CREATE TABLE IF NOT EXISTS adjustments(id TEXT PRIMARY KEY, ws TEXT NOT NULL, invoice_id TEXT, kind TEXT, amount INTEGER, reason TEXT NOT NULL, by_user TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS audit_log(
  id TEXT PRIMARY KEY, ws TEXT, actor TEXT, actor_label TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT, detail TEXT, created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'audit log is append-only'); END;
CREATE TABLE IF NOT EXISTS announcements(id TEXT PRIMARY KEY, ws TEXT, title TEXT NOT NULL, body TEXT, author TEXT, created_at TEXT, pinned INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS support_access(id TEXT PRIMARY KEY, ws TEXT NOT NULL, staff_user TEXT NOT NULL, reason TEXT NOT NULL, status TEXT DEFAULT 'requested', expires_at TEXT, decided_by TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS support_tickets(id TEXT PRIMARY KEY, ws TEXT, subject TEXT NOT NULL, body TEXT, status TEXT DEFAULT 'open', priority TEXT DEFAULT 'normal', created_by TEXT, assigned_to TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS incidents(id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT DEFAULT 'investigating', severity TEXT DEFAULT 'minor', body TEXT, created_at TEXT, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS jobs(
  id TEXT PRIMARY KEY, ws TEXT, kind TEXT NOT NULL, payload TEXT, status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 5,
  error TEXT, dedupe_key TEXT UNIQUE, run_after TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, to_email TEXT NOT NULL, subject TEXT, body TEXT, status TEXT DEFAULT 'queued', error TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS idempotency(key TEXT PRIMARY KEY, ws TEXT NOT NULL, result TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS teamspaces(id TEXT PRIMARY KEY, ws TEXT NOT NULL, name TEXT NOT NULL, description TEXT, icon TEXT DEFAULT 'folder', visibility TEXT DEFAULT 'open', archived INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS teamspace_members(teamspace_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(teamspace_id,user_id));
CREATE TABLE IF NOT EXISTS pages(
  id TEXT PRIMARY KEY, ws TEXT NOT NULL, teamspace_id TEXT, parent_id TEXT, title TEXT NOT NULL DEFAULT 'Untitled', icon TEXT, body TEXT NOT NULL DEFAULT '[]',
  kind TEXT DEFAULT 'page', owner TEXT, visibility TEXT DEFAULT 'workspace', is_draft INTEGER DEFAULT 0, version INTEGER DEFAULT 1, archived INTEGER DEFAULT 0,
  deleted_at TEXT, created_at TEXT, updated_at TEXT, updated_by TEXT, record_id TEXT);
CREATE INDEX IF NOT EXISTS pages_ws ON pages(ws, deleted_at);
CREATE TABLE IF NOT EXISTS page_versions(id TEXT PRIMARY KEY, ws TEXT NOT NULL, page_id TEXT NOT NULL, version INTEGER, title TEXT, body TEXT, by_user TEXT, created_at TEXT, label TEXT);
CREATE TABLE IF NOT EXISTS favourites(user_id TEXT, ws TEXT, page_id TEXT, PRIMARY KEY(user_id,page_id));
CREATE TABLE IF NOT EXISTS recents(user_id TEXT, ws TEXT, resource_type TEXT, resource_id TEXT, at TEXT, PRIMARY KEY(user_id,resource_type,resource_id));
CREATE TABLE IF NOT EXISTS databases(id TEXT PRIMARY KEY, ws TEXT NOT NULL, teamspace_id TEXT, name TEXT NOT NULL, icon TEXT, props TEXT NOT NULL, visibility TEXT DEFAULT 'workspace', archived INTEGER DEFAULT 0, owner TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS records(
  id TEXT PRIMARY KEY, ws TEXT NOT NULL, db_id TEXT NOT NULL REFERENCES databases(id), data TEXT NOT NULL DEFAULT '{}', body TEXT DEFAULT '[]',
  owner TEXT, version INTEGER DEFAULT 1, archived INTEGER DEFAULT 0, deleted_at TEXT, created_at TEXT, updated_at TEXT);
CREATE INDEX IF NOT EXISTS records_db ON records(ws, db_id, deleted_at);
CREATE TABLE IF NOT EXISTS views(id TEXT PRIMARY KEY, ws TEXT NOT NULL, db_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, config TEXT DEFAULT '{}', shared INTEGER DEFAULT 1, owner TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, ws TEXT NOT NULL, name TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'active', owner TEXT, start_date TEXT, due_date TEXT, record_id TEXT, page_id TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS milestones(id TEXT PRIMARY KEY, ws TEXT NOT NULL, project_id TEXT NOT NULL, name TEXT NOT NULL, due_date TEXT, done INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS goals(id TEXT PRIMARY KEY, ws TEXT NOT NULL, title TEXT NOT NULL, owner TEXT, due_date TEXT, mode TEXT DEFAULT 'tasks', target REAL DEFAULT 100, current REAL DEFAULT 0, status TEXT DEFAULT 'on_track', confirmed INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS tasks(
  id TEXT PRIMARY KEY, ws TEXT NOT NULL, title TEXT NOT NULL, status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium', assignee TEXT, due_date TEXT,
  project_id TEXT, milestone_id TEXT, goal_id TEXT, page_id TEXT, record_id TEXT, depends_on TEXT, blocked_reason TEXT, recur TEXT, source_task TEXT,
  created_by TEXT, completed_at TEXT, created_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS sops(
  id TEXT PRIMARY KEY, ws TEXT NOT NULL, page_id TEXT NOT NULL UNIQUE, owner TEXT, audience TEXT DEFAULT 'all', state TEXT DEFAULT 'draft', version INTEGER DEFAULT 1,
  published_version INTEGER, effective_from TEXT, review_due TEXT, review_note TEXT, requires_ack INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS sop_versions(id TEXT PRIMARY KEY, ws TEXT NOT NULL, sop_id TEXT NOT NULL, version INTEGER, title TEXT, body TEXT, state TEXT, effective_from TEXT, published_at TEXT, retired_at TEXT, by_user TEXT, change_note TEXT);
CREATE TABLE IF NOT EXISTS sop_acks(id TEXT PRIMARY KEY, ws TEXT NOT NULL, sop_id TEXT NOT NULL, version INTEGER, user_id TEXT NOT NULL, at TEXT, UNIQUE(sop_id,version,user_id));
CREATE TABLE IF NOT EXISTS meetings(id TEXT PRIMARY KEY, ws TEXT NOT NULL, title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT, location TEXT, organizer TEXT, attendees TEXT DEFAULT '[]', agenda TEXT DEFAULT '[]', notes TEXT DEFAULT '', status TEXT DEFAULT 'scheduled', project_id TEXT, page_id TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS decisions(id TEXT PRIMARY KEY, ws TEXT NOT NULL, meeting_id TEXT, text TEXT NOT NULL, owner TEXT, decided_on TEXT, related_type TEXT, related_id TEXT, sop_ref TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS templates(id TEXT PRIMARY KEY, ws TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, description TEXT, payload TEXT NOT NULL, version INTEGER DEFAULT 1, updated_at TEXT, created_by TEXT);
CREATE TABLE IF NOT EXISTS template_versions(id TEXT PRIMARY KEY, ws TEXT NOT NULL, template_id TEXT NOT NULL, version INTEGER, name TEXT, payload TEXT, created_at TEXT, UNIQUE(template_id,version));
CREATE TABLE IF NOT EXISTS template_uses(id TEXT PRIMARY KEY, ws TEXT NOT NULL, template_id TEXT, template_version INTEGER, resource_type TEXT, resource_id TEXT, at TEXT, by_user TEXT);
CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, ws TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, parent_id TEXT, author TEXT NOT NULL, body TEXT NOT NULL, resolved INTEGER DEFAULT 0, created_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, ws TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT, resource_type TEXT, resource_id TEXT, actor TEXT, read INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS shares(id TEXT PRIMARY KEY, ws TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, user_id TEXT NOT NULL, level TEXT NOT NULL, by_user TEXT, expires_at TEXT, created_at TEXT, UNIQUE(resource_type,resource_id,user_id));
CREATE TABLE IF NOT EXISTS share_links(id TEXT PRIMARY KEY, ws TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, token TEXT UNIQUE NOT NULL, level TEXT DEFAULT 'view', expires_at TEXT, allow_download INTEGER DEFAULT 0, revoked INTEGER DEFAULT 0, is_public INTEGER DEFAULT 0, reviewed_by TEXT, created_by TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS access_requests(id TEXT PRIMARY KEY, ws TEXT NOT NULL, resource_type TEXT, resource_id TEXT, user_id TEXT, message TEXT, status TEXT DEFAULT 'pending', decided_by TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, ws TEXT NOT NULL, name TEXT NOT NULL, mime TEXT, size INTEGER, data BLOB, owner TEXT, page_id TEXT, record_id TEXT, created_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS forms(id TEXT PRIMARY KEY, ws TEXT NOT NULL, name TEXT NOT NULL, db_id TEXT NOT NULL, fields TEXT NOT NULL, is_public INTEGER DEFAULT 0, token TEXT UNIQUE, active INTEGER DEFAULT 1, success_message TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS form_submissions(id TEXT PRIMARY KEY, ws TEXT NOT NULL, form_id TEXT NOT NULL, data TEXT, record_id TEXT, dedupe_key TEXT, created_at TEXT, UNIQUE(form_id,dedupe_key));
CREATE TABLE IF NOT EXISTS automations(id TEXT PRIMARY KEY, ws TEXT NOT NULL, name TEXT NOT NULL, trigger TEXT NOT NULL, conditions TEXT DEFAULT '[]', actions TEXT NOT NULL, active INTEGER DEFAULT 0, tested INTEGER DEFAULT 0, last_run TEXT, runs INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS automation_runs(id TEXT PRIMARY KEY, ws TEXT NOT NULL, automation_id TEXT, status TEXT, detail TEXT, depth INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS api_keys(id TEXT PRIMARY KEY, ws TEXT NOT NULL, name TEXT NOT NULL, prefix TEXT NOT NULL, key_hash TEXT UNIQUE NOT NULL, scopes TEXT DEFAULT 'read', created_by TEXT, created_at TEXT, last_used TEXT, revoked INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS webhooks(id TEXT PRIMARY KEY, ws TEXT NOT NULL, url TEXT NOT NULL, events TEXT DEFAULT '[]', secret TEXT, active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS webhook_logs(id TEXT PRIMARY KEY, ws TEXT NOT NULL, webhook_id TEXT, event TEXT, status TEXT, attempts INTEGER DEFAULT 0, response TEXT, dedupe_key TEXT, created_at TEXT, UNIQUE(webhook_id,dedupe_key));
CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY, ws TEXT NOT NULL, provider TEXT NOT NULL, objects TEXT, direction TEXT, schedule TEXT, source_of_truth TEXT, failure_owner TEXT, status TEXT DEFAULT 'configured', last_sync TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS sync_history(id TEXT PRIMARY KEY, ws TEXT NOT NULL, connection_id TEXT, status TEXT, detail TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY, ws TEXT NOT NULL, db_id TEXT, filename TEXT, status TEXT, total INTEGER, ok INTEGER, errors TEXT, batch_key TEXT UNIQUE, by_user TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS exports(id TEXT PRIMARY KEY, ws TEXT NOT NULL, kind TEXT, status TEXT, by_user TEXT, created_at TEXT, size INTEGER);
CREATE TABLE IF NOT EXISTS saved_searches(id TEXT PRIMARY KEY, ws TEXT NOT NULL, user_id TEXT, name TEXT, query TEXT);
`;
