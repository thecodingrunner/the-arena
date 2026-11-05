// Estimates active time spent in Claude Code sessions for this project, per day.
// It reads the timestamped session logs Claude Code keeps in ~/.claude/projects.
// This is a LOWER BOUND: time spent coding without messaging Claude isn't recorded.
//
// Usage: npm run time [-- --gap 15]
//   --gap  minutes of silence treated as a break (default 15)

import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const gapArg = process.argv.indexOf("--gap");
const gapMinutes = gapArg === -1 ? 15 : Number(process.argv[gapArg + 1]);
if (!Number.isFinite(gapMinutes) || gapMinutes <= 0) {
  throw new Error("--gap needs a positive number of minutes");
}

// Claude Code names each project's folder after its path, with every
// non-alphanumeric character replaced by "-" (drive letter case varies).
const projectsDir = join(homedir(), ".claude", "projects");
const slug = process
  .cwd()
  .replace(/[^a-zA-Z0-9]/g, "-")
  .toLowerCase();
const projectDir = readdirSync(projectsDir).find(
  (d) => d.toLowerCase() === slug,
);
if (!projectDir) {
  throw new Error(
    `No Claude Code logs found for this folder in ${projectsDir}`,
  );
}

const logDir = join(projectsDir, projectDir);
const timestamps = [];
for (const file of readdirSync(logDir).filter((f) => f.endsWith(".jsonl"))) {
  for (const line of readFileSync(join(logDir, file), "utf8").split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // a partially written last line
    }
    if (
      (entry.type === "user" || entry.type === "assistant") &&
      entry.timestamp
    ) {
      timestamps.push(Date.parse(entry.timestamp));
    }
  }
}
timestamps.sort((a, b) => a - b);

// Sum the gaps between consecutive messages, skipping gaps long enough to be a break.
// A gap is credited to the local date it started on.
const localDate = (ms) => new Date(ms).toLocaleDateString("en-CA"); // YYYY-MM-DD
const minutesByDay = new Map();
const gapMs = gapMinutes * 60_000;
for (let i = 1; i < timestamps.length; i++) {
  const gap = timestamps[i] - timestamps[i - 1];
  if (gap > gapMs) continue;
  const day = localDate(timestamps[i - 1]);
  minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + gap / 60_000);
}

const hours = (minutes) => (minutes / 60).toFixed(1).padStart(5);
let total = 0;
console.log(`Active Claude Code time (breaks = gaps over ${gapMinutes} min)\n`);
console.log("Date         Hours");
for (const [day, minutes] of [...minutesByDay].sort()) {
  total += minutes;
  console.log(`${day}  ${hours(minutes)}`);
}
console.log(`\nTotal       ${hours(total)}`);
