import seeds from '../src/alps/seeds.json';
import { alpGrid, type AlpSeed } from '../src/alps/alps';

const seedOf = (s: number[]): AlpSeed => ({ background: s[0], body: s[1], accessory: s[2], head: s[3], glasses: s[4] });

/** Alp #id's pixel grid, from the seeds that ship with the site */
export const alp = (id: number) => alpGrid(seedOf((seeds as Record<string, number[]>)[id]));

export const ALPS = Object.keys(seeds).map(Number).sort((a, b) => a - b).map(id => ({ id, grid: alp(id) }));
