import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { storage } from "@/lib/storage";
import type { Workout } from "@/lib/types";

export const Route = createFileRoute("/workout/$id/done")({
  head: () => ({ meta: [{ title: "Workout Complete — MyoTime" }] }),
  component: DonePage,
});

function DonePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    const w = storage.getWorkout(id);
    if (!w) { navigate({ to: "/" }); return; }
    setWorkout(w);
  }, [id, navigate]);

  if (!workout) return null;

  return (
    <div className="honeycomb-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-accent">Nice work 🎉</p>
      <h1 className="mt-3 text-4xl font-bold">{workout.name} Workout Complete</h1>
      <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
        <Link to="/workout/$id/run" params={{ id: workout.id }} className="myo-btn">
          Repeat {workout.name} Workout
        </Link>
        <Link to="/" className="myo-btn-ghost">Back to Workouts</Link>
      </div>
    </div>
  );
}
