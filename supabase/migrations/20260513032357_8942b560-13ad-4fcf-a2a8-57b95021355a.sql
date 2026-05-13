-- Phase 2 schema + RLS

-- 1. Tables

CREATE TABLE public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workout_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_seconds int NOT NULL CHECK (duration_seconds > 0),
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body_parts text[] NOT NULL DEFAULT '{}',
  types text[] NOT NULL DEFAULT '{}',
  description text,
  image_url text,
  video_url text
);

CREATE TABLE public.custom_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  body_parts text[] NOT NULL DEFAULT '{}',
  types text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_ref uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('library', 'custom'))
);

CREATE TABLE public.referral_codes (
  code text PRIMARY KEY,
  affiliate_name text NOT NULL,
  affiliate_email text NOT NULL,
  commission_percent int NOT NULL CHECK (commission_percent BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_id text NOT NULL UNIQUE,
  amount_cents int NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'refunded')),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  referral_code text REFERENCES public.referral_codes(code) ON DELETE SET NULL,
  promo_code text
);

-- 2. Indexes

CREATE INDEX idx_workouts_user_id ON public.workouts(user_id);
CREATE INDEX idx_workout_activities_workout_id ON public.workout_activities(workout_id);
CREATE UNIQUE INDEX idx_activities_name_unique ON public.activities(name);
CREATE INDEX idx_custom_activities_user_id ON public.custom_activities(user_id);
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE UNIQUE INDEX idx_favorites_user_ref_source_unique ON public.favorites(user_id, activity_ref, source);
CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);

-- 3. Enable RLS

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- 4. Policies

-- workouts
CREATE POLICY "workouts_select_own" ON public.workouts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "workouts_insert_own" ON public.workouts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "workouts_update_own" ON public.workouts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "workouts_delete_own" ON public.workouts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- workout_activities (via parent workout ownership)
CREATE POLICY "workout_activities_select_own" ON public.workout_activities FOR SELECT TO authenticated
  USING (workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid()));
CREATE POLICY "workout_activities_insert_own" ON public.workout_activities FOR INSERT TO authenticated
  WITH CHECK (workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid()));
CREATE POLICY "workout_activities_update_own" ON public.workout_activities FOR UPDATE TO authenticated
  USING (workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid()))
  WITH CHECK (workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid()));
CREATE POLICY "workout_activities_delete_own" ON public.workout_activities FOR DELETE TO authenticated
  USING (workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid()));

-- activities (read-only library for authenticated users)
CREATE POLICY "activities_select_authenticated" ON public.activities FOR SELECT TO authenticated USING (true);

-- custom_activities
CREATE POLICY "custom_activities_select_own" ON public.custom_activities FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "custom_activities_insert_own" ON public.custom_activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "custom_activities_update_own" ON public.custom_activities FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "custom_activities_delete_own" ON public.custom_activities FOR DELETE TO authenticated USING (user_id = auth.uid());

-- favorites
CREATE POLICY "favorites_select_own" ON public.favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "favorites_insert_own" ON public.favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "favorites_update_own" ON public.favorites FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "favorites_delete_own" ON public.favorites FOR DELETE TO authenticated USING (user_id = auth.uid());

-- purchases (read-only for owner; writes from server-side webhook only)
CREATE POLICY "purchases_select_own" ON public.purchases FOR SELECT TO authenticated USING (user_id = auth.uid());

-- referral_codes: no client policies (server/admin only). RLS enabled with no policies = no client access.
