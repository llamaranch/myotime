import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, GripVertical, Plus, Trash2, Replace as ReplaceIcon, Clock } from "lucide-react";
import { storage, uid } from "@/lib/storage";
import type { Workout, WorkoutActivity } from "@/lib/types";
import { formatTime, totalDuration } from "@/lib/utils-time";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/workout/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Workout — MyoTime" }] }),
  component: EditWorkout,
});

const PENDING_KEY = "myotime.pending_edit.v1";

interface PendingState {
  workoutId: string;
  name: string;
  activities: WorkoutActivity[];
  replaceIndex: number | null;
}

export function loadPending(): PendingState | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function savePending(p: PendingState) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
}
export function clearPending() {
  sessionStorage.removeItem(PENDING_KEY);
}

function EditWorkout() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const isNew = id === "new";

  const [workoutId] = useState(() => isNew ? uid() : id);
  const [name, setName] = useState("");
  const [activities, setActivities] = useState<WorkoutActivity[]>([]);
  const [original, setOriginal] = useState<{ name: string; activities: WorkoutActivity[] }>({ name: "", activities: [] });
  const [openId, setOpenId] = useState<string | null>(null);
  const [editTimeIdx, setEditTimeIdx] = useState<number | null>(null);
  

  // Load: prefer pending state (returning from Add Activity), else workout, else empty
  useEffect(() => {
    const pending = loadPending();
    if (pending && pending.workoutId === workoutId) {
      setName(pending.name);
      setActivities(pending.activities);
      const w = isNew ? null : storage.getWorkout(workoutId);
      setOriginal({ name: w?.name ?? "", activities: w?.activities ?? [] });
      clearPending();
      return;
    }
    // No pending state: load existing workout if it exists, otherwise start empty.
    // Do NOT redirect to home — this caused new-workout creation to silently
    // bounce back when the URL changed during navigation.
    const existing = storage.getWorkout(workoutId);
    if (existing) {
      setName(existing.name);
      setActivities(existing.activities);
      setOriginal({ name: existing.name, activities: existing.activities });
    } else {
      setName("");
      setActivities([]);
      setOriginal({ name: "", activities: [] });
    }
  }, [workoutId, isNew, navigate]);

  const total = useMemo(() => totalDuration(activities), [activities]);
  const dirty = name !== original.name || JSON.stringify(activities) !== JSON.stringify(original.activities);

  const onSave = () => {
    if (!name.trim()) { alert("Please give your workout a name."); return; }
    if (activities.length === 0) { alert("Add at least one activity."); return; }
    const now = Date.now();
    const existing = storage.getWorkout(workoutId);
    const w: Workout = {
      id: workoutId,
      name: name.trim(),
      activities,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    storage.upsertWorkout(w);
    router.invalidate();
    navigate({ to: "/workout/$id", params: { id: workoutId } });
  };

  const onCancel = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    if (isNew) navigate({ to: "/" });
    else navigate({ to: "/workout/$id", params: { id: workoutId } });
  };

  const goAddActivity = (replaceIndex: number | null) => {
    savePending({ workoutId, name, activities, replaceIndex });
    navigate({ to: "/workout/$id/add", params: { id: workoutId } });
  };

  const onDelete = (i: number) => {
    const removedId = activities[i]?.id;
    setActivities(arr => arr.filter((_, idx) => idx !== i));
    if (removedId && openId === removedId) setOpenId(null);
  };

  const onMove = (from: number, to: number) => {
    if (to < 0 || to >= activities.length) return;
    setActivities(arr => {
      const next = [...arr];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setActivities((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };
  return (
    <div className="honeycomb-bg min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-32 pt-6">
        <button onClick={onCancel} className="mb-4 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Workout name"
          className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-2xl font-bold outline-none focus:border-accent"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Total: <span className="timer-digits text-foreground">{formatTime(total)}</span>
        </p>

        <ul className="mt-5 space-y-2">
          {activities.map((a, i) => (
            <li
              key={a.id}
              className="myo-card overflow-hidden"
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragIdx !== null) onMove(dragIdx, i); setDragIdx(null); }}
            >
              <button onClick={() => setOpenId(openId === a.id ? null : a.id)} className="flex w-full items-center justify-between px-3 py-3 text-left">
                <span className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{a.name}</span>
                </span>
                <span className="timer-digits text-muted-foreground">{formatTime(a.duration_seconds)}</span>
              </button>
              {openId === a.id && (
                <div className="flex flex-wrap gap-2 border-t border-border bg-secondary px-3 py-3">
                  <button className="myo-btn-ghost text-sm" onClick={() => setEditTimeIdx(i)}>
                    <Clock className="h-4 w-4" /> Edit Time
                  </button>
                  <button className="myo-btn-ghost text-sm" onClick={() => goAddActivity(i)}>
                    <ReplaceIcon className="h-4 w-4" /> Replace
                  </button>
                  <button className="myo-btn-ghost text-sm" onClick={() => onMove(i, i - 1)} disabled={i === 0}>↑</button>
                  <button className="myo-btn-ghost text-sm" onClick={() => onMove(i, i + 1)} disabled={i === activities.length - 1}>↓</button>
                  <button className="myo-btn-ghost text-sm text-destructive" onClick={() => onDelete(i)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <button onClick={() => goAddActivity(null)} className="myo-btn mt-4 w-full">
          <Plus className="h-4 w-4" /> Add Activity
        </button>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-xl gap-3 px-4 py-3">
            <button onClick={onCancel} className="myo-btn-ghost flex-1">Cancel</button>
            <button onClick={onSave} className="myo-btn flex-1">Save Workout</button>
          </div>
        </div>

        {editTimeIdx !== null && (
          <TimePicker
            initialSeconds={activities[editTimeIdx].duration_seconds}
            onCancel={() => setEditTimeIdx(null)}
            onSave={(secs) => {
              setActivities(arr => arr.map((a, idx) => idx === editTimeIdx ? { ...a, duration_seconds: secs } : a));
              setEditTimeIdx(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

export function TimePicker({ initialSeconds, onCancel, onSave }: { initialSeconds: number; onCancel: () => void; onSave: (s: number) => void; }) {
  const [m, setM] = useState(Math.floor(initialSeconds / 60));
  const [s, setS] = useState(initialSeconds % 60);
  const total = Math.max(1, m * 60 + s);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <div className="myo-card w-full max-w-sm p-5">
        <h3 className="mb-4 text-lg font-semibold">Set Duration</h3>
        <div className="flex items-end justify-center gap-3">
          <label className="flex flex-col items-center">
            <span className="mb-1 text-xs text-muted-foreground">MIN</span>
            <input type="number" min={0} max={99} value={m}
              onFocus={e => e.currentTarget.select()}
              onClick={e => e.currentTarget.select()}
              onChange={e => setM(Math.max(0, Math.min(99, parseInt(e.target.value || "0"))))}
              className="w-20 rounded-lg bg-secondary px-3 py-3 text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-accent" />
          </label>
          <span className="pb-3 text-3xl font-bold">:</span>
          <label className="flex flex-col items-center">
            <span className="mb-1 text-xs text-muted-foreground">SEC</span>
            <input type="number" min={0} max={59} value={s}
              onFocus={e => e.currentTarget.select()}
              onClick={e => e.currentTarget.select()}
              onChange={e => setS(Math.max(0, Math.min(59, parseInt(e.target.value || "0"))))}
              className="w-20 rounded-lg bg-secondary px-3 py-3 text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-accent" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="myo-btn-ghost flex-1">Cancel</button>
          <button onClick={() => onSave(total)} className="myo-btn flex-1">Save</button>
        </div>
      </div>
    </div>
  );
}
