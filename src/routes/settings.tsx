import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { storage } from "@/lib/storage";
import type { UserPreferences } from "@/lib/types";
import { getVoices } from "@/lib/audio";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MyoTime" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [prefs, setPrefs] = useState<UserPreferences>(() => storage.getPrefs());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const update = () => setVoices(getVoices());
    update();
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.onvoiceschanged = update;
    }
  }, []);

  const update = (patch: Partial<UserPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    storage.savePrefs(next);
  };

  return (
    <div className="honeycomb-bg min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-3xl font-bold">Settings</h1>

        <section className="myo-card mt-6 space-y-4 p-5">
          <h2 className="font-semibold">Beep Volume</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => update({ beep_muted: !prefs.beep_muted })} aria-label="Toggle beep mute">
              {prefs.beep_muted ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume2 className="h-5 w-5 text-accent" />}
            </button>
            <input type="range" min={0} max={100} value={prefs.beep_volume}
              onChange={e => update({ beep_volume: parseInt(e.target.value) })}
              className="flex-1 accent-accent" />
            <span className="timer-digits w-10 text-right text-sm text-muted-foreground">{prefs.beep_volume}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            On iPhone, beep and chime sounds require the ringer to be on. If your
            device's silent switch (the small toggle on the side of the phone) shows
            an orange dot, beeps will be muted by iOS even when this app's volume is
            set to maximum. Voice cues are not affected by the silent switch.
          </p>
        </section>

        <section className="myo-card mt-4 space-y-4 p-5">
          <h2 className="font-semibold">Voice Volume</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => update({ voice_muted: !prefs.voice_muted })} aria-label="Toggle voice mute">
              {prefs.voice_muted ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume2 className="h-5 w-5 text-accent" />}
            </button>
            <input type="range" min={0} max={100} value={prefs.voice_volume}
              onChange={e => update({ voice_volume: parseInt(e.target.value) })}
              className="flex-1 accent-accent" />
            <span className="timer-digits w-10 text-right text-sm text-muted-foreground">{prefs.voice_volume}</span>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Voice</span>
            <select
              value={prefs.preferred_voice ?? ""}
              onChange={e => update({ preferred_voice: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-accent"
            >
              <option value="">System default</option>
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </label>
        </section>

        <section className="myo-card mt-4 p-5">
          <h2 className="font-semibold">About</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">MyoTime</span> · v1.0
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            A mobile-first interval timer for exercise workouts. Build custom workouts and let voice and beep cues guide your transitions.
          </p>
        </section>
      </div>
    </div>
  );
}
