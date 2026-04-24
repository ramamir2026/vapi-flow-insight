-- Update handle_new_user to assign roles based on email mapping
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role app_role;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );

  -- Determine seed role by email
  v_role := CASE LOWER(NEW.email)
    WHEN 'finance@vapi.ai' THEN 'approver'::app_role
    WHEN 'ram@vapi.ai' THEN 'editor'::app_role
    WHEN 'parmvir@vapi.ai' THEN 'editor'::app_role
    ELSE 'editor'::app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Apply current desired roles to any users that already exist
DO $$
DECLARE
  r RECORD;
  v_role app_role;
BEGIN
  FOR r IN
    SELECT user_id, email FROM public.profiles
    WHERE LOWER(email) IN ('ram@vapi.ai','parmvir@vapi.ai','finance@vapi.ai')
  LOOP
    v_role := CASE LOWER(r.email)
      WHEN 'finance@vapi.ai' THEN 'approver'::app_role
      WHEN 'ram@vapi.ai' THEN 'editor'::app_role
      WHEN 'parmvir@vapi.ai' THEN 'editor'::app_role
    END;
    DELETE FROM public.user_roles WHERE user_id = r.user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, v_role);
  END LOOP;
END $$;

-- Allow approvers to manage all user_roles via Admin Settings page
CREATE POLICY "Approvers can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'approver'::app_role));

CREATE POLICY "Approvers can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'approver'::app_role));

CREATE POLICY "Approvers can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'approver'::app_role));

CREATE POLICY "Approvers can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'approver'::app_role));

-- RPC: approvers add a user_role by email (looks up profile)
CREATE OR REPLACE FUNCTION public.admin_add_user_role(p_email text, p_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'approver'::app_role) THEN
    RAISE EXCEPTION 'Only approvers can manage user roles';
  END IF;

  SELECT user_id INTO v_user_id FROM public.profiles WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email %. They must sign in once before a role can be assigned.', p_email;
  END IF;

  -- Replace any existing roles for that user with the new single role
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, p_role);
END;
$$;

-- RPC: approvers update a role row to a new role
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'approver'::app_role) THEN
    RAISE EXCEPTION 'Only approvers can manage user roles';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role);
END;
$$;

-- RPC: list all role assignments with email (approver only)
CREATE OR REPLACE FUNCTION public.admin_list_user_roles()
RETURNS TABLE(user_id uuid, email text, role app_role, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'approver'::app_role) THEN
    RAISE EXCEPTION 'Only approvers can view user roles';
  END IF;
  RETURN QUERY
  SELECT ur.user_id, p.email, ur.role, ur.created_at
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  ORDER BY p.email;
END;
$$;