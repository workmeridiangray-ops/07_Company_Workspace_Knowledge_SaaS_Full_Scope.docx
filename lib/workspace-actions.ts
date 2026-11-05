'use server';
import { requireUser } from './ctx';
import { guard, str, need } from './action';
import { createWorkspace } from './svc/core';
import type { ActionResult } from '@/components/ActionForm';
export async function createWorkspaceAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const s = await requireUser(); const name = need(str(fd, 'name', 80), 'Enter a business name.');
    const w = createWorkspace({ id: s.user.id, name: s.user.name }, name); return { ok: true, redirect: `/w/${w.slug}/welcome` };
  });
}
