# Screen and route register

Generated from the application source (100 routes). "Needs" is the permission checked on the server; pages additionally filter data by role, sharing and teamspace.

| Area | Route | Type | Needs |
|---|---|---|---|
| API | `/api/health` | API | API key / session |
| API | `/api/jobs` | API | API key / session |
| API | `/api/v1/databases` | API | API key / session |
| API | `/api/v1/databases/[id]/records` | API | API key / session |
| API | `/api/v1/pages` | API | API key / session |
| API | `/api/v1/tasks` | API | API key / session |
| API | `/api/w/[slug]/export/all` | API | API key / session |
| API | `/api/w/[slug]/export/db/[id]` | API | API key / session |
| API | `/api/w/[slug]/export/page/[id]` | API | API key / session |
| API | `/api/w/[slug]/files` | API | API key / session |
| API | `/api/w/[slug]/files/[fid]` | API | API key / session |
| Account/Auth | `/account` | Screen | signed-in |
| Account/Auth | `/account/notifications` | Screen | signed-in |
| Account/Auth | `/account/profile` | Screen | signed-in |
| Account/Auth | `/account/security` | Screen | signed-in |
| Account/Auth | `/account/sessions` | Screen | signed-in |
| Account/Auth | `/denied` | Screen | signed-in |
| Account/Auth | `/invite/[token]` | Screen | signed-in |
| Account/Auth | `/login` | Screen | signed-in |
| Account/Auth | `/recover` | Screen | signed-in |
| Account/Auth | `/reset/[token]` | Screen | signed-in |
| Account/Auth | `/session-expired` | Screen | signed-in |
| Account/Auth | `/signup` | Screen | signed-in |
| Account/Auth | `/two-factor` | Screen | signed-in |
| Account/Auth | `/verify` | Screen | signed-in |
| Account/Auth | `/workspaces` | Screen | signed-in |
| Platform | `/platform` | Screen | platform staff |
| Platform | `/platform/audit` | Screen | platform staff |
| Platform | `/platform/billing` | Screen | platform staff |
| Platform | `/platform/businesses` | Screen | platform staff |
| Platform | `/platform/businesses/[id]` | Screen | platform staff |
| Platform | `/platform/businesses/[id]/content` | Screen | platform staff |
| Platform | `/platform/businesses/[id]/content/[pid]` | Screen | platform staff |
| Platform | `/platform/ops` | Screen | platform staff |
| Platform | `/platform/plans` | Screen | platform staff |
| Platform | `/platform/settings` | Screen | platform staff |
| Platform | `/platform/staff` | Screen | platform staff |
| Platform | `/platform/support` | Screen | platform staff |
| Public | `/` | Screen | anyone |
| Public | `/add-ons` | Screen | anyone |
| Public | `/contact` | Screen | anyone |
| Public | `/demo` | Screen | anyone |
| Public | `/features` | Screen | anyone |
| Public | `/help` | Screen | anyone |
| Public | `/help/[slug]` | Screen | anyone |
| Public | `/legal/[slug]` | Screen | anyone |
| Public | `/pricing` | Screen | anyone |
| Public | `/solutions` | Screen | anyone |
| Public | `/solutions/[slug]` | Screen | anyone |
| Public | `/trial` | Screen | anyone |
| Public | `/updates` | Screen | anyone |
| Public (token) | `/f/[token]` | Screen | anyone |
| Public (token) | `/s/[token]` | Screen | anyone |
| Public (token) | `/s/[token]/file/[fid]` | API | anyone |
| Workspace | `/w/[slug]` | Screen | signed-in member |
| Workspace | `/w/[slug]/admin/audit` | Screen | audit.view |
| Workspace | `/w/[slug]/admin/billing` | Screen | billing.manage |
| Workspace | `/w/[slug]/admin/billing/invoice/[iid]` | Screen | billing.manage |
| Workspace | `/w/[slug]/admin/export` | Screen | content.export |
| Workspace | `/w/[slug]/admin/members` | Screen | members.manage |
| Workspace | `/w/[slug]/admin/roles` | Screen | roles.manage |
| Workspace | `/w/[slug]/admin/settings` | Screen | workspace.configure |
| Workspace | `/w/[slug]/admin/sharing` | Screen | content.share |
| Workspace | `/w/[slug]/admin/support` | Screen | members.manage |
| Workspace | `/w/[slug]/admin/usage` | Screen | audit.view |
| Workspace | `/w/[slug]/automations` | Screen | signed-in member |
| Workspace | `/w/[slug]/automations/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/automations/new` | Screen | automation.manage |
| Workspace | `/w/[slug]/databases` | Screen | signed-in member |
| Workspace | `/w/[slug]/databases/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/databases/[id]/duplicates` | Screen | signed-in member |
| Workspace | `/w/[slug]/databases/[id]/import` | Screen | integrations.manage |
| Workspace | `/w/[slug]/databases/[id]/schema` | Screen | schema.manage |
| Workspace | `/w/[slug]/denied` | Screen | signed-in member |
| Workspace | `/w/[slug]/files` | Screen | signed-in member |
| Workspace | `/w/[slug]/forms` | Screen | signed-in member |
| Workspace | `/w/[slug]/forms/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/forms/new` | Screen | automation.manage |
| Workspace | `/w/[slug]/goals` | Screen | signed-in member |
| Workspace | `/w/[slug]/inbox` | Screen | signed-in member |
| Workspace | `/w/[slug]/integrations` | Screen | signed-in member |
| Workspace | `/w/[slug]/knowledge` | Screen | signed-in member |
| Workspace | `/w/[slug]/knowledge/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/meetings` | Screen | signed-in member |
| Workspace | `/w/[slug]/meetings/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/pages` | Screen | signed-in member |
| Workspace | `/w/[slug]/pages/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/pages/[id]/history` | Screen | signed-in member |
| Workspace | `/w/[slug]/projects` | Screen | signed-in member |
| Workspace | `/w/[slug]/projects/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/records/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/search` | Screen | signed-in member |
| Workspace | `/w/[slug]/tasks` | Screen | signed-in member |
| Workspace | `/w/[slug]/teamspaces` | Screen | signed-in member |
| Workspace | `/w/[slug]/teamspaces/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/templates` | Screen | signed-in member |
| Workspace | `/w/[slug]/templates/[id]` | Screen | signed-in member |
| Workspace | `/w/[slug]/templates/new` | Screen | schema.manage |
| Workspace | `/w/[slug]/trash` | Screen | signed-in member |
| Workspace | `/w/[slug]/welcome` | Screen | signed-in member |
