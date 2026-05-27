CREATE OR REPLACE FUNCTION public.colab_after_mensaje()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m uuid;
  v_canal RECORD;
  v_autor_nombre text;
  v_link text;
  v_titulo text;
  v_preview text;
BEGIN
  SELECT id, nombre, tipo INTO v_canal FROM public.colab_canales WHERE id = NEW.canal_id;

  SELECT COALESCE(NULLIF(nombre,''), NULLIF(correo_corporativo,''), NULLIF(email,''), 'Alguien')
  INTO v_autor_nombre
  FROM public.profiles WHERE id = NEW.user_id;
  IF v_autor_nombre IS NULL THEN v_autor_nombre := 'Alguien'; END IF;

  IF v_canal.tipo = 'dm' THEN
    v_link := '/colaboracion/dm/' || NEW.canal_id::text;
  ELSE
    v_link := '/colaboracion?canal=' || NEW.canal_id::text;
  END IF;

  v_preview := COALESCE(NULLIF(left(NEW.texto, 140), ''), 'Nuevo mensaje');

  IF NEW.menciones IS NOT NULL THEN
    FOREACH m IN ARRAY NEW.menciones LOOP
      IF m <> NEW.user_id THEN
        INSERT INTO public.colab_notificaciones(user_id, canal_id, mensaje_id, tipo)
        VALUES (m, NEW.canal_id, NEW.id, 'mencion');

        INSERT INTO public.notificaciones_usuario(user_id, tipo, titulo, mensaje, link, severidad, metadata)
        VALUES (
          m,
          'mensaje_interno',
          v_autor_nombre || ' te mencionó',
          v_preview,
          v_link,
          'alta',
          jsonb_build_object('canal_id', NEW.canal_id, 'mensaje_id', NEW.id, 'tipo_canal', v_canal.tipo)
        );
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.colab_notificaciones(user_id, canal_id, mensaje_id, tipo)
  SELECT mb.user_id, NEW.canal_id, NEW.id, 'mensaje'
  FROM public.colab_miembros mb
  WHERE mb.canal_id = NEW.canal_id
    AND mb.user_id <> NEW.user_id
    AND NOT mb.silenciado
    AND NOT (mb.user_id = ANY(COALESCE(NEW.menciones,'{}'::uuid[])));

  IF v_canal.tipo = 'dm' THEN
    v_titulo := 'Mensaje directo de ' || v_autor_nombre;
  ELSE
    v_titulo := v_autor_nombre || ' en #' || COALESCE(v_canal.nombre, 'canal');
  END IF;

  INSERT INTO public.notificaciones_usuario(user_id, tipo, titulo, mensaje, link, severidad, metadata)
  SELECT
    mb.user_id,
    'mensaje_interno',
    v_titulo,
    v_preview,
    v_link,
    'media',
    jsonb_build_object('canal_id', NEW.canal_id, 'mensaje_id', NEW.id, 'tipo_canal', v_canal.tipo)
  FROM public.colab_miembros mb
  WHERE mb.canal_id = NEW.canal_id
    AND mb.user_id <> NEW.user_id
    AND NOT mb.silenciado
    AND NOT (mb.user_id = ANY(COALESCE(NEW.menciones,'{}'::uuid[])));

  RETURN NEW;
END $function$;