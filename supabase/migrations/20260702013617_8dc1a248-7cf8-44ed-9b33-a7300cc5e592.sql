UPDATE public.profiles
SET nombre = CASE id
  WHEN '7368aad6-3c75-48c7-93d2-8c093f047afb'::uuid THEN 'Kevin Diaz Navarrete'
  WHEN 'e123cd8a-9b97-4b4b-a586-8a275565214d'::uuid THEN 'Eduard Castro Prada'
  WHEN '8b905455-7ab9-466d-bd49-c3cce9570f41'::uuid THEN 'Eduard Castro Prada'
  WHEN 'db0f8c0b-ff38-40f8-8f10-32a91aefc490'::uuid THEN 'Carlos Gomez'
  ELSE nombre
END,
updated_at = now()
WHERE id IN (
  '7368aad6-3c75-48c7-93d2-8c093f047afb'::uuid,
  'e123cd8a-9b97-4b4b-a586-8a275565214d'::uuid,
  '8b905455-7ab9-466d-bd49-c3cce9570f41'::uuid,
  'db0f8c0b-ff38-40f8-8f10-32a91aefc490'::uuid
);