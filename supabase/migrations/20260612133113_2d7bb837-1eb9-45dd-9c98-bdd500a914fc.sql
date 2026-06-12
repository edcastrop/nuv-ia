
CREATE POLICY "treasury_extractos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'treasury-extractos' AND public.can_manage_finanzas(auth.uid()));
CREATE POLICY "treasury_extractos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'treasury-extractos' AND public.can_manage_finanzas(auth.uid()));
CREATE POLICY "treasury_extractos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'treasury-extractos' AND public.can_manage_finanzas(auth.uid()));
