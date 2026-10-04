-- ========================================
-- TEST APPOINTMENTS WORKING
-- ========================================
-- This script tests if the appointments system is working correctly

-- 1. Check if tables exist and have data
SELECT 
    'Table existence and data check:' as check_type,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') as appointments_table_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctors') as doctors_table_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients') as patients_table_exists,
    (SELECT COUNT(*) FROM public.appointments) as appointments_count,
    (SELECT COUNT(*) FROM public.doctors) as doctors_count,
    (SELECT COUNT(*) FROM public.patients) as patients_count;

-- 2. Show all doctors with their user_ids
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

-- 3. Show all patients
SELECT 
    'All patients:' as info,
    id,
    user_id,
    name,
    email,
    created_at
FROM public.patients
ORDER BY created_at;

-- 4. Show all appointments
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

-- 5. Show today's appointments
SELECT 
    'Today''s appointments:' as info,
    id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    end_time,
    consultation_type,
    status
FROM public.appointments
WHERE appointment_date = CURRENT_DATE
ORDER BY start_time;

-- 6. Test the appointment update function
DO $$
DECLARE
    test_appointment_id TEXT;
    update_result JSONB;
BEGIN
    -- Get the first appointment
    SELECT id::TEXT INTO test_appointment_id
    FROM public.appointments
    LIMIT 1;
    
    IF test_appointment_id IS NOT NULL THEN
        -- Test the update function
        SELECT public.safe_appointment_update(
            test_appointment_id,
            '{"status": "completed", "notes": "Test update"}'
        ) INTO update_result;
        
        RAISE NOTICE 'Update test result: %', update_result;
    ELSE
        RAISE NOTICE 'No appointments found to test update function';
    END IF;
END $$;

-- 7. Show current date for reference
SELECT 
    'Current date:' as info,
    CURRENT_DATE as today,
    CURRENT_TIMESTAMP as now;

-- 8. Test appointment queries for a specific doctor
DO $$
DECLARE
    test_doctor_id UUID;
    appointment_count INTEGER;
BEGIN
    -- Get the first doctor
    SELECT id INTO test_doctor_id 
    FROM public.doctors 
    LIMIT 1;
    
    IF test_doctor_id IS NOT NULL THEN
        -- Count appointments for this doctor
        SELECT COUNT(*) INTO appointment_count
        FROM public.appointments
        WHERE doctor_id = test_doctor_id;
        
        RAISE NOTICE 'Appointments for doctor %: %', test_doctor_id, appointment_count;
        
        -- Show appointments for today
        SELECT COUNT(*) INTO appointment_count
        FROM public.appointments
        WHERE doctor_id = test_doctor_id 
        AND appointment_date = CURRENT_DATE;
        
        RAISE NOTICE 'Today''s appointments for doctor %: %', test_doctor_id, appointment_count;
        
    ELSE
        RAISE NOTICE 'No doctors found in the database';
    END IF;
END $$;
