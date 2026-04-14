
-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop old tables (replaced by new schema)
DROP TABLE IF EXISTS public.exercise_progress CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Table: courses
CREATE TABLE public.courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enrollment_open BOOLEAN NOT NULL DEFAULT true,
  max_participants INTEGER NOT NULL DEFAULT 30,
  default_key_budget DECIMAL NOT NULL DEFAULT 5.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Table: enrollment_whitelist
CREATE TABLE public.enrollment_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(email, course_id)
);
ALTER TABLE public.enrollment_whitelist ENABLE ROW LEVEL SECURITY;

-- Table: user_profiles
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  auth_method TEXT NOT NULL DEFAULT 'email_otp',
  course_id TEXT REFERENCES public.courses(id),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Table: user_roles (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Table: guest_tokens
CREATE TABLE public.guest_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  course_id TEXT NOT NULL REFERENCES public.courses(id),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  upgraded_to_email TEXT
);
ALTER TABLE public.guest_tokens ENABLE ROW LEVEL SECURITY;

-- Table: user_progress
CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  completed_lessons TEXT[] NOT NULL DEFAULT '{}',
  quiz_scores JSONB NOT NULL DEFAULT '{}',
  challenge_cards_completed TEXT[] NOT NULL DEFAULT '{}',
  werkstatt_progress JSONB NOT NULL DEFAULT '{}',
  last_visited TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Table: user_projects
CREATE TABLE public.user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  project_type TEXT,
  dataset_ref TEXT,
  pipeline_config JSONB NOT NULL DEFAULT '{}',
  trained_models JSONB NOT NULL DEFAULT '{}',
  evaluation_results JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

-- Table: user_api_keys
CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  provisioned_key_encrypted TEXT,
  provisioned_key_budget DECIMAL NOT NULL DEFAULT 5.00,
  provisioned_key_status TEXT NOT NULL DEFAULT 'active',
  custom_key_encrypted TEXT,
  custom_key_active BOOLEAN NOT NULL DEFAULT false,
  active_key_source TEXT NOT NULL DEFAULT 'provisioned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies

-- courses: public read, admin write
CREATE POLICY "Anyone can read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update courses" ON public.courses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete courses" ON public.courses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- enrollment_whitelist: admin only
CREATE POLICY "Admins can manage whitelist" ON public.enrollment_whitelist FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_profiles: own profile + admin read all
CREATE POLICY "Users can read own profile" ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles: admin manage, users read own
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- guest_tokens: admin only
CREATE POLICY "Admins can manage guest tokens" ON public.guest_tokens FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_progress: own data only
CREATE POLICY "Users can manage own progress" ON public.user_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_projects: own data only
CREATE POLICY "Users can manage own projects" ON public.user_projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_api_keys: own data, read only non-encrypted fields (enforced at app level)
CREATE POLICY "Users can read own api keys" ON public.user_api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own api keys" ON public.user_api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own api keys" ON public.user_api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Trigger: auto-create profile + progress on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, auth_method)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'auth_method', 'email_otp')
  );
  INSERT INTO public.user_progress (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
