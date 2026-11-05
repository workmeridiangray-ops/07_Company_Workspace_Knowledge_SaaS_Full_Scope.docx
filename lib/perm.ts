// Permissions catalogue and role helpers. Enforced on the server for every read/write.
export const PERMS = {
  'content.view': 'View content they can access',
  'content.create': 'Create pages, records and tasks',
  'content.edit': 'Edit content',
  'content.delete': 'Move content to trash',
  'content.share': 'Share, create links and invite guests',
  'content.export': 'Export pages, records and files',
  'content.approve': 'Approve and publish controlled SOPs',
  'content.assign': 'Assign tasks to others',
  'schema.manage': 'Change database schema and views',
  'automation.manage': 'Manage forms, automations and webhooks',
  'integrations.manage': 'Manage connections, imports and API keys',
  'members.manage': 'Invite, suspend and change members',
  'roles.manage': 'Edit roles and sensitive permissions',
  'billing.manage': 'Manage plan, payment methods and invoices',
  'audit.view': 'View audit trail and usage',
  'workspace.configure': 'Configure branding, setup and closure',
} as const;
export type Perm = keyof typeof PERMS;
export const SENSITIVE: Perm[] = ['content.export', 'roles.manage', 'billing.manage', 'members.manage', 'workspace.configure', 'content.approve', 'integrations.manage'];
const ALL = Object.keys(PERMS) as Perm[];
export const BUILTIN_ROLES: Record<string, Perm[]> = {
  Owner: ALL,
  Admin: ALL.filter(p => p !== 'billing.manage' && p !== 'workspace.configure'),
  Manager: ['content.view', 'content.create', 'content.edit', 'content.delete', 'content.share', 'content.export', 'content.approve', 'content.assign', 'schema.manage', 'automation.manage', 'audit.view'],
  Member: ['content.view', 'content.create', 'content.edit', 'content.delete', 'content.share'],
  Guest: ['content.view'],
};
export const PLATFORM_ROLES = {
  owner: 'Platform owner', billing: 'Platform billing', support: 'Platform support', ops: 'Technical operations',
} as const;
export const PLATFORM_PERMS: Record<string, string[]> = {
  owner: ['overview', 'businesses', 'billing', 'support', 'ops', 'staff', 'audit', 'settings', 'plans', 'announce'],
  billing: ['overview', 'businesses', 'billing', 'plans', 'audit'],
  support: ['overview', 'businesses', 'support', 'audit'],
  ops: ['overview', 'ops', 'audit', 'businesses'],
};
