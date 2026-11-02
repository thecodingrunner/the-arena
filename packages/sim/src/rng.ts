export function createRng(seed: number) {
  // Reject non-finite seeds, because ±Infinity makes the state stuck and turns the RNG into a constant.
  if (!Number.isFinite(seed))
    throw new Error("The seed needs to be a valid number");

  const roundedSeed = Math.round(seed);

  const generator = mulberry32(roundedSeed);

  return {
    next: generator,
    int: (min: number, max: number) => int(min, max, generator),
    chance: (p: number) => chance(p, generator),
    pick: <T>(arr: T[]) => pick(arr, generator),
    shuffle: <T>(arr: T[]) => shuffle(arr, generator),
  };
}

function mulberry32(seed: number) {
  let state = seed | 0;
  return function () {
    let t = (state += 0x6d2b79f5) | 0;
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

function shuffle<T>(arr: T[], generator: () => number): T[] {
  const arrCopy: T[] = [...arr];
  for (let i = arrCopy.length - 1; i > 0; i--) {
    const j = int(0, i, generator);
    [arrCopy[i], arrCopy[j]] = [arrCopy[j] as T, arrCopy[i] as T]; // safe: i and j are always within [0, length - 1]
  }
  return arrCopy;
}

export type Rng = ReturnType<typeof createRng>;
