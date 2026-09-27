// A few copies of the site's build worker, so models are built off the main thread, several at a time.
import type { BuildReply, BuildRequest } from '../worker/build.worker';

type Job = { req: Omit<BuildRequest, 'id'>; done: (r: BuildReply) => void };

export class BuildPool {
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private running = new Map<Worker, { id: number; done: (r: BuildReply) => void }>();
  private nextId = 1;

  constructor(readonly size: number) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('../worker/build.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<BuildReply>) => this.finish(w, e.data);
      w.onerror = e => {
        e.preventDefault();
        const job = this.running.get(w);
        if (job) this.finish(w, { id: job.id, ok: false, code: 'error', message: `The build worker failed: ${e.message}` });
      };
      this.idle.push(w);
    }
  }

  /** Jobs running or waiting */
  get load() { return this.running.size + this.queue.length; }

  build(req: Omit<BuildRequest, 'id'>): Promise<BuildReply> {
    return new Promise(done => { this.queue.push({ req, done }); this.pump(); });
  }

  private finish(w: Worker, r: BuildReply) {
    const job = this.running.get(w);
    this.running.delete(w);
    this.idle.push(w);
    job?.done(r);
    this.pump();
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!, { req, done } = this.queue.shift()!, id = this.nextId++;
      this.running.set(w, { id, done });
      w.postMessage({ ...req, id } satisfies BuildRequest);
    }
  }
}
