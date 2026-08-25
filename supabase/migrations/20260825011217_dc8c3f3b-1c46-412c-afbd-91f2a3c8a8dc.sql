REVOKE ALL ON FUNCTION public.es_responsable_expediente(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_responsable_expediente(uuid, uuid) TO authenticated, service_role;