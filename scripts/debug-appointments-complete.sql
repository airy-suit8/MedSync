-- ========================================
-- COMPLETE APPOINTMENTS DIAGNOSTIC
-- ========================================
-- This script checks everything to diagnose why appointments aren't loading

-- 1. Check if tables exist
SELECT 
    'Table existence check:' as check_type,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') as appointments_table_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctors') as doctors_table_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients') as patients_table_exists;

-- 2. Check table structures
SELECT 
    'Appointments table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;

-- 3. Check if there are any doctors
SELECT 
    'Doctors count:' as info,
    COUNT(*) as total_doctors
FROM public.doctors;

-- 4. Show all doctors with their user_ids
SELECT 
    'All doctors:' as info,
    id,
    user_id,
    name,
    specialty,
    email,
    created_at
FROM public.doctors
ORDER BY created_at;

-- 5. Check if there are any patients
SELECT 
    'Patients count:' as info,
    COUNT(*) as total_patients
FROM public.patients;

-- 6. Show all patients
SELECT 
    'All patients:' as info,
    id,
    user_id,
    name,
    email,
    created_at
FROM public.patients
ORDER BY created_at;

-- 7. Check if there are any appointments
SELECT 
    'Appointments count:' as info,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN appointment_date = CURRENT_DATE THEN 1 END) as today_appointments,
    COUNT(CASE WHEN appointment_date > CURRENT_DATE THEN 1 END) as future_appointments
FROM public.appointments;

-- 8. Show all appointments with details
SELECT 
    'All appointments:' as info,
    id,
    doctor_id,
    patient_id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    end_time,
    consultation_type,
    status,
    symptoms,
    created_at
FROM public.appointments
ORDER BY appointment_date, start_time;

-- 9. Check doctor-patient relationships
SELECT 
    'Doctor-patient relationships:' as info,
    d.id as doctor_id,
    d.name as doctor_name,
    d.user_id as doctor_user_id,
    p.id as patient_id,
    p.name as patient_name,
    p.user_id as patient_user_id,
    COUNT(a.id) as appointment_count
FROM public.doctors d
LEFT JOIN public.appointments a ON d.id = a.doctor_id
LEFT JOIN public.patients p ON a.patient_id = p.id
GROUP BY d.id, d.name, d.user_id, p.id, p.name, p.user_id
ORDER BY appointment_count DESC;

-- 10. Check current user authentication
SELECT 
    'Current auth users:' as info,
    id,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'name' as name,
    created_at
FROM auth.users
WHERE raw_user_meta_data->>'role' IN ('doctor', 'patient')
ORDER BY created_at;

-- 11. Test appointment query for a specific doctor
DO $$
DECLARE
    test_doctor_id UUID;
    test_doctor_user_id UUID;
    appointment_count INTEGER;
BEGIN
    -- Get the first doctor
    SELECT id, user_id INTO test_doctor_id, test_doctor_user_id 
    FROM public.doctors 
    LIMIT 1;
    
    IF test_doctor_id IS NOT NULL THEN
        RAISE NOTICE 'Testing with doctor ID: %, user_id: %', test_doctor_id, test_doctor_user_id;
        
        -- Count appointments for this doctor
        SELECT COUNT(*) INTO appointment_count
        FROM public.appointments
        WHERE doctor_id = test_doctor_id;
        
        RAISE NOTICE 'Appointments for doctor %: %', test_doctor_id, appointment_count;
        
        -- Show appointments for today
        SELECT COUNT(*) INTO appointment_count
        FROM public.appointments
        WHERE doctor_id = test_doctor_id 
        AND appointment_date >= CURRENT_DATE;
        
        RAISE NOTICE 'Today''s appointments for doctor %: %', test_doctor_id, appointment_count;
        
    ELSE
        RAISE NOTICE 'No doctors found in the database';
    END IF;
END $$;

-- 12. Check for any constraint issues
SELECT 
    'Table constraints:' as info,
    table_name,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name IN ('appointments', 'doctors', 'patients')
ORDER BY table_name, constraint_name;

-- 13. Check RLS status
SELECT 
    'RLS status:' as info,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('appointments', 'doctors', 'patients')
AND schemaname = 'public';

-- 14. Check permissions
SELECT 
    'Permissions:' as info,
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges 
WHERE table_name IN ('appointments', 'doctors', 'patients')
AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, privilege_type;
