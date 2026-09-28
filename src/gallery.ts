import { withHeadModel } from './alps/heads';
// Trait review: every head, pair of glasses, body and accessory tried on one plain Alp, built as a Mini
// bust and shown from three sides, so the 3D of each trait can be checked, marked and fixed in batches.
// Models are built in workers and drawn by one shared WebGL renderer, only as their tiles scroll into
// view. Only the review marks are stored (localStorage).
import { alpGrid, drawAlp, seedToParam, TRAITS, type AlpSeed } from './alps/alps';
import imageData from './alps/image-data.json';
import type { Model } from './core/build';
import type { Checks } from './core/check';
import { Marks, type Status } from './gallery/marks';
import { BuildPool } from './gallery/pool';
import { ThumbRenderer, VIEWS } from './gallery/thumbs';

/**
 * The plain Alp every trait is tried on: each tile swaps in the trait under review and keeps the rest.
 * Traits by file name (as in src/alps/image-data.json), the background by its name in TRAITS.
 */
export const NEUTRAL_ALP = {
  // a plain pale block: flat front, square sides, and nearly every pair of glasses shows up on it. (The
  // brick wall is boxier, but red glasses turn it brown: colours that touch are kept apart.) Only the
  // pearl and light grey glasses fade into it.
  head: 'head-pillow',
  glasses: 'glasses-noggles-black',  // the classic noggles, in black
  body: 'body-blue-grey',            // plain mid grey
  accessory: 'accessory-eth',        // a small diamond on the chest
  background: 'Cool',                // light grey-blue
} satisfies Record<keyof AlpSeed, string>;

/** Pixel size of each rendered view (square). */
const SHOT = 256;

type TraitKey = 'head' | 'glasses' | 'body' | 'accessory';
const FILES: Record<TraitKey, string[]> = {
  head: imageData.images.heads.map(i => i.filename),
  glasses: imageData.images.glasses.map(i => i.filename),
  body: imageData.images.bodies.map(i => i.filename),
  accessory: imageData.images.accessories.map(i => i.filename),
};
const NAMES = Object.fromEntries(TRAITS.map(t => [t.key, t.names])) as Record<keyof AlpSeed, string[]>;
const resolve = (k: keyof AlpSeed, v: string) => {
  const i = k === 'background' ? NAMES.background.indexOf(v) : FILES[k].indexOf(v);
  if (i < 0) throw new Error(`NEUTRAL_ALP.${k}: there's no ${k} called "${v}"`);
  return i;
};
const NEUTRAL = Object.fromEntries(Object.entries(NEUTRAL_ALP).map(([k, v]) => [k, resolve(k as keyof AlpSeed, v)])) as unknown as AlpSeed;

const SECTIONS: { key: TraitKey; id: string; title: string; families?: boolean }[] = [
  { key: 'head', id: 'heads', title: 'Heads' },
  { key: 'glasses', id: 'glasses', title: 'Glasses', families: true },   // grouped by the second word: noggles, skoggles…
  { key: 'body', id: 'bodies', title: 'Bodies' },
  { key: 'accessory', id: 'accessories', title: 'Accessories' },
];

interface Stats { pieces: number; checks: Checks; ms: number }
interface Tile {
  key: TraitKey; index: number; file: string; name: string; seed: AlpSeed;
  el: HTMLElement; sec: Section;
  state: 'idle' | 'building' | 'done' | 'error';
  drawn: boolean;
  stats?: Stats;
}
interface Group { el: HTMLElement; chip?: HTMLElement; tiles: Tile[] }
interface Section { key: TraitKey; id: string; title: string; el: HTMLElement; progress: HTMLElement; jump: HTMLAnchorElement; groups: Group[]; tiles: Tile[] }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const marks = new Marks();
const tiles: Tile[] = [];
const byEl = new WeakMap<Element, Tile>();
const sections: Section[] = [];
const link = (s: AlpSeed) => `./?seed=${seedToParam(s)}`;

// ---------- the plain Alp ----------
drawAlp($('neutral').querySelector('canvas')!, alpGrid(NEUTRAL));
$<HTMLAnchorElement>('neutral').href = link(NEUTRAL);
$('neutral-names').textContent = `${NAMES.head[NEUTRAL.head]} head, ${NAMES.glasses[NEUTRAL.glasses]} glasses, ${NAMES.body[NEUTRAL.body]} body, ${NAMES.accessory[NEUTRAL.accessory]} accessory, ${NAMES.background[NEUTRAL.background]} background`;

// ---------- tiles ----------
const tpl = document.createElement('template');
tpl.innerHTML = `<article class="tl">
  <div class="tl-hd">
    <canvas class="tl-alp" width="32" height="32"></canvas>
    <div class="tl-id"><h3></h3><small></small><p class="tl-stats">Waiting…</p></div>
  </div>
  <a class="tl-shots" target="_blank" rel="noopener">${VIEWS.map(v => `<figure><img alt="" decoding="async"><figcaption>${v.label}</figcaption></figure>`).join('')}</a>
  <div class="tl-rv">
    <div class="tl-marks">
      <button type="button" class="mk ok" data-mark="ok" aria-pressed="false">Looks right</button>
      <button type="button" class="mk bad" data-mark="bad" aria-pressed="false">Needs work</button>
    </div>
    <input class="tl-note" type="text" maxlength="280" placeholder="Note (optional)" autocomplete="off">
  </div>
</article>`;

function makeTile(sec: Section, index: number): Tile {
  const key = sec.key, file = FILES[key][index], name = NAMES[key][index];
  const el = (tpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
  const t: Tile = { key, index, file, name, seed: { ...NEUTRAL, [key]: index }, el, sec, state: 'idle', drawn: false };
  el.id = file;
  el.querySelector('h3')!.textContent = name;
  el.querySelector('small')!.textContent = `#${index} · ${file}`;
  const a = el.querySelector<HTMLAnchorElement>('.tl-shots')!;
  a.href = link(t.seed);
  a.title = `Open this Alp in Alps to Bricks (new tab)`;
  el.querySelector<HTMLInputElement>('.tl-note')!.setAttribute('aria-label', `Note for ${name}`);
  el.querySelector<HTMLInputElement>('.tl-note')!.value = marks.get(file)?.note ?? '';
  byEl.set(el, t);
  paintMark(t);
  return t;
}

const root = $('sections'), jumpNav = $('jump');
for (const s of SECTIONS) {
  const el = document.createElement('section');
  el.className = 'gl-sec'; el.id = s.id;
  el.innerHTML = `<div class="gl-sec-hd"><h2>${s.title} <span class="gl-n">${FILES[s.key].length}</span></h2><p class="gl-progress"></p></div>`;
  const jump = document.createElement('a');
  jump.href = `#${s.id}`; jump.dataset.sec = s.id;
  jump.innerHTML = `${s.title} <i>${FILES[s.key].length}</i>`;
  jumpNav.append(jump);
  const sec: Section = { key: s.key, id: s.id, title: s.title, el, progress: el.querySelector('.gl-progress')!, jump, groups: [], tiles: [] };
  const ids = FILES[s.key].map((_, i) => i);
  const families = s.families ? [...new Set(FILES[s.key].map(f => f.split('-')[1]))] : [null];
  if (s.families) {
    const chips = document.createElement('div'); chips.className = 'gl-fams';
    chips.innerHTML = families.map(f => `<a href="#${s.id}-${f}">${f}</a>`).join('');
    el.append(chips);
  }
  for (const f of families) {
    const members = ids.filter(i => f === null || FILES[s.key][i].split('-')[1] === f);
    const g = document.createElement('div');
    g.className = 'gl-group';
    if (f !== null) {
      g.id = `${s.id}-${f}`;
      g.innerHTML = `<h3 class="gl-fam">${f[0].toUpperCase()}${f.slice(1)} <span class="gl-n">${members.length}</span></h3>`;
    }
    const grid = document.createElement('div'); grid.className = 'gl-grid';
    const group: Group = { el: g, chip: f === null ? undefined : el.querySelector<HTMLElement>(`.gl-fams a[href="#${s.id}-${f}"]`)!, tiles: [] };
    for (const i of members) { const t = makeTile(sec, i); group.tiles.push(t); sec.tiles.push(t); tiles.push(t); grid.append(t.el); }
    g.append(grid); el.append(g);
    sec.groups.push(group);
  }
  root.append(el);
  sections.push(sec);
}

// ---------- building and rendering, as tiles come into view ----------
const pool = new BuildPool(Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1)));
const pending = new Set<Tile>();                       // in (or near) view, not built yet
const toRender: { t: Tile; model: Model; ms: number }[] = [];
let renderer: ThumbRenderer | null = null;
let renderFailed = false;

const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    const t = byEl.get(e.target)!;
    if (e.isIntersecting) {
      if (!t.drawn) { drawAlp(t.el.querySelector('canvas')!, alpGrid(t.seed)); t.drawn = true; }
      if (t.state === 'idle') pending.add(t);
    } else pending.delete(t);
  }
  pump();
}, { rootMargin: '400px 0px' });
tiles.forEach(t => io.observe(t.el));

/** The waiting tile closest to the screen: on screen first, top to bottom, left to right. */
function nearest(): Tile {
  const vh = innerHeight;
  let best: Tile | null = null, bd = Infinity, by = Infinity, bx = Infinity;
  for (const t of pending) {
    const r = t.el.getBoundingClientRect();
    const d = r.bottom < 0 ? -r.bottom : r.top > vh ? r.top - vh : 0;
    if (d < bd || (d === bd && (r.top < by || (r.top === by && r.left < bx)))) { best = t; bd = d; by = r.top; bx = r.left; }
  }
  return best!;
}

let loadingHeads = 0;
function pump() {
  // builds stay a few steps ahead of the renderer, no more, so a quick scroll doesn't queue up tiles long gone
  while (pending.size && pool.load + loadingHeads < pool.size && toRender.length < 4 && !renderFailed) {
    const t = nearest();
    pending.delete(t);
    t.state = 'building';
    setStatsText(t, 'Building…');
    loadingHeads++;
    withHeadModel(alpGrid(t.seed), t.seed).then(grid => {
      loadingHeads--;
      return pool.build({ size: 'mini', grid });
    }).then(r => {
      if (r.ok) { toRender.push({ t, model: r.model, ms: r.ms }); scheduleRender(); }
      else { t.state = 'error'; setStatsText(t, r.message, true); }
      pump();
    });
  }
}

let scheduled = false;
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(renderNext);
}

/** Render one tile per frame, so scrolling stays smooth. */
function renderNext() {
  scheduled = false;
  const job = toRender.shift();
  if (!job) return;
  const { t, model, ms } = job;
  try {
    renderer ??= new ThumbRenderer(SHOT);
    const strip = renderer.render(model);
    // the strip is copied now; the three <img>s share it, each showing its third
    strip.toBlob(b => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      t.el.querySelectorAll('img').forEach((img, i) => { img.src = url; img.alt = `${t.name}, ${VIEWS[i].label} view`; });
      t.el.classList.add('shot');
    }, 'image/webp', 0.9);
    t.state = 'done';
    t.stats = { pieces: model.pieces.length, checks: model.checks, ms };
    showStats(t);
  } catch (e) {
    t.state = 'error';
    renderFailed = !renderer;
    setStatsText(t, renderFailed ? 'This browser can’t draw 3D (WebGL).' : `Couldn’t render: ${(e as Error).message}`, true);
  }
  updateCounts();
  if (toRender.length) scheduleRender();
  pump();
}

function setStatsText(t: Tile, text: string, bad = false) {
  const p = t.el.querySelector<HTMLElement>('.tl-stats')!;
  p.textContent = text;
  p.classList.toggle('bad', bad);
}

const checksPass = (c: Checks) => !c.floating && !c.collisions && c.com.inside;
function showStats(t: Tile) {
  const { pieces, checks: c, ms } = t.stats!;
  const issues = [c.floating && `${c.floating} floating`, c.collisions && `${c.collisions} collision${c.collisions > 1 ? 's' : ''}`, !c.com.inside && 'off balance'].filter(Boolean);
  const p = t.el.querySelector<HTMLElement>('.tl-stats')!;
  p.classList.remove('bad');
  p.innerHTML = `${pieces} pieces · <span class="ck ${issues.length ? 'no' : 'yes'}">${issues.length ? `✗ ${issues.join(', ')}` : '✓ Checks pass'}</span>`;
  p.title = `${c.connections} stud connections · ${c.weak} held by a single stud · centre of mass ${c.com.margin} studs inside the base · built in ${Math.round(ms)} ms`;
}

// ---------- review marks ----------
function paintMark(t: Tile) {
  const st = marks.get(t.file)?.status;
  t.el.dataset.status = st ?? '';
  t.el.querySelectorAll<HTMLButtonElement>('.mk').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mark === st)));
}

root.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.mk');
  if (!b) return;
  const t = byEl.get(b.closest('.tl')!)!, want = b.dataset.mark as Status;
  marks.set(t.file, { status: marks.get(t.file)?.status === want ? null : want });
  paintMark(t);
  updateCounts();
  warnIfNotSaved();
});
const noteTimers = new WeakMap<Tile, number>();
root.addEventListener('input', e => {
  const input = e.target as HTMLInputElement;
  if (!input.classList.contains('tl-note')) return;
  const t = byEl.get(input.closest('.tl')!)!;
  clearTimeout(noteTimers.get(t));
  noteTimers.set(t, window.setTimeout(() => { marks.set(t.file, { note: input.value }); warnIfNotSaved(); }, 250));
});
root.addEventListener('change', e => {
  const input = e.target as HTMLInputElement;
  if (!input.classList.contains('tl-note')) return;
  const t = byEl.get(input.closest('.tl')!)!;
  clearTimeout(noteTimers.get(t));
  marks.set(t.file, { note: input.value });
  warnIfNotSaved();
});

let warned = false;
function warnIfNotSaved() {
  if (marks.saved || warned) return;
  warned = true;
  toast('This browser isn’t keeping your marks (private mode?). Download the JSON before you leave.', 6000);
}

function tally(list: Tile[]) {
  let ok = 0, bad = 0;
  for (const t of list) { const s = marks.get(t.file)?.status; if (s === 'ok') ok++; else if (s === 'bad') bad++; }
  return { ok, bad, left: list.length - ok - bad, total: list.length };
}

function updateCounts() {
  const all = tally(tiles);
  $('counts').innerHTML = `<b class="c-ok">✓ ${all.ok}</b> <span>look right</span> <b class="c-bad">✗ ${all.bad}</b> <span>need work</span> <b>${all.left}</b> <span>to go</span>`;
  for (const s of sections) {
    const c = tally(s.tiles);
    const failing = s.tiles.filter(t => t.stats && !checksPass(t.stats.checks)).length;
    s.progress.innerHTML = `<span class="c-ok">✓ ${c.ok}</span> · <span class="c-bad">✗ ${c.bad}</span> · ${c.left} to go${failing ? ` · <span class="c-bad">${failing} failing checks</span>` : ''}`;
  }
}

// ---------- filter ----------
type Mode = 'all' | 'unmarked' | 'bad';
let mode: Mode = 'all';
function applyFilter() {
  const q = $<HTMLInputElement>('filter').value.trim().toLowerCase();
  let any = false;
  for (const s of sections) {
    let shown = 0;
    for (const g of s.groups) {
      let n = 0;
      for (const t of g.tiles) {
        const st = marks.get(t.file)?.status;
        const show = (!q || t.name.toLowerCase().includes(q) || t.file.toLowerCase().includes(q))
          && (mode === 'all' || (mode === 'unmarked' ? !st : st === 'bad'));
        t.el.hidden = !show;
        if (show) n++;
      }
      g.el.hidden = !n;
      if (g.chip) g.chip.hidden = !n;
      shown += n;
    }
    s.el.hidden = !shown;
    s.jump.classList.toggle('none', !shown);
    s.jump.querySelector('i')!.textContent = q || mode !== 'all' ? `${shown}/${s.tiles.length}` : String(s.tiles.length);
    any ||= shown > 0;
  }
  $('empty').hidden = any;
  onScroll();
}
let filterTimer = 0;
$('filter').addEventListener('input', () => { clearTimeout(filterTimer); filterTimer = window.setTimeout(applyFilter, 120); });
document.querySelectorAll<HTMLButtonElement>('.gl-seg button').forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.mode as Mode;
  document.querySelectorAll<HTMLButtonElement>('.gl-seg button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  applyFilter();
}));

// the section on screen is lit in the jump bar
let scrollQueued = false, lit: Section | null = null;
function onScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    const line = $('bar').getBoundingClientRect().bottom + 48;
    let on: Section | null = null;
    for (const s of sections) if (!s.el.hidden && s.el.getBoundingClientRect().top <= line) on = s;
    for (const s of sections) s.jump.classList.toggle('on', s === on);
    // on a phone the jump links scroll sideways: keep the lit one in sight
    if (on && on !== lit) {
      const nav = jumpNav.getBoundingClientRect(), a = on.jump.getBoundingClientRect();
      if (a.left < nav.left || a.right > nav.right) jumpNav.scrollBy({ left: a.left - nav.left - 8, behavior: 'smooth' });
    }
    lit = on;
  });
}
addEventListener('scroll', onScroll, { passive: true });
// jump links land just below the sticky bar, whatever its height (one row on desktop, two on phones)
new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${$('bar').offsetHeight}px`)).observe($('bar'));

// ---------- export ----------
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const neutralText = () => (Object.keys(NEUTRAL_ALP) as (keyof AlpSeed)[]).map(k => `${k} ${NAMES[k][NEUTRAL[k]]}`).join(', ');

function reviewText(): string {
  const lines = [`Alps to Bricks: trait review, ${today()}`, `Each trait tried on: ${neutralText()} (Mini bust)`, ''];
  const all = tally(tiles);
  lines.push(`NEEDS WORK (${all.bad})`);
  for (const s of sections) {
    const bad = s.tiles.filter(t => marks.get(t.file)?.status === 'bad');
    if (!bad.length) continue;
    lines.push('', `${s.title} (${bad.length})`);
    for (const t of bad) {
      const note = marks.get(t.file)?.note?.trim();
      lines.push(`- ${t.name} [${t.file}, #${t.index}]${note ? `: ${note}` : ''}`);
    }
  }
  if (!all.bad) lines.push('(none yet)');
  lines.push('', `Looks right ${all.ok} · Needs work ${all.bad} · Unmarked ${all.left} · Total ${all.total}`);
  for (const s of sections) { const c = tally(s.tiles); lines.push(`${s.title}: ${c.ok} right, ${c.bad} need work, ${c.left} unmarked of ${c.total}`); }
  return lines.join('\n');
}

function reviewJSON() {
  return {
    app: 'Alps to Bricks trait review',
    generated: new Date().toISOString(),
    size: 'mini',
    neutral: { seed: NEUTRAL, param: seedToParam(NEUTRAL), traits: NEUTRAL_ALP },
    counts: Object.fromEntries([['all', tally(tiles)], ...sections.map(s => [s.id, tally(s.tiles)])]),
    marks: tiles.flatMap(t => {
      const m = marks.get(t.file);
      if (!m) return [];
      return [{
        trait: t.key, index: t.index, file: t.file, name: t.name,
        status: m.status ?? null, note: m.note?.trim() || null, markedAt: m.at ? new Date(m.at).toISOString() : null,
        seed: seedToParam(t.seed), url: new URL(link(t.seed), location.href).href,
        ...(t.stats ? { pieces: t.stats.pieces, checks: { floating: t.stats.checks.floating, collisions: t.stats.checks.collisions, balanced: t.stats.checks.com.inside } } : {}),
      }];
    }),
  };
}

async function copyText(s: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(s); return true; } catch { /* fall back below */ }
  const ta = document.createElement('textarea');
  ta.value = s; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

$('copy').addEventListener('click', async () => {
  const ok = await copyText(reviewText());
  toast(ok ? 'Review copied: every “Needs work” trait with its note, then the counts.' : 'Couldn’t copy here. Use Download JSON instead.');
});
$('download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(reviewJSON(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `alps-bricks-trait-review-${today()}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

let toastTimer = 0;
function toast(text: string, ms = 2600) {
  const el = $('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, ms);
}

updateCounts();
applyFilter();
// the sections are made here, after the browser looked for #heads etc., so jump to it now
if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
