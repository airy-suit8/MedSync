-- Migration D: Create audit_logs table

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete')),
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs" 
ON public.audit_logs FOR SELECT 
USING (public.get_auth_role() = 'admin');

CREATE POLICY "Users can insert their own audit logs" 
ON public.audit_logs FOR INSERT 
WITH CHECK (auth.uid() = actor_id);
