import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, GripVertical, MoreVertical, Plus, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { storage, uid, MAX_WORKOUTS } from "@/lib/storage";
import type { Workout } from "@/lib/types";
import { formatTime, totalDuration } from "@/lib/utils-time";
import { loadLibrary } from "@/lib/activities";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    setWorkouts(storage.getWorkouts());
    loadLibrary();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persist = (list: Workout[]) => {
    const withOrder = list.map((w, i) => ({ ...w, order: i }));
    storage.saveWorkouts(withOrder);
    setWorkouts(withOrder);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = workouts.findIndex((w) => w.id === active.id);
    const newIndex = workouts.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persist(arrayMove(workouts, oldIndex, newIndex));
  };

  const onDelete = (w: Workout) => {
    if (!confirm(`Delete "${w.name}"?`)) return;
    storage.deleteWorkout(w.id);
    setWorkouts(storage.getWorkouts());
    router.invalidate();
  };

  const onDuplicate = (w: Workout) => {
    const existingNames = new Set(workouts.map((x) => x.name));
    const base = `${w.name} (copy`;
    let candidate = `${w.name} (copy)`;
    if (existingNames.has(candidate)) {
      let n = 2;
      while (existingNames.has(`${base} ${n})`)) n++;
      candidate = `${base} ${n})`;
    }
    const now = Date.now();
    const idx = workouts.findIndex((x) => x.id === w.id);
    const dup: Workout = {
      id: uid(),
      name: candidate,
      activities: w.activities.map((a) => ({ ...a, id: uid() })),
      created_at: now,
      updated_at: now,
    };
    const next = [...workouts];
    next.splice(idx + 1, 0, dup);
    persist(next);
  };

  return (
    <div className="honeycomb-bg min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <header className="mb-8 flex items-center justify-between">
          <h1
            style={{
              fontFamily: '"Manrope", system-ui, sans-serif',
              fontSize: "48px",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1,
            }}
          >
            <span style={{ fontStyle: "italic", color: "#FFFFFF", marginRight: "2px" }}>Myo</span>
            <span style={{ color: "#2EC4B6" }}>Time</span>
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

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={workouts.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-3">
                {workouts.map((w) => (
                  <SortableWorkoutItem
                    key={w.id}
                    workout={w}
                    onOpen={() => navigate({ to: "/workout/$id", params: { id: w.id } })}
                    onDuplicate={() => onDuplicate(w)}
                    onDelete={() => onDelete(w)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

interface SortableWorkoutItemProps {
  workout: Workout;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableWorkoutItem({ workout: w, onOpen, onDuplicate, onDelete }: SortableWorkoutItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : ("auto" as const),
  };
  const total = useMemo(() => totalDuration(w.activities), [w.activities]);

  return (
    <li ref={setNodeRef} style={style} className="myo-card flex items-center gap-2 p-5 hover:bg-secondary">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="touch-none cursor-grab active:cursor-grabbing -ml-1 px-1 py-1 text-muted-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center justify-between text-left"
      >
        <span className="text-lg font-semibold">{w.name}</span>
        <span className="timer-digits text-base text-muted-foreground">{formatTime(total)}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Workout options"
            className="rounded-full p-2 text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onDuplicate()}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDelete()} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
