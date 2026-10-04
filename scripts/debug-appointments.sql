-- Debug Appointments Script
-- This script helps diagnose why appointments aren't showing up in the dashboard

-- 1. Check if appointments table exists and has data
SELECT 
    'appointments_table_check' as check_type,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN appointment_date = CURRENT_DATE THEN 1 END) as today_appointments,
    COUNT(CASE WHEN appointment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as this_month_appointments
FROM public.appointments;

-- 2. Show all appointments with their dates
SELECT 
    id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    status,
    created_at
FROM public.appointments
ORDER BY appointment_date DESC, start_time ASC
LIMIT 20;

-- 3. Check today's appointments specifically
SELECT 
    'today_appointments' as check_type,
    id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    status
FROM public.appointments
WHERE appointment_date = CURRENT_DATE
ORDER BY start_time ASC;

-- 4. Check appointments for the current month
SELECT 
    'month_appointments' as check_type,
    appointment_date,
    COUNT(*) as appointment_count
FROM public.appointments
WHERE appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY appointment_date
ORDER BY appointment_date;

-- 5. Check if there are any appointments with different date formats
SELECT 
    'date_format_check' as check_type,
    appointment_date,
    pg_typeof(appointment_date) as date_type,
    TO_CHAR(appointment_date, 'YYYY-MM-DD') as formatted_date,
    COUNT(*) as count
FROM public.appointments
GROUP BY appointment_date, pg_typeof(appointment_date)
ORDER BY appointment_date;

-- 6. Check doctor assignments
SELECT 
    'doctor_assignments' as check_type,
    d.id as doctor_id,
    d.name as doctor_name,
    COUNT(a.id) as appointment_count
FROM public.doctors d
LEFT JOIN public.appointments a ON d.id = a.doctor_id
GROUP BY d.id, d.name
ORDER BY appointment_count DESC;

-- 7. Check current date format
SELECT 
    'current_date_check' as check_type,
    CURRENT_DATE as current_date,
    CURRENT_DATE::text as current_date_text,
    TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') as formatted_date;
