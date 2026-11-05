// SQLite store (node:sqlite). Loaded via process.getBuiltinModule so bundlers never touch it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SCHEMA } from './schema';
import { ensureBase } from './bootstrap';

type Row = Record<string, any>;
let _db: any;

export function id(prefix = ''): string {
  return prefix + crypto.randomBytes(12).toString('base64url');
}
export const now = () => new Date().toISOString();

export function db() {
  if (_db) return _db;
  const sqlite = (process as any).getBuiltinModule('node:sqlite');
  const file = process.env.DATABASE_FILE || path.join(process.cwd(), 'data', 'app.db');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  _db = new sqlite.DatabaseSync(file);
  _db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  _db.exec(SCHEMA);
  ensureBase();
  return _db;
}

export function resetDbForTests() { _db = undefined; }

export function all<T = Row>(sql: string, ...p: any[]): T[] {
  return db().prepare(sql).all(...p) as T[];
}
export function one<T = Row>(sql: string, ...p: any[]): T | undefined {
  return db().prepare(sql).get(...p) as T | undefined;
}
export function run(sql: string, ...p: any[]) {
  return db().prepare(sql).run(...p);
}
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec('BEGIN IMMEDIATE');
  try { const r = fn(); d.exec('COMMIT'); return r; } catch (e) { d.exec('ROLLBACK'); throw e; }
}
export function insert(table: string, row: Row) {
  const keys = Object.keys(row);
  run(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, ...keys.map(k => ser(row[k])));
  return row;
}
export function update(table: string, idv: string, ws: string | null, patch: Row) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const wsClause = ws ? ' AND ws=?' : '';
  run(`UPDATE ${table} SET ${keys.map(k => k + '=?').join(',')} WHERE id=?${wsClause}`, ...keys.map(k => ser(patch[k])), idv, ...(ws ? [ws] : []));
}
function ser(v: any) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}
export function J<T = any>(s: any, fallback: T): T {
  if (s == null || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}
