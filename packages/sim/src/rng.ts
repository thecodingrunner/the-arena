export function createRng(seed: number) {
  if (Number.isNaN(seed))
    throw new Error("The seed needs to be a valid number");

  seed = Math.round(seed);

  const generator = mulberry32(seed);

  return {
    next: generator,
    int: (min: number, max: number) => int(min, max, generator),
    chance: (p: number) => chance(p, generator),
    pick: <T>(arr: T[]) => pick(arr, generator),
  };
}

function mulberry32(seed: number) {
  let state = seed;
  return function () {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function int(min: number, max: number, generator: () => number) {
  if (!Number.isInteger(min) || !Number.isInteger(max))
    throw new Error("min and max need to be whole numbers");
  if (min > max) throw new Error("min needs to be less than or equal to max");

  return Math.floor(generator() * (max - min + 1)) + min;
}

function chance(p: number, generator: () => number) {
  if (Number.isNaN(p)) throw new Error("p needs to be a valid number");
  // The [0, 1) range clamps out-of-range p, and < (not <=) keeps chance(0) impossible
  return generator() < p;
}

function pick<T>(arr: T[], generator: () => number): T {
  if (arr.length === 0) throw new Error("arr needs to be non-empty");
  const index = int(0, arr.length - 1, generator);
  return arr[index] as T; // safe: arr is non-empty and index is in [0, length - 1]
}

export type Rng = ReturnType<typeof createRng>;
