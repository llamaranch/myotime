import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { storage } from "@/lib/storage";
import type { Workout } from "@/lib/types";
import { formatTime } from "@/lib/utils-time";
import { playTransitionBeeps, playChime, speak, cancelSpeech } from "@/lib/audio";
import { releaseWakeLock, requestWakeLock, setupWakeLockReacquire } from "@/lib/wakeLock";

export const Route = createFileRoute("/workout/$id/run")({
  head: () => ({ meta: [{ title: "Active Workout — MyoTime" }] }),
  component: RunWorkout,
});

type Phase = "idle" | "starting" | "active" | "transition" | "paused" | "complete";

function RunWorkout() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [now, setNow] = useState(new Date());
  const remainingRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const idxRef = useRef(0);
  const workoutRef = useRef<Workout | null>(null);
  const endingRef = useRef(false);
  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);

  // Load workout & start
  useEffect(() => {
    const w = storage.getWorkout(id);
    if (!w || w.activities.length === 0) { navigate({ to: "/" }); return; }
    setWorkout(w);
    workoutRef.current = w;
    requestWakeLock();
    const cleanup = setupWakeLockReacquire(() => phaseRef.current !== "complete" && phaseRef.current !== "idle");
    startSequence(w);
    return () => {
      stopTick();
      cancelSpeech();
      releaseWakeLock();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Clock
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  function stopTick() {
    if (tickRef.current !== null) {
      cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
  }
  function startTick() {
    stopTick();
    lastTickRef.current = performance.now();
    const step = (t: number) => {
      const dt = (t - lastTickRef.current) / 1000;
      lastTickRef.current = t;
      if (phaseRef.current === "active") {
        const next = remainingRef.current - dt;
        if (next <= 0) {
          if (endingRef.current) return;
          endingRef.current = true;
          remainingRef.current = 0;
          setRemaining(0);
          stopTick();
          onActivityEnd();
          return;
        }
        remainingRef.current = next;
        setRemaining(next);
      }
      tickRef.current = requestAnimationFrame(step);
    };
    tickRef.current = requestAnimationFrame(step);
  }

  async function startSequence(w: Workout) {
    setPhase("starting");
    phaseRef.current = "starting";
    setIdx(0); idxRef.current = 0;
    setRemaining(w.activities[0].duration_seconds);
    remainingRef.current = w.activities[0].duration_seconds;
    await wait(500);
    if (phaseRef.current !== "starting") return;

    await speak("three");
    if (phaseRef.current !== "starting") return;
    await wait(200);

    await speak("two");
    if (phaseRef.current !== "starting") return;
    await wait(200);

    await speak("one");
    if (phaseRef.current !== "starting") return;
    await wait(200);

    await speak(w.activities[0].name);
    if (phaseRef.current !== "starting") return;

    setPhase("active");
    phaseRef.current = "active";
    startTick();
  }

  function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  async function onActivityEnd() {
    const activeWorkout = workoutRef.current;
    if (!activeWorkout) {
      endingRef.current = false;
      return;
    }
    const nextIdx = idxRef.current + 1;

    if (nextIdx >= activeWorkout.activities.length) {
      setPhase("complete");
      phaseRef.current = "complete";
      endingRef.current = false;
      cancelSpeech();
      releaseWakeLock();
      playChime();
      setTimeout(
        () => navigate({ to: "/workout/$id/done", params: { id } }),
        400,
      );
      return;
    }

    setPhase("transition");
    phaseRef.current = "transition";

    await playTransitionBeeps();
    if (phaseRef.current !== "transition") {
      endingRef.current = false;
      return;
    }

    const next = activeWorkout.activities[nextIdx];
    setIdx(nextIdx);
    idxRef.current = nextIdx;
    setRemaining(next.duration_seconds);
    remainingRef.current = next.duration_seconds;

    await speak(next.name);
    if (phaseRef.current !== "transition") {
      endingRef.current = false;
      return;
    }

    endingRef.current = false;
    setPhase("active");
    phaseRef.current = "active";
    startTick();
  }

  const togglePause = () => {
    if (phase === "active") {
      stopTick();
      setPhase("paused");
    } else if (phase === "paused") {
      setPhase("active");
      phaseRef.current = "active";
      startTick();
    }
  };

  const onSkip = async () => {
    if (!workout) return;
    stopTick();
    cancelSpeech();
    // Yield one microtask so iOS doesn't drop the next speak() call
    await Promise.resolve();
    endingRef.current = false;
    await onActivityEnd();
  };

  const onRepeat = () => {
    if (!workout) return;
    const cur = workout.activities[idxRef.current];
    setRemaining(cur.duration_seconds);
    remainingRef.current = cur.duration_seconds;
    if (phaseRef.current !== "active") {
      setPhase("active");
      phaseRef.current = "active";
      startTick();
    }
  };

  const onStop = () => {
    if (confirm("Stop workout? Progress will be lost.")) {
      stopTick(); cancelSpeech(); releaseWakeLock();
      navigate({ to: "/workout/$id", params: { id } });
    }
  };

  if (!workout) return null;
  const current = workout.activities[idx];
  const next = workout.activities[idx + 1];
  const timeOfDay = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="honeycomb-bg flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={onStop} aria-label="Stop workout" className="rounded-full p-2 hover:bg-secondary">
          <X className="h-6 w-6" />
        </button>
        <span className="timer-digits text-sm text-muted-foreground">{timeOfDay}</span>
      </div>

      {/* Main: portrait stacks, landscape splits */}
      <div className="flex flex-1 flex-col landscape:-mt-6 landscape:flex-row landscape:items-stretch">
        <div className="flex flex-1 flex-col items-center justify-center px-6 landscape:flex-[3]">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {phase === "starting" ? "Get ready" : phase === "transition" ? "Up next…" : "Now"}
          </p>
          <h2 className="mt-2 text-center text-3xl font-bold sm:text-4xl">{current.name}</h2>
          <div className="timer-digits mt-6 text-[40vw] leading-none text-accent landscape:text-[21vw] sm:text-[280px]">
            {formatTime(remaining)}
          </div>
          <div className="mt-8 flex gap-3">
            <button onClick={onRepeat} className="myo-btn-ghost" aria-label="Repeat">
              <RotateCcw className="h-5 w-5" />
            </button>
            <button onClick={togglePause} className="myo-btn px-6" aria-label={phase === "paused" ? "Resume" : "Pause"}>
              {phase === "paused" ? <><Play className="h-5 w-5" /> Resume</> : <><Pause className="h-5 w-5" /> Pause</>}
            </button>
            <button onClick={onSkip} className="myo-btn-ghost" aria-label="Skip">
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center border-t border-border px-6 py-6 text-center landscape:flex-1 landscape:border-l landscape:border-t-0">
          {next ? (
            <>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Next</p>
              <p className="mt-1 text-lg font-semibold text-muted-foreground">{next.name}</p>
              <p className="timer-digits text-sm text-muted-foreground">{formatTime(next.duration_seconds)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Last activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
