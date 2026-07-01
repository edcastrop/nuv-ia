REVOKE ALL ON FUNCTION public.nuvia_jsonb_meaningful(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_jsonb_deep_merge_non_empty(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_patch_expediente_from_extracto(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_guard_expediente_no_wipe() FROM PUBLIC, anon, authenticated;