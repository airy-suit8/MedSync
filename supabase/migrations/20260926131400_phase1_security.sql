-- 1. Create a secure, read-only user_roles table to determine role (Step 4)
CREATE TABLE public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'lab', 'admin'))
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user_roles" 
ON public.user_roles FOR SELECT USING (true);

-- Seed user_roles from existing public.users
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, u.role FROM public.users u
JOIN auth.users a ON u.id = a.id
WHERE u.role IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_short_id()
RETURNS TEXT AS $$
  SELECT short_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 2. Enable RLS on required tables (Step 1)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_patient_assignments ENABLE ROW LEVEL SECURITY;

-- 3. Revoke blanket GRANT ALL TO anon (Step 2)
REVOKE ALL ON public.reports FROM anon;

-- 4. Create RLS Policies (Step 3)

-- ==========================
-- REPORTS POLICIES
-- ==========================
CREATE POLICY "Patient can read own reports" 
ON public.reports FOR SELECT 
USING (
  public.get_auth_role() = 'patient' AND 
  (patient_id = auth.uid()::text OR patient_id = public.get_auth_short_id())
);

CREATE POLICY "Doctor can read assigned patient reports"
ON public.reports FOR SELECT
USING (
  public.get_auth_role() = 'doctor' AND
  EXISTS (
       SELECT 1 FROM public.doctor_patient_assignments dpa
       WHERE dpa.doctor_id = auth.uid() 
         AND dpa.is_active = true
         AND (
           dpa.patient_id::text = reports.patient_id 
           OR 
           dpa.patient_id = (SELECT id FROM public.users u WHERE u.short_id = reports.patient_id LIMIT 1)
         )
  )
);

CREATE POLICY "Lab can insert reports"
ON public.reports FOR INSERT
WITH CHECK (
  public.get_auth_role() = 'lab' AND uploaded_by = auth.uid()
);

CREATE POLICY "Lab can read own uploaded reports"
ON public.reports FOR SELECT
USING (
  public.get_auth_role() = 'lab' AND uploaded_by = auth.uid()
);


-- ==========================
-- ML_SUGGESTIONS POLICIES
-- ==========================
CREATE POLICY "Patient can read own ml_suggestions"
ON public.ml_suggestions FOR SELECT
USING (
  public.get_auth_role() = 'patient' AND 
  (patient_id = auth.uid()::text OR patient_id = public.get_auth_short_id())
);

CREATE POLICY "Doctor can read assigned patient ml_suggestions"
ON public.ml_suggestions FOR SELECT
USING (
  public.get_auth_role() = 'doctor' AND
  EXISTS (
       SELECT 1 FROM public.doctor_patient_assignments dpa
       WHERE dpa.doctor_id = auth.uid() 
         AND dpa.is_active = true
         AND (
           dpa.patient_id::text = ml_suggestions.patient_id 
           OR 
           dpa.patient_id = (SELECT id FROM public.users u WHERE u.short_id = ml_suggestions.patient_id LIMIT 1)
         )
  )
);


-- ==========================
-- NOTIFICATIONS POLICIES
-- ==========================
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
USING (
  user_id = auth.uid()
);


-- ==========================
-- USERS POLICIES
-- ==========================
CREATE POLICY "Anyone can read users"
ON public.users FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());


-- ==========================
-- DOCTOR_PATIENT_ASSIGNMENTS POLICIES
-- ==========================
CREATE POLICY "Doctor can read own assignments"
ON public.doctor_patient_assignments FOR SELECT
USING (doctor_id = auth.uid());

CREATE POLICY "Patient can read own assignments"
ON public.doctor_patient_assignments FOR SELECT
USING (patient_id = auth.uid());
