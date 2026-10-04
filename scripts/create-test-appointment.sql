-- Create Test Appointment Script
-- This script creates a test appointment for today to verify the system works

-- First, let's get a doctor ID to use
DO $$
DECLARE
    doctor_uuid UUID;
    patient_uuid UUID;
BEGIN
    -- Get the first available doctor
    SELECT id INTO doctor_uuid 
    FROM public.doctors 
    LIMIT 1;
    
    -- Get the first available patient (or use doctor as patient for testing)
    SELECT id INTO patient_uuid 
    FROM public.patients 
    LIMIT 1;
    
    -- If no patient exists, use the doctor as patient for testing
    IF patient_uuid IS NULL THEN
        patient_uuid := doctor_uuid;
    END IF;
    
    -- Create a test appointment for today
    INSERT INTO public.appointments (
        doctor_id,
        patient_id,
        patient_name,
        doctor_name,
        appointment_date,
        start_time,
        end_time,
        duration_minutes,
        appointment_type,
        status,
        notes,
        scheduled_at
    ) VALUES (
        doctor_uuid,
        patient_uuid,
        'Test Patient',
        (SELECT name FROM public.doctors WHERE id = doctor_uuid),
        CURRENT_DATE,
        '10:00:00',
        '10:30:00',
        30,
        'consultation',
        'scheduled',
        'Test appointment created by debug script',
        CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE 'Test appointment created for doctor_id: %, patient_id: %, date: %', 
        doctor_uuid, patient_uuid, CURRENT_DATE;
        
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating test appointment: %', SQLERRM;
END $$;

-- Verify the appointment was created
SELECT 
    'test_appointment_verification' as check_type,
    id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    status,
    created_at
FROM public.appointments
WHERE notes = 'Test appointment created by debug script'
ORDER BY created_at DESC
LIMIT 5;
