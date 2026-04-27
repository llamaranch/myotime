import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Play } from "lucide-react";
import { storage } from "@/lib/storage";
import type { Workout } from "@/lib/types";
import { formatTime, totalDuration } from "@/lib/utils-time";

export const Route = createFileRoute("/workout/$id/")({
  head: () => ({ meta: [{ title: "Workout — MyoTime" }] }),
  component: WorkoutDetail,
});

function WorkoutDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    const w = storage.getWorkout(id);
    if (!w) { navigate({ to: "/" }); return; }
    setWorkout(w);
  }, [id, navigate]);

  if (!workout) return null;

  const total = totalDuration(workout.activities);

  const onDelete = () => {
    if (confirm(`Delete "${workout.name}"?`)) {
      storage.deleteWorkout(workout.id);
      router.invalidate();
      navigate({ to: "/" });
    }
  };

  return (
    <div className="honeycomb-bg min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{workout.name}</h1>
        <p className="mt-1 text-muted-foreground">
          Total: <span className="timer-digits text-foreground">{formatTime(total)}</span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {workout.activities.length > 0 ? (
            <Link
              to="/workout/$id/run"
              params={{ id: workout.id }}
              className="myo-btn col-span-2 py-4 text-lg"
            >
              <Play className="h-5 w-5" /> Start Workout
            </Link>
          ) : (
            <button disabled className="myo-btn col-span-2 py-4 text-lg">
              <Play className="h-5 w-5" /> Add activities to start
            </button>
          )}
          <Link to="/workout/$id/edit" params={{ id: workout.id }} className="myo-btn-ghost">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button onClick={onDelete} className="myo-btn-ghost text-destructive">Delete</button>
        </div>

        <ul className="mt-8 space-y-2">
          {workout.activities.map((a, i) => (
            <li key={a.id} className="myo-card flex items-center justify-between px-4 py-3">
              <span>
                <span className="mr-3 text-muted-foreground">{i + 1}.</span>
                {a.name}
              </span>
              <span className="timer-digits text-muted-foreground">{formatTime(a.duration_seconds)}</span>
            </li>
          ))}
          {workout.activities.length === 0 && (
            <li className="text-center text-muted-foreground">No activities yet. Tap Edit to add some.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
