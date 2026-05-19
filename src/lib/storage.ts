import type { Workout, WorkoutActivity, UserSettings, Activity, Favorite } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { supabase } from "@/integrations/supabase/client";

export const MAX_WORKOUTS = 100;
export const MAX_ACTIVITIES_PER_WORKOUT = 100;
export const MAX_CUSTOM_ACTIVITIES = 100;

export const storage = {
  async getWorkouts(): Promise<Workout[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];
      const { data: workoutRows, error } = await supabase
        .from("workouts")
        .select("id, name, sort_order, created_at")
        .eq("user_id", session.user.id)
        .order("sort_order", { ascending: true });
      if (error || !workoutRows) return [];
      const results: Workout[] = [];
      for (const w of workoutRows) {
        const { data: actRows } = await supabase
          .from("workout_activities")
          .select("id, name, duration_seconds, sort_order")
          .eq("workout_id", w.id)
          .order("sort_order", { ascending: true });
        const createdMs = Date.parse(w.created_at);
        results.push({
          id: w.id,
          name: w.name,
          order: w.sort_order,
          created_at: createdMs,
          updated_at: createdMs,
          activities: (actRows ?? []).map((a): WorkoutActivity => ({
            id: a.id,
            name: a.name,
            duration_seconds: a.duration_seconds,
          })),
        });
      }
      return results;
    } catch {
      return [];
    }
  },
  async getWorkout(id: string): Promise<Workout | undefined> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return undefined;
      const { data: w, error } = await supabase
        .from("workouts")
        .select("id, name, sort_order, created_at")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error || !w) return undefined;
      const { data: actRows } = await supabase
        .from("workout_activities")
        .select("id, name, duration_seconds, sort_order")
        .eq("workout_id", id)
        .order("sort_order", { ascending: true });
      const createdMs = Date.parse(w.created_at);
      return {
        id: w.id,
        name: w.name,
        order: w.sort_order,
        created_at: createdMs,
        updated_at: createdMs,
        activities: (actRows ?? []).map((a): WorkoutActivity => ({
          id: a.id,
          name: a.name,
          duration_seconds: a.duration_seconds,
        })),
      };
    } catch {
      return undefined;
    }
  },
  async upsertWorkout(workout: Workout): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      let order = workout.order;
      if (typeof order !== "number") {
        const { data: maxRow } = await supabase
          .from("workouts")
          .select("sort_order")
          .eq("user_id", session.user.id)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        order = maxRow ? (maxRow.sort_order ?? 0) + 1 : 0;
      }
      await supabase.from("workouts").upsert({
        id: workout.id,
        user_id: session.user.id,
        name: workout.name,
        sort_order: order,
      });
      await supabase
        .from("workout_activities")
        .delete()
        .eq("workout_id", workout.id);
      if (workout.activities.length > 0) {
        await supabase.from("workout_activities").insert(
          workout.activities.map((a, i) => ({
            id: a.id,
            workout_id: workout.id,
            name: a.name,
            duration_seconds: a.duration_seconds,
            sort_order: i,
          })),
        );
      }
    } catch {
      // no-op
    }
  },
  async saveWorkouts(workouts: Workout[]): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      for (let i = 0; i < workouts.length; i++) {
        await supabase
          .from("workouts")
          .update({ sort_order: i })
          .eq("id", workouts[i].id)
          .eq("user_id", session.user.id);
      }
    } catch {
      // no-op
    }
  },
  async deleteWorkout(id: string): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase
        .from("workouts")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);
    } catch {
      // no-op
    }
  },
  async getFavorites(): Promise<Favorite[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];
      const { data, error } = await supabase
        .from("favorites")
        .select("activity_ref, source")
        .eq("user_id", session.user.id);
      if (error || !data) return [];
      return data.map((r) => ({
        activity_ref: r.activity_ref as string,
        source: r.source as "library" | "custom",
      }));
    } catch {
      return [];
    }
  },
  async addFavorite(activity: { id: string; source: "library" | "custom" }): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase.from("favorites").insert({
        user_id: session.user.id,
        activity_ref: activity.id,
        source: activity.source,
      });
    } catch {
      // no-op
    }
  },
  async removeFavorite(activity: { id: string; source: "library" | "custom" }): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", session.user.id)
        .eq("activity_ref", activity.id)
        .eq("source", activity.source);
    } catch {
      // no-op
    }
  },
  async getSettings(): Promise<UserSettings> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return DEFAULT_SETTINGS;
      const { data, error } = await supabase
        .from("users")
        .select("settings")
        .eq("id", session.user.id)
        .maybeSingle();
      if (error || !data?.settings) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...(data.settings as Partial<UserSettings>) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  async saveSettings(settings: UserSettings): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase
        .from("users")
        .update({ settings: settings as unknown as never })
        .eq("id", session.user.id);
    } catch {
      // no-op
    }
  },
  async getCustomActivities(): Promise<Activity[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];
      const { data, error } = await supabase
        .from("custom_activities")
        .select("id, name, body_parts, types")
        .eq("user_id", session.user.id);
      if (error || !data) return [];
      return data.map((r) => ({
        id: r.id,
        name: r.name,
        body_parts: r.body_parts,
        types: r.types,
        source: "custom" as const,
      }));
    } catch {
      return [];
    }
  },
  async addCustomActivity(input: { name: string; body_parts: string[]; types: string[] }): Promise<Activity | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const { data, error } = await supabase
        .from("custom_activities")
        .insert({
          user_id: session.user.id,
          name: input.name,
          body_parts: input.body_parts,
          types: input.types,
        })
        .select("id, name, body_parts, types")
        .single();
      if (error || !data) return null;
      return {
        id: data.id,
        name: data.name,
        body_parts: data.body_parts,
        types: data.types,
        source: "custom",
      };
    } catch {
      return null;
    }
  },
};

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
