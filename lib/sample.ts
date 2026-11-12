// Sample content for new workspaces: a small, connected agency scenario built through the same services the UI uses.
import { ctxFor } from './svc/ctxfor';
import { createDatabase, addProp, createRecord, createView, dbProps } from './svc/data';
import { createPage } from './svc/pages';
import { createProject, addMilestone, createTask, createGoal } from './svc/work';
import { createSop, submitForReview, publish } from './svc/sop';
import { saveTemplate, createMeeting } from './svc/meet';
import { saveForm, saveAutomation, testAutomation, setAutomationActive } from './svc/auto';
import { one, run, all } from './db';
import { todayIn, addDays } from './dates';

export function seedSampleData(wsId: string, userId: string, teamspaceId: string | null, _roleIds?: Record<string, string>) {
  const c = ctxFor(userId, wsId); if (!c) return; const today = todayIn(c.ws.timezone);
  const clients = createDatabase(c, 'Clients', [
    { id: 'name', name: 'Client', type: 'text', title: true },
    { id: 'status', name: 'Status', type: 'select', options: [{ id: 'lead', name: 'Lead' }, { id: 'active', name: 'Active' }, { id: 'paused', name: 'Paused' }] },
    { id: 'owner', name: 'Account owner', type: 'people' }, { id: 'value', name: 'Annual value (INR)', type: 'number' }, { id: 'since', name: 'Client since', type: 'date' }, { id: 'email', name: 'Contact email', type: 'text' },
  ], teamspaceId);
  const c1 = createRecord(c, clients, { name: 'Acme Retail', status: 'active', owner: userId, value: 1200000, since: addDays(today, -200), email: 'ops@acme.example' });
  const c2 = createRecord(c, clients, { name: 'Brightwater Foods', status: 'active', owner: userId, value: 850000, since: addDays(today, -90) });
  createRecord(c, clients, { name: 'Cedar & Co', status: 'lead', owner: userId, value: 400000 });
  createRecord(c, clients, { name: 'Delta Logistics', status: 'paused', value: 300000, since: addDays(today, -400) });
  createRecord(c, clients, { name: 'Ember Studios', status: 'lead', owner: userId });
  const deliv = createDatabase(c, 'Deliverables', [
    { id: 'name', name: 'Deliverable', type: 'text', title: true },
    { id: 'stage', name: 'Stage', type: 'select', options: [{ id: 'todo', name: 'To do' }, { id: 'doing', name: 'In progress' }, { id: 'review', name: 'In review' }, { id: 'done', name: 'Done' }] },
    { id: 'due', name: 'Due', type: 'date' }, { id: 'fee', name: 'Fee (INR)', type: 'number' },
  ], teamspaceId);
  const relId = addProp(c, deliv, { name: 'Client', type: 'relation', relDb: clients });
  addProp(c, deliv, { name: 'Client status', type: 'lookup', relProp: relId, lookupProp: 'status' });
  addProp(c, clients, { name: 'Open deliverables', type: 'relation', relDb: deliv });
  const d1 = createRecord(c, deliv, { name: 'Brand audit', stage: 'doing', due: addDays(today, 6), fee: 90000, [relId]: [c1] });
  createRecord(c, deliv, { name: 'Website proposal', stage: 'review', due: addDays(today, 3), fee: 150000, [relId]: [c1] });
  createRecord(c, deliv, { name: 'Packaging concepts', stage: 'todo', due: addDays(today, 14), fee: 120000, [relId]: [c2] });
  createRecord(c, deliv, { name: 'Launch deck', stage: 'done', due: addDays(today, -5), fee: 60000, [relId]: [c2] });
  createView(c, deliv, 'Board by stage', 'board', { group: 'stage' }, true);
  createView(c, deliv, 'Calendar', 'calendar', { dateProp: 'due' }, true);
  createView(c, clients, 'Active clients', 'table', { filters: [{ prop: 'status', op: 'eq', value: 'active' }], sorts: [{ prop: 'value', dir: 'desc' }] }, true);
  const pid = createProject(c, { name: 'Acme website relaunch', description: 'Strategy, design and build of the new storefront.', start: addDays(today, -10), due: addDays(today, 45), record: c1 });
  addMilestone(c, pid, 'Discovery complete', addDays(today, 5)); addMilestone(c, pid, 'Design approved', addDays(today, 20)); addMilestone(c, pid, 'Launch', addDays(today, 45));
  const goal = createGoal(c, { title: 'Win three new retail clients this quarter', due: addDays(today, 60), mode: 'tasks' });
  createTask(c, { title: 'Send revised proposal to Acme', assignee: userId, due: addDays(today, 2), priority: 'high', project: pid, record: c1 });
  createTask(c, { title: 'Book discovery workshop', assignee: userId, due: addDays(today, 5), project: pid, goal });
  createTask(c, { title: 'Weekly status email', assignee: userId, due: addDays(today, 1), recur: { every: 'week' }, project: pid });
  createTask(c, { title: 'Pitch deck for Cedar & Co', assignee: userId, due: addDays(today, 9), goal });
  const welcome = createPage(c, { title: 'Start here: how we work', teamspaceId, body: [
    { type: 'h1', text: 'Welcome to the team workspace' } as any, { type: 'p', text: 'This is a sample page. Edit it, or delete it from the page menu.' } as any,
    { type: 'callout', text: 'Press / on an empty line to add headings, lists, tables, files and embeds.', tone: 'info' } as any, { type: 'h2', text: 'Where things live' } as any,
    { type: 'bullet', text: 'Clients and Deliverables databases hold our work, linked together.' } as any, { type: 'bullet', text: 'Knowledge → SOPs holds controlled procedures that need sign-off.' } as any, { type: 'todo', text: 'Invite your teammates', checked: false } as any, { type: 'todo', text: 'Read the onboarding SOP and acknowledge it', checked: false } as any ] });
  createPage(c, { title: 'Proposal - Acme website relaunch', teamspaceId, parentId: welcome, body: [ { type: 'h1', text: 'Website relaunch proposal' } as any, { type: 'p', text: 'Scope, timeline and fees for the new storefront.' } as any, { type: 'table', rows: [['Phase', 'Weeks', 'Fee (INR)'], ['Discovery', '2', '90,000'], ['Design', '4', '2,40,000'], ['Build', '6', '3,60,000']], header: true } as any ] });
  const sop = createSop(c, { title: 'Client onboarding checklist', teamspaceId, reviewDays: 180, templateBody: [ { type: 'h2', text: 'Purpose' }, { type: 'p', text: 'Make every new client feel looked after in their first two weeks.' }, { type: 'h2', text: 'Steps' }, { type: 'number', text: 'Send the welcome email within one business day.' }, { type: 'number', text: 'Create the client record and project in the workspace.' }, { type: 'number', text: 'Hold a 30-minute kickoff and record decisions.' }, { type: 'number', text: 'Share the project page with the client as a guest.' } ] as any });
  submitForReview(c, sop, 'Initial version'); run('UPDATE pages SET updated_by=NULL WHERE id=(SELECT page_id FROM sops WHERE id=?)', sop); /* seeded content is system-authored, so the four-eyes rule is satisfied */ publish(c, sop, { changeNote: 'First published version' });
  saveTemplate(c, { name: 'Client proposal', kind: 'page', description: 'Scope, timeline and fees', payload: { title: 'Proposal - ', body: [ { type: 'h1', text: 'Proposal' }, { type: 'h2', text: 'Scope' }, { type: 'bullet', text: '' }, { type: 'h2', text: 'Timeline' }, { type: 'p', text: '' }, { type: 'h2', text: 'Fees' }, { type: 'table', rows: [['Item', 'Fee (INR)'], ['', '']], header: true } ] } });
  const wt = saveTemplate(c, { name: 'Weekly sync', kind: 'meeting', description: '30-minute team check-in', payload: { title: 'Weekly sync', agenda: ['Wins since last week', 'Blockers', 'Priorities this week'], body: [ { type: 'h2', text: 'Notes' }, { type: 'p', text: '' }, { type: 'h2', text: 'Decisions' }, { type: 'p', text: '' } ] } });
  saveTemplate(c, { name: 'Client list', kind: 'database', description: 'Clients with status and owner', payload: { name: 'Clients', props: dbProps(one<any>('SELECT * FROM databases WHERE id=?', clients)).filter(p => p.type === 'text' || p.type === 'select' || p.type === 'number' || p.type === 'date') } });
  createMeeting(c, { title: 'Weekly sync', date: addDays(today, 1), time: '10:00', minutes: 30, templateId: wt });
  const props = dbProps(one<any>('SELECT * FROM databases WHERE id=?', clients));
  saveForm(c, { name: 'Client intake', dbId: clients, fields: [{ prop: 'name', label: 'Company name', required: true }, { prop: 'email', label: 'Contact email', required: false }, { prop: 'value', label: 'Rough yearly budget (INR)', required: false }], isPublic: false, active: true, success: 'Thanks - we will be in touch.' });
  const au = saveAutomation(c, { name: 'Onboarding task for new active clients', event: 'record.updated', db: clients, conditions: [{ prop: 'status', op: 'eq', value: 'active' }], actions: [{ type: 'create_task', title: 'Run the client onboarding checklist', assignee: userId }] });
  try { testAutomation(c, au); } catch {}
  run('UPDATE workspaces SET setup=? WHERE id=?', JSON.stringify({}), wsId);
}
