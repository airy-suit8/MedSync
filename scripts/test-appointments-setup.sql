-- ========================================
-- TEST APPOINTMENTS SETUP
-- ========================================
-- This script tests if the appointments system is working correctly

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
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;

-- 3. Check if there are any doctors
SELECT 
    'Doctors count:' as info,
    COUNT(*) as total_doctors
FROM public.doctors;

-- 4. Check if there are any patients
SELECT 
    'Patients count:' as info,
    COUNT(*) as total_patients
FROM public.patients;

-- 5. Check if there are any appointments
SELECT 
    'Appointments count:' as info,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN appointment_date = CURRENT_DATE THEN 1 END) as today_appointments,
    COUNT(CASE WHEN appointment_date > CURRENT_DATE THEN 1 END) as future_appointments
FROM public.appointments;

-- 6. Show sample appointments for today
SELECT 
    'Today\'s appointments:' as info,
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

-- 7. Check doctor-patient relationships
SELECT 
    'Doctor-patient relationships:' as info,
    d.name as doctor_name,
    p.name as patient_name,
    COUNT(a.id) as appointment_count
FROM public.doctors d
LEFT JOIN public.appointments a ON d.id = a.doctor_id
LEFT JOIN public.patients p ON a.patient_id = p.id
GROUP BY d.id, d.name, p.id, p.name
ORDER BY appointment_count DESC;

-- 8. Test appointment creation
DO $$
DECLARE
    doctor_uuid UUID;
    patient_uuid UUID;
    appointment_uuid UUID;
BEGIN
    -- Get a doctor
    SELECT id INTO doctor_uuid FROM public.doctors LIMIT 1;
    
    -- Get a patient
    SELECT id INTO patient_uuid FROM public.patients LIMIT 1;
    
    -- Create a test appointment
    IF doctor_uuid IS NOT NULL AND patient_uuid IS NOT NULL THEN
        INSERT INTO public.appointments (
            doctor_id,
            patient_id,
            patient_name,
            doctor_name,
            appointment_date,
            start_time,
            end_time,
            consultation_type,
            status,
            symptoms
        )
        SELECT 
            d.id,
            p.id,
            p.name,
            d.name,
            CURRENT_DATE + INTERVAL '2 days',
            '15:00:00',
            '15:30:00',
            'video',
            'scheduled',
            'Test appointment for verification'
        FROM public.doctors d, public.patients p
        WHERE d.id = doctor_uuid AND p.id = patient_uuid
        RETURNING id INTO appointment_uuid;
        
        RAISE NOTICE 'Test appointment created with ID: %', appointment_uuid;
    ELSE
        RAISE NOTICE 'Cannot create test appointment: missing doctor or patient';
    END IF;
END $$;

-- 9. Show final appointment count
SELECT 
    'Final appointments count:' as info,
    COUNT(*) as total_appointments
FROM public.appointments;
