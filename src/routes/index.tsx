import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import { storage } from "@/lib/storage";
import type { Workout } from "@/lib/types";
import { formatTime, totalDuration } from "@/lib/utils-time";
import { loadLibrary } from "@/lib/activities";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MyoTime — Your Workouts" },
      { name: "description", content: "Your saved interval workouts. Tap one to start, or create a new one." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    setWorkouts(storage.getWorkouts());
    loadLibrary(); // warm cache
  }, []);

  return (
    <div className="honeycomb-bg min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Myo<span className="text-accent">Time</span>
          </h1>
          <Link to="/settings" aria-label="Settings" className="rounded-full border border-border p-2 hover:bg-secondary">
            <SettingsIcon className="h-5 w-5" />
          </Link>
        </header>

        <div className="space-y-3">
          <Link
            to="/workout/$id/edit"
            params={{ id: "new" }}
            className="myo-card flex items-center justify-between p-5 transition-colors hover:bg-secondary"
            style={{ borderColor: "var(--color-accent)" }}
          >
            <span className="flex items-center gap-3 text-accent">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-accent">
                <Plus className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold">Create New Workout</span>
            </span>
          </Link>

          {workouts.map(w => (
            <Link
              key={w.id}
              to="/workout/$id"
              params={{ id: w.id }}
              className="myo-card flex items-center justify-between p-5 hover:bg-secondary"
            >
              <span className="text-lg font-semibold">{w.name}</span>
              <span className="timer-digits text-base text-muted-foreground">
                {formatTime(totalDuration(w.activities))}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
