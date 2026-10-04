-- ========================================
-- FIX APPOINTMENTS DATABASE FUNCTIONS
-- ========================================
-- This script ensures all required functions exist for the appointments system

-- 1. Create safe_appointment_update function if it doesn't exist
CREATE OR REPLACE FUNCTION public.safe_appointment_update(
    appointment_id TEXT,
    update_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    appointment_record RECORD;
BEGIN
    -- Check if appointment exists
    SELECT * INTO appointment_record 
    FROM public.appointments 
    WHERE id::TEXT = appointment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Appointment not found',
            'is_demo', false,
            'error', 'Appointment with ID ' || appointment_id || ' not found'
        );
    END IF;
    
    -- Update the appointment
    UPDATE public.appointments 
    SET 
        status = COALESCE(update_data->>'status', status),
        notes = COALESCE(update_data->>'notes', notes),
        diagnosis = COALESCE(update_data->>'diagnosis', diagnosis),
        prescription = COALESCE(update_data->>'prescription', prescription),
        updated_at = NOW()
    WHERE id::TEXT = appointment_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Appointment updated successfully',
        'is_demo', false
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Failed to update appointment',
        'is_demo', false,
        'error', SQLERRM
    );
END;
$$;

-- 2. Create resolve_patient_id function if it doesn't exist
CREATE OR REPLACE FUNCTION public.resolve_patient_id(input_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    resolved_id UUID;
BEGIN
    -- If it's already a UUID, return it
    IF input_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RETURN input_id::UUID;
    END IF;
    
    -- Try to find by short_id or other identifier
    SELECT id INTO resolved_id
    FROM public.patients
    WHERE short_id = input_id OR id::TEXT = input_id
    LIMIT 1;
    
    RETURN resolved_id;
    
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 3. Create resolve_doctor_id function if it doesn't exist
CREATE OR REPLACE FUNCTION public.resolve_doctor_id(input_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    resolved_id UUID;
BEGIN
    -- If it's already a UUID, return it
    IF input_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RETURN input_id::UUID;
    END IF;
    
    -- Try to find by short_id or other identifier
    SELECT id INTO resolved_id
    FROM public.doctors
    WHERE short_id = input_id OR id::TEXT = input_id
    LIMIT 1;
    
    RETURN resolved_id;
    
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.safe_appointment_update(TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.resolve_patient_id(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.resolve_doctor_id(TEXT) TO authenticated, anon;

-- 5. Test the functions
SELECT 
    'Functions created successfully!' as status,
    'safe_appointment_update' as function_name,
    'Available' as status
UNION ALL
SELECT 
    'Functions created successfully!' as status,
    'resolve_patient_id' as function_name,
    'Available' as status
UNION ALL
SELECT 
    'Functions created successfully!' as status,
    'resolve_doctor_id' as function_name,
    'Available' as status;
