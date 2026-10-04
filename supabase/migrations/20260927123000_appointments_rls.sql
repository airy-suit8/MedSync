-- Migration to add RLS policies for the appointments table

-- 1. Doctors can read their own appointments
CREATE POLICY "appointments_doctor_select"
ON public.appointments
FOR SELECT TO authenticated
USING (doctor_id = auth.uid());

-- 2. Patients can read their own appointments
CREATE POLICY "appointments_patient_select"
ON public.appointments
FOR SELECT TO authenticated
USING (patient_id = auth.uid());

-- 3. Doctors can insert appointments for themselves
CREATE POLICY "appointments_doctor_insert"
ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (doctor_id = auth.uid() AND public.get_auth_role() = 'doctor');

-- 4. Patients can insert appointments for themselves
CREATE POLICY "appointments_patient_insert"
ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid() AND public.get_auth_role() = 'patient');

-- 5. Doctors can update their own appointments
CREATE POLICY "appointments_doctor_update"
ON public.appointments
FOR UPDATE TO authenticated
USING (doctor_id = auth.uid())
WITH CHECK (doctor_id = auth.uid());

-- 6. Doctors can insert doctor_patient_assignments
CREATE POLICY "doctor_patient_assignments_doctor_insert"
ON public.doctor_patient_assignments
FOR INSERT TO authenticated
WITH CHECK (doctor_id = auth.uid() AND public.get_auth_role() = 'doctor');

-- 7. Doctors can update doctor_patient_assignments
CREATE POLICY "doctor_patient_assignments_doctor_update"
ON public.doctor_patient_assignments
FOR UPDATE TO authenticated
USING (doctor_id = auth.uid())
WITH CHECK (doctor_id = auth.uid() AND public.get_auth_role() = 'doctor');

-- 8. Anyone can insert notifications
CREATE POLICY "Anyone can insert notifications"
ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (true);
