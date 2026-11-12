import { vi } from 'vitest';
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set() {}, delete() {} }), headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u); }, notFound: () => { throw new Error('NOTFOUND'); } }));
vi.mock('next/cache', () => ({ revalidatePath() {} }));
vi.mock('next/dist/client/components/redirect-error', () => ({ isRedirectError: (e: any) => String(e?.message).startsWith('REDIRECT') }));
