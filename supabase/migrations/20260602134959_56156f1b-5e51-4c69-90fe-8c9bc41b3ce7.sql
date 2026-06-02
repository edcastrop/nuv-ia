ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS presencia_visible boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at DESC);

-- Política específica: cada usuario puede actualizar su propio last_seen_at
DROP POLICY IF EXISTS "profiles_update_last_seen_self" ON public.profiles;
CREATE POLICY "profiles_update_last_seen_self"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());