
-- Allow service role (and any role) to insert usage logs
CREATE POLICY "Service role can insert usage"
  ON public.api_usage_log FOR INSERT
  WITH CHECK (true);

-- Admin policies for user_api_keys
CREATE POLICY "Admins can read all api keys"
  ON public.user_api_keys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update api keys"
  ON public.user_api_keys FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert api keys"
  ON public.user_api_keys FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
