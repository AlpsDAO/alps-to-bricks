// Review marks for the trait gallery, kept in this browser (localStorage) under one key, by trait file
// name (e.g. "head-wall"), so they survive the traits being reordered.
export type Status = 'ok' | 'bad';
export interface Mark { status?: Status; note?: string; at: number }

const KEY = 'alps-to-bricks:trait-review:v1';

export class Marks {
  private data: Record<string, Mark> = {};
  /** false once reading or writing localStorage has failed: marks then only last until the page closes */
  saved = true;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      const v = raw ? JSON.parse(raw) : null;
      if (v && typeof v === 'object') for (const [k, m] of Object.entries(v as Record<string, Partial<Mark>>)) {
        if (!m || typeof m !== 'object') continue;
        const status = m.status === 'ok' || m.status === 'bad' ? m.status : undefined;
        const note = typeof m.note === 'string' ? m.note : undefined;
        if (status || note) this.data[k] = { status, note, at: typeof m.at === 'number' ? m.at : 0 };
      }
    } catch { this.saved = false; }
  }

  get(file: string): Mark | undefined { return this.data[file]; }

  set(file: string, patch: { status?: Status | null; note?: string }) {
    const m: Mark = { ...this.data[file], at: Date.now() };
    if ('status' in patch) m.status = patch.status ?? undefined;
    if ('note' in patch) m.note = patch.note;
    if (!m.status) delete m.status;
    if (!m.note?.trim()) delete m.note;
    if (m.status || m.note) this.data[file] = m; else delete this.data[file];
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { this.saved = false; }
  }
}
