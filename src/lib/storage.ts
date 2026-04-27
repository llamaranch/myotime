import type { Workout, UserPreferences } from "./types";
import { DEFAULT_PREFS } from "./types";

const KEY_WORKOUTS = "myotime.workouts.v1";
const KEY_PREFS = "myotime.prefs.v1";

const isBrowser = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

export const storage = {
  getWorkouts(): Workout[] {
    if (!isBrowser()) return [];
    try {
      const raw = localStorage.getItem(KEY_WORKOUTS);
      return raw ? (JSON.parse(raw) as Workout[]) : [];
    } catch {
      return [];
    }
  },
  saveWorkouts(workouts: Workout[]) {
    if (!isBrowser()) return;
    localStorage.setItem(KEY_WORKOUTS, JSON.stringify(workouts));
  },
  upsertWorkout(workout: Workout) {
    const all = this.getWorkouts();
    const idx = all.findIndex(w => w.id === workout.id);
    if (idx >= 0) all[idx] = workout;
    else all.unshift(workout);
    this.saveWorkouts(all);
  },
  deleteWorkout(id: string) {
    this.saveWorkouts(this.getWorkouts().filter(w => w.id !== id));
  },
  getWorkout(id: string): Workout | undefined {
    return this.getWorkouts().find(w => w.id === id);
  },
  getPrefs(): UserPreferences {
    if (!isBrowser()) return DEFAULT_PREFS;
    try {
      const raw = localStorage.getItem(KEY_PREFS);
      if (!raw) return DEFAULT_PREFS;
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_PREFS;
    }
  },
  savePrefs(prefs: UserPreferences) {
    if (!isBrowser()) return;
    localStorage.setItem(KEY_PREFS, JSON.stringify(prefs));
  },
};

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
