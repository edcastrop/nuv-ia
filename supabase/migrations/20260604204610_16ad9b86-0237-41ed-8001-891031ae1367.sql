
CREATE POLICY "Director Financiero QA sees expedientes"
  ON public.expedientes FOR SELECT
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));

CREATE POLICY "Director Financiero QA updates expedientes"
  ON public.expedientes FOR UPDATE
  USING (has_role(auth.uid(), 'director_financiero_qa'::app_role));
