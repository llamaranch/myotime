import type { Activity } from "./types";
import { uid } from "./storage";

let cache: Activity[] | null = null;
let loadingPromise: Promise<Activity[]> | null = null;

function parseCsv(text: string): Activity[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const out: Activity[] = [];
  // skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // simple CSV with optional quoted fields containing commas
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    if (fields.length < 3) continue;
    const [name, body_parts, types] = fields;
    out.push({
      id: uid(),
      name: name.trim(),
      body_parts: body_parts.split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
      types: types.split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
      source: "library",
    });
  }
  return out;
}

export async function loadLibrary(): Promise<Activity[]> {
  if (cache) return cache;
  if (loadingPromise) return loadingPromise;
  loadingPromise = fetch("/activities.csv")
    .then(r => r.text())
    .then(text => {
      cache = parseCsv(text);
      return cache;
    });
  return loadingPromise;
}

export function getCachedLibrary(): Activity[] {
  return cache ?? [];
}
