export type BodyPart = "arms" | "legs" | "core" | "back" | "chest" | "full body" | "other";
export type ActivityType =
  | "mobility" | "cardio" | "resistance" | "isometric"
  | "calisthenics" | "yoga" | "other";

export interface Activity {
  id: string;
  name: string;
  body_parts: string[];
  types: string[];
  source: "library" | "custom";
}

export interface WorkoutActivity {
  id: string;
  name: string;
  duration_seconds: number;
  source: "library" | "custom";
}

export interface Workout {
  id: string;
  name: string;
  activities: WorkoutActivity[];
  created_at: number;
  updated_at: number;
}

export interface UserPreferences {
  favorites: string[]; // activity names (lowercased) — name-based for stability across library/custom
  custom_activities: Activity[];
  beep_volume: number;
  beep_muted: boolean;
  voice_volume: number;
  voice_muted: boolean;
  preferred_voice: string | null;
}

export const DEFAULT_PREFS: UserPreferences = {
  favorites: ["rest"],
  custom_activities: [],
  beep_volume: 70,
  beep_muted: false,
  voice_volume: 70,
  voice_muted: false,
  preferred_voice: null,
};

export const BODY_PARTS: BodyPart[] = ["arms", "legs", "core", "back", "chest", "full body", "other"];
export const ACTIVITY_TYPES: ActivityType[] = ["mobility", "cardio", "resistance", "isometric", "calisthenics", "yoga", "other"];
