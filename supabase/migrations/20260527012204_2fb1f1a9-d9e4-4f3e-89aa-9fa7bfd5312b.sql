-- Allow authenticated users to read all user_roles rows (needed for directory labels)
DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated read all roles" ON public.user_roles;

CREATE POLICY "Authenticated read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);