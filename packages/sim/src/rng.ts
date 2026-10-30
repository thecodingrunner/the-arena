export function createRng(seed: number) {
  if (Number.isNaN(seed))
    throw new Error("The seed needs to be a valid number");

  seed = Math.round(seed);

  return { next: mulberry32(seed) };
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
