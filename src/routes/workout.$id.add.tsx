import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Star } from "lucide-react";
import { loadLibrary } from "@/lib/activities";
import { storage, uid } from "@/lib/storage";
import type { Activity } from "@/lib/types";
import { BODY_PARTS, ACTIVITY_TYPES } from "@/lib/types";
import { TimePicker, loadPending, savePending, clearPending } from "./workout.$id.edit";

export const Route = createFileRoute("/workout/$id/add")({
  head: () => ({ meta: [{ title: "Add Activity — MyoTime" }] }),
  component: AddActivity,
});

type Tab = "favorites" | "body" | "type";

function AddActivity() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [library, setLibrary] = useState<Activity[]>([]);
  const [prefs, setPrefs] = useState(storage.getPrefs());
  const [tab, setTab] = useState<Tab>("favorites");
  const [search, setSearch] = useState("");
  const [bodyFilter, setBodyFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [pendingActivity, setPendingActivity] = useState<Activity | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customFav, setCustomFav] = useState(false);

  useEffect(() => { loadLibrary().then(setLibrary); }, []);

  const all: Activity[] = useMemo(
    () => [...library, ...prefs.custom_activities],
    [library, prefs.custom_activities]
  );

  const isFav = (name: string) => prefs.favorites.includes(name.toLowerCase());

  const toggleFav = (name: string) => {
    const key = name.toLowerCase();
    const next = { ...prefs };
    next.favorites = isFav(name) ? next.favorites.filter(f => f !== key) : [...next.favorites, key];
    setPrefs(next);
    storage.savePrefs(next);
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return all.filter(a => a.name.toLowerCase().includes(q)).slice(0, 12);
  }, [search, all]);

  const tabList = useMemo(() => {
    const sorted = (arr: Activity[]) => [...arr].sort((a, b) => a.name.localeCompare(b.name));
    if (tab === "favorites") return sorted(all.filter(a => isFav(a.name)));
    if (tab === "body" && bodyFilter) return sorted(all.filter(a => a.body_parts.includes(bodyFilter)));
    if (tab === "type" && typeFilter) return sorted(all.filter(a => a.types.includes(typeFilter)));
    return [];
  }, [tab, all, bodyFilter, typeFilter, prefs.favorites]);

  const onPick = (a: Activity) => setPendingActivity(a);

  const back = () => navigate({ to: "/workout/$id/edit", params: { id } });

  const confirmDuration = (seconds: number) => {
    if (!pendingActivity) return;
    const pending = loadPending();
    if (!pending) { back(); return; }
    const newWA = {
      id: uid(),
      name: pendingActivity.name,
      duration_seconds: seconds,
      source: pendingActivity.source,
    };
    let next = [...pending.activities];
    if (pending.replaceIndex !== null && pending.replaceIndex >= 0 && pending.replaceIndex < next.length) {
      next[pending.replaceIndex] = { ...newWA, duration_seconds: pending.activities[pending.replaceIndex].duration_seconds };
    } else {
      next.push(newWA);
    }
    savePending({ ...pending, activities: next, replaceIndex: null });
    setPendingActivity(null);
    back();
  };

  const cancelPending = () => {
    // bounce back without modifying
    const pending = loadPending();
    if (pending) clearPending(), savePending(pending);
    setPendingActivity(null);
    back();
  };

  const addCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const newAct: Activity = {
      id: uid(),
      name: trimmed,
      body_parts: ["other"],
      types: ["other"],
      source: "custom",
    };
    const next = { ...prefs };
    next.custom_activities = [...next.custom_activities, newAct];
    if (customFav) next.favorites = [...next.favorites, trimmed.toLowerCase()];
    setPrefs(next);
    storage.savePrefs(next);
    setShowCustom(false);
    setCustomName("");
    setCustomFav(false);
    setPendingActivity(newAct);
  };

  return (
    <div className="honeycomb-bg min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <button onClick={back} className="mb-4 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to edit
        </button>

        <div className="space-y-3">
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search activities..."
              className="w-full rounded-lg border border-border bg-secondary px-4 py-3 outline-none focus:border-accent"
            />
            {searchResults.length > 0 && (
              <ul className="myo-card absolute z-20 mt-1 max-h-72 w-full overflow-auto p-1">
                {searchResults.map(a => (
                  <li key={a.id}>
                    <button onClick={() => { setSearch(""); onPick(a); }}
                      className="w-full rounded-md px-3 py-2 text-left hover:bg-secondary">
                      {a.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button onClick={() => setShowCustom(true)} className="myo-btn-ghost w-full">
            <Plus className="h-4 w-4" /> Add Custom Activity
          </button>

          <div className="grid grid-cols-3 gap-2">
            {(["favorites", "body", "type"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setBodyFilter(null); setTypeFilter(null); }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  tab === t ? "border-accent text-accent" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "favorites" ? "Favorites" : t === "body" ? "By Body Part" : "By Type"}
              </button>
            ))}
          </div>

          {tab === "body" && !bodyFilter && (
            <div className="grid grid-cols-2 gap-2">
              {BODY_PARTS.map(p => (
                <button key={p} onClick={() => setBodyFilter(p)} className="myo-btn-ghost capitalize">{p}</button>
              ))}
            </div>
          )}
          {tab === "type" && !typeFilter && (
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_TYPES.map(p => (
                <button key={p} onClick={() => setTypeFilter(p)} className="myo-btn-ghost capitalize">{p}</button>
              ))}
            </div>
          )}
          {(tab === "body" && bodyFilter) || (tab === "type" && typeFilter) ? (
            <button
              onClick={() => { setBodyFilter(null); setTypeFilter(null); }}
              className="text-sm text-muted-foreground hover:text-accent"
            >
              ← Choose a different category
            </button>
          ) : null}

          <ul className="space-y-1">
            {tabList.map(a => (
              <li key={a.id} className="myo-card flex items-center justify-between px-3 py-2">
                <button onClick={() => onPick(a)} className="flex-1 text-left">{a.name}</button>
                <button onClick={() => toggleFav(a.name)} aria-label="Toggle favorite" className="px-2">
                  <Star className={`h-5 w-5 ${isFav(a.name) ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                </button>
                <button onClick={() => onPick(a)} aria-label="Add" className="px-2 text-accent">
                  <Plus className="h-5 w-5" />
                </button>
              </li>
            ))}
            {tab === "favorites" && tabList.length === 0 && (
              <li className="text-center text-muted-foreground">No favorites yet. Tap the star on any activity.</li>
            )}
          </ul>
        </div>

        {pendingActivity && (
          <TimePicker
            initialSeconds={45}
            onCancel={cancelPending}
            onSave={confirmDuration}
          />
        )}

        {showCustom && (() => {
          const q = customName.trim().toLowerCase();
          const suggestions = q
            ? all
                .filter(a => a.name.toLowerCase().includes(q) && a.name.toLowerCase() !== q)
                .slice(0, 6)
            : [];
          return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
            <div className="myo-card w-full max-w-sm p-5">
              <h3 className="mb-3 text-lg font-semibold">Custom Activity</h3>
              <div className="relative">
                <input
                  autoFocus value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Activity name"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-accent"
                />
                {suggestions.length > 0 && (
                  <ul className="myo-card absolute z-10 mt-1 max-h-56 w-full overflow-auto p-1">
                    {suggestions.map(a => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustom(false);
                            setCustomName("");
                            setCustomFav(false);
                            onPick(a);
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                        >
                          {a.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {a.source === "custom" ? "custom" : "library"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={customFav} onChange={e => setCustomFav(e.target.checked)} />
                Save as favorite
              </label>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setShowCustom(false); setCustomName(""); }} className="myo-btn-ghost flex-1">Cancel</button>
                <button onClick={addCustom} className="myo-btn flex-1">Add</button>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
