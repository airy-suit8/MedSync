SET local check_function_bodies = off;

CREATE TABLE "public"."appointments" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "doctor_id"         uuid                     NOT NULL,
  "patient_id"        uuid                     NOT NULL,
  "patient_name"      text                     DEFAULT 'Patient'::text,
  "doctor_name"       text                     DEFAULT 'Doctor'::text,
  "appointment_date"  date                     NOT NULL,
  "start_time"        time without time zone   NOT NULL,
  "end_time"          time without time zone   NOT NULL,
  "duration_minutes"  integer                  DEFAULT 30,
  "appointment_type"  text                     DEFAULT 'consultation'::text,
  "status"            text                     DEFAULT 'scheduled'::text,
  "notes"             text,
  "scheduled_at"      timestamp with time zone DEFAULT now(),
  "created_at"        timestamp with time zone DEFAULT now(),
  "updated_at"        timestamp with time zone DEFAULT now(),
  "type"              character varying(50),
  "completed_at"      timestamp with time zone,
  "diagnosis"         text,
  "prescription"      text,
  "is_demo"           boolean                  DEFAULT false,
  "consultation_type" text                     DEFAULT 'video'::text,
  "symptoms"          text,
  CONSTRAINT "appointments_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."chat_channels" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"         text                     NOT NULL,
  "channel_type" text                     DEFAULT 'general'::text,
  "participants" uuid[]                   NOT NULL,
  "created_by"   uuid,
  "is_active"    boolean                  DEFAULT true,
  "created_at"   timestamp with time zone DEFAULT now(),
  "updated_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "chat_channels_channel_type_check" CHECK ((channel_type = ANY (ARRAY['general'::text, 'doctor_patient'::text, 'team'::text, 'support'::text]))),
  CONSTRAINT "chat_channels_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."chat_messages" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "channel_id"      uuid,
  "sender_id"       uuid,
  "sender_name"     text                     NOT NULL,
  "sender_role"     text                     NOT NULL,
  "content"         text                     NOT NULL,
  "message_type"    text                     DEFAULT 'text'::text,
  "attachment_url"  text,
  "attachment_name" text,
  "is_read"         boolean                  DEFAULT false,
  "created_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "chat_messages_message_type_check" CHECK ((message_type = ANY (ARRAY['text'::text, 'file'::text, 'image'::text, 'system'::text]))),
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."chat_notifications" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "user_id"         uuid                     NOT NULL,
  "sender_id"       uuid                     NOT NULL,
  "message_preview" text,
  "unread_count"    integer                  DEFAULT 1,
  "last_message_at" timestamp with time zone DEFAULT now(),
  "created_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "chat_notifications_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."consultation_meetings" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "appointment_id" uuid                     NOT NULL,
  "meeting_id"     text                     NOT NULL,
  "password"       text                     NOT NULL,
  "host_id"        uuid                     NOT NULL,
  "is_active"      boolean                  DEFAULT true,
  "created_at"     timestamp with time zone DEFAULT now(),
  "updated_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "consultation_meetings_pkey" PRIMARY KEY (id),
  CONSTRAINT "unique_meeting_per_appointment" UNIQUE (appointment_id)
);

CREATE TABLE "public"."doctor_availability" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "doctor_id"    uuid                     NOT NULL,
  "day_of_week"  integer                  NOT NULL,
  "start_time"   time without time zone   NOT NULL,
  "end_time"     time without time zone   NOT NULL,
  "is_available" boolean                  DEFAULT true,
  "created_at"   timestamp with time zone DEFAULT now(),
  "updated_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "doctor_availability_day_of_week_check" CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
  CONSTRAINT "doctor_availability_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."doctor_patient_assignments" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "doctor_id"   uuid                     NOT NULL,
  "patient_id"  uuid                     NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now(),
  "assigned_by" uuid,
  "is_active"   boolean                  DEFAULT true,
  "notes"       text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "doctor_patient_assignments_doctor_id_patient_id_is_active_key" UNIQUE (doctor_id, patient_id, is_active),
  CONSTRAINT "doctor_patient_assignments_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."doctors" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        uuid                     NOT NULL,
  "name"           text                     NOT NULL,
  "specialty"      text                     DEFAULT 'General Medicine'::text,
  "license_number" text,
  "phone"          text,
  "address"        text,
  "created_at"     timestamp with time zone DEFAULT now(),
  "updated_at"     timestamp with time zone DEFAULT now(),
  "email"          text,
  CONSTRAINT "doctors_pkey" PRIMARY KEY (id),
  CONSTRAINT "doctors_user_id_unique" UNIQUE (user_id)
);

CREATE TABLE "public"."labs" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "user_id"         uuid,
  "name"            text                     NOT NULL,
  "lab_name"        text,
  "certification"   text,
  "address"         text,
  "lab_type"        text,
  "equipment_list"  text[],
  "operating_hours" jsonb,
  "created_at"      timestamp with time zone DEFAULT now(),
  "updated_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "labs_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."medical_records" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "patient_id"   uuid,
  "doctor_id"    uuid,
  "record_type"  text                     NOT NULL,
  "title"        text                     NOT NULL,
  "description"  text,
  "diagnosis"    text,
  "treatment"    text,
  "prescription" text,
  "notes"        text,
  "attachments"  text[],
  "status"       text                     DEFAULT 'active'::text,
  "created_at"   timestamp with time zone DEFAULT now(),
  "updated_at"   timestamp with time zone DEFAULT now(),
  "priority"     character varying(20)    DEFAULT 'normal'::character varying,
  "record_date"  date                     DEFAULT CURRENT_DATE,
  "file_url"     text,
  "metadata"     jsonb,
  CONSTRAINT "medical_records_pkey" PRIMARY KEY (id),
  CONSTRAINT "medical_records_record_type_check"
    CHECK ((record_type = ANY (ARRAY['consultation'::text, 'lab_result'::text, 'imaging'::text, 'prescription'::text, 'vaccination'::text, 'surgery'::text]))),
  CONSTRAINT "medical_records_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);

CREATE TABLE "public"."medical_reports" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "patient_id"      uuid,
  "doctor_id"       uuid,
  "lab_id"          uuid,
  "report_type"     text                     NOT NULL,
  "title"           text                     NOT NULL,
  "description"     text,
  "file_url"        text,
  "file_type"       text,
  "file_size"       integer,
  "ai_summary"      text,
  "ai_confidence"   numeric(3,2),
  "status"          text                     DEFAULT 'pending'::text,
  "priority"        text                     DEFAULT 'normal'::text,
  "findings"        text,
  "recommendations" text,
  "created_at"      timestamp with time zone DEFAULT now(),
  "updated_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "medical_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "medical_reports_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
  CONSTRAINT "medical_reports_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'urgent'::text, 'completed'::text])))
);

CREATE TABLE "public"."message_threads" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "title"           text,
  "thread_type"     text                     DEFAULT 'general'::text,
  "participants"    uuid[]                   NOT NULL,
  "last_message_id" uuid,
  "last_activity"   timestamp with time zone DEFAULT now(),
  "is_active"       boolean                  DEFAULT true,
  "created_at"      timestamp with time zone DEFAULT now(),
  "updated_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "message_threads_pkey" PRIMARY KEY (id),
  CONSTRAINT "message_threads_thread_type_check"
    CHECK ((thread_type = ANY (ARRAY['general'::text, 'report_discussion'::text, 'appointment_coordination'::text, 'emergency'::text])))
);

CREATE TABLE "public"."messages" (
  "id"                     uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "content"                text                     NOT NULL,
  "sender_id"              uuid                     NOT NULL,
  "sender_name"            text                     NOT NULL,
  "sender_role"            text                     NOT NULL,
  "receiver_id"            uuid                     NOT NULL,
  "receiver_name"          text                     NOT NULL,
  "receiver_role"          text                     NOT NULL,
  "message_type"           text                     DEFAULT 'text'::text,
  "subject"                text,
  "attachment_url"         text,
  "attachment_type"        text,
  "attachment_name"        text,
  "is_read"                boolean                  DEFAULT false,
  "is_urgent"              boolean                  DEFAULT false,
  "related_report_id"      uuid,
  "related_appointment_id" uuid,
  "created_at"             timestamp with time zone DEFAULT now(),
  "updated_at"             timestamp with time zone DEFAULT now(),
  CONSTRAINT "messages_message_type_check" CHECK ((message_type = ANY (ARRAY['text'::text, 'file'::text, 'image'::text, 'system'::text, 'notification'::text]))),
  CONSTRAINT "messages_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."ml_suggestions" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "report_id"       uuid,
  "patient_id"      text                     NOT NULL,
  "test_type"       text                     NOT NULL,
  "findings"        text                     NOT NULL,
  "confidence"      numeric(3,2)             NOT NULL,
  "recommendations" text,
  "severity"        text,
  "status"          text                     DEFAULT 'pending_review'::text,
  "reviewed_by"     uuid,
  "reviewed_at"     timestamp with time zone,
  "doctor_notes"    text,
  "processed_at"    timestamp with time zone DEFAULT now(),
  "created_at"      timestamp with time zone DEFAULT now(),
  "updated_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "ml_suggestions_pkey" PRIMARY KEY (id),
  CONSTRAINT "ml_suggestions_severity_check" CHECK ((severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text, 'critical'::text, 'unknown'::text]))),
  CONSTRAINT "ml_suggestions_status_check" CHECK ((status = ANY (ARRAY['pending_review'::text, 'reviewed'::text, 'accepted'::text, 'rejected'::text])))
);

CREATE TABLE "public"."notifications" (
  "id"                uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "user_id"           uuid                     NOT NULL,
  "title"             text                     NOT NULL,
  "message"           text                     NOT NULL,
  "notification_type" text                     NOT NULL,
  "is_read"           boolean                  DEFAULT false,
  "is_urgent"         boolean                  DEFAULT false,
  "related_id"        uuid,
  "related_type"      text,
  "action_url"        text,
  "created_at"        timestamp with time zone DEFAULT now(),
  "type"              text,
  "target_role"       text,
  "data"              jsonb                    DEFAULT '{}'::jsonb,
  CONSTRAINT "notifications_notification_type_check"
    CHECK
    ((notification_type = ANY (ARRAY['appointment_reminder'::text, 'test_result'::text, 'prescription_update'::text, 'emergency_alert'::text, 'system_notification'::text,
    'ml_suggestion'::text, 'report_upload'::text, 'consultation_request'::text, 'payment_reminder'::text, 'general'::text]))),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."patient_profiles" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"            uuid,
  "full_name"          text,
  "date_of_birth"      date,
  "age"                integer,
  "gender"             text,
  "phone_number"       text,
  "address"            text,
  "medical_history"    text,
  "ongoing_treatments" text,
  "family_history"     text,
  "allergies"          text,
  "emergency_contact"  text,
  "blood_type"         text,
  "height"             text,
  "weight"             text,
  "created_at"         timestamp with time zone DEFAULT now(),
  "updated_at"         timestamp with time zone DEFAULT now(),
  "short_id"           text,
  "name"               text,
  "email"              text,
  "phone"              text,
  "medications"        text[],
  CONSTRAINT "patient_profiles_blood_type_check"
    CHECK ((blood_type = ANY (ARRAY['A+'::text, 'A-'::text, 'B+'::text, 'B-'::text, 'AB+'::text, 'AB-'::text, 'O+'::text, 'O-'::text]))),
  CONSTRAINT "patient_profiles_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text]))),
  CONSTRAINT "patient_profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "patient_profiles_short_id_key" UNIQUE (short_id),
  CONSTRAINT "patient_profiles_user_id_unique" UNIQUE (user_id)
);

CREATE TABLE "public"."patients" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             uuid,
  "name"                text                     NOT NULL,
  "date_of_birth"       date,
  "gender"              text,
  "phone"               text,
  "address"             text,
  "emergency_contact"   text,
  "created_at"          timestamp with time zone DEFAULT now(),
  "updated_at"          timestamp with time zone DEFAULT now(),
  "email"               character varying(255),
  "blood_type"          character varying(5),
  "height_cm"           numeric(5,2),
  "weight_kg"           numeric(5,2),
  "chronic_conditions"  text,
  "current_medications" text,
  "allergies"           text,
  "insurance_provider"  character varying(255),
  "insurance_number"    character varying(255),
  CONSTRAINT "patients_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
  CONSTRAINT "patients_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."reports" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "patient_id"          text                     NOT NULL,
  "test_type"           text                     NOT NULL,
  "original_name"       text                     NOT NULL,
  "file_name"           text                     NOT NULL,
  "original_image_url"  text,
  "overlayed_image_url" text,
  "masked_image_url"    text,
  "result"              jsonb,
  "patient_info"        jsonb,
  "notes"               text,
  "priority"            text                     DEFAULT 'normal'::text,
  "uploaded_by"         uuid,
  "uploaded_at"         timestamp with time zone DEFAULT now(),
  "created_at"          timestamp with time zone DEFAULT now(),
  "updated_at"          timestamp with time zone DEFAULT now(),
  "doctor_id"           uuid,
  CONSTRAINT "reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "reports_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text, 'critical'::text])))
);

CREATE TABLE "public"."typing_status" (
  "id"             uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "user_id"        uuid                     NOT NULL,
  "receiver_id"    uuid                     NOT NULL,
  "is_typing"      boolean                  DEFAULT false,
  "last_typing_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "typing_status_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."user_short_ids" (
  "user_id"    uuid                     NOT NULL,
  "short_id"   text                     NOT NULL,
  "role"       text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_short_ids_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "user_short_ids_short_id_key" UNIQUE (short_id)
);

CREATE TABLE "public"."users" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auth_id"    uuid                     NOT NULL,
  "email"      text                     NOT NULL,
  "name"       text                     NOT NULL,
  "role"       text                     NOT NULL,
  "specialty"  text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "online"     boolean                  DEFAULT false,
  "last_seen"  timestamp with time zone DEFAULT now(),
  "short_id"   text,
  CONSTRAINT "users_auth_id_unique" UNIQUE (auth_id),
  CONSTRAINT "users_email_key" UNIQUE (email),
  CONSTRAINT "users_pkey" PRIMARY KEY (id),
  CONSTRAINT "users_role_check" CHECK ((role = ANY (ARRAY['doctor'::text, 'patient'::text, 'lab'::text, 'admin'::text]))),
  CONSTRAINT "users_short_id_key" UNIQUE (short_id)
);

CREATE TABLE "public"."video_call_logs" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "session_id" uuid,
  "user_id"    uuid,
  "action"     character varying(50),
  "timestamp"  timestamp with time zone DEFAULT now(),
  "metadata"   jsonb,
  CONSTRAINT "video_call_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."video_call_messages" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "session_id"   uuid,
  "sender_id"    uuid,
  "sender_role"  character varying(20),
  "message"      text,
  "message_type" character varying(20)    DEFAULT 'text'::character varying,
  "timestamp"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "video_call_messages_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."video_call_sessions" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "appointment_id" uuid,
  "doctor_id"      uuid,
  "patient_id"     uuid,
  "session_start"  timestamp with time zone DEFAULT now(),
  "session_end"    timestamp with time zone,
  "status"         character varying(20)    DEFAULT 'active'::character varying,
  "meeting_id"     character varying(255),
  "recording_url"  text,
  "notes"          text,
  "created_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "video_call_sessions_pkey" PRIMARY KEY (id)
);

CREATE OR REPLACE FUNCTION public.create_message_notification()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
    INSERT INTO notifications (user_id, title, message, notification_type, related_id, related_type)
    VALUES (
        NEW.receiver_id,
        'New Message from ' || NEW.sender_name,
        LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
        'message',
        NEW.id,
        'message'
    );
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.doctor_can_access_patient (
  doctor_uuid  uuid,
  patient_uuid uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.doctor_patient_assignments
        WHERE doctor_id = doctor_uuid 
        AND patient_id = patient_uuid 
        AND is_active = true
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_patient_row_from_users()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  IF NEW.role = 'patient' AND NEW.auth_id IS NOT NULL THEN
    INSERT INTO public.patients (user_id, name, email)
    VALUES (
      NEW.auth_id,
      COALESCE(NULLIF(NEW.name, ''), NEW.email, 'Patient'),
      NEW.email
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      name = EXCLUDED.name,
      email = EXCLUDED.email;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gen_short_id (
  len integer DEFAULT 10
)
  RETURNS text
  LANGUAGE plpgsql
  AS $function$
declare candidate text;
begin
  loop
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, len);
    exit when not exists (select 1 from public.user_short_ids where short_id = candidate);
  end loop;
  return candidate;
end; $function$;

CREATE OR REPLACE FUNCTION public.get_doctor_patients (
  doctor_uuid uuid
)
  RETURNS TABLE (
    patient_id       uuid,
    patient_short_id text,
    patient_name     text,
    patient_email    text,
    assigned_at      timestamp with time zone,
    total_reports    bigint
  )
  LANGUAGE plpgsql
  AS $function$
DECLARE
    doctor_short_id TEXT;
BEGIN
    -- Get doctor's short ID
    SELECT usi.short_id INTO doctor_short_id 
    FROM public.user_short_ids usi 
    WHERE usi.user_id = doctor_uuid;
    
    RETURN QUERY
    SELECT 
        dpa.patient_id,
        usi.short_id as patient_short_id,
        u.name as patient_name,
        au.email as patient_email,
        dpa.assigned_at,
        COALESCE(report_counts.total_reports, 0) as total_reports
    FROM public.doctor_patient_assignments dpa
    LEFT JOIN public.user_short_ids usi ON dpa.patient_id = usi.user_id
    LEFT JOIN public.users u ON dpa.patient_id = u.auth_id
    LEFT JOIN auth.users au ON dpa.patient_id = au.id
    LEFT JOIN (
        SELECT 
            CASE 
                WHEN r.patient_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' 
                THEN r.patient_id::UUID
                ELSE (SELECT usi2.user_id FROM public.user_short_ids usi2 WHERE usi2.short_id = r.patient_id)
            END as resolved_patient_id,
            COUNT(*) as total_reports
        FROM public.reports r
        WHERE r.doctor_id = doctor_uuid::TEXT OR r.doctor_id = doctor_short_id
        GROUP BY resolved_patient_id
    ) report_counts ON dpa.patient_id = report_counts.resolved_patient_id
    WHERE dpa.doctor_id = doctor_uuid 
    AND dpa.is_active = true
    ORDER BY dpa.assigned_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_doctor_patients_bulletproof (
  doctor_uuid uuid
)
  RETURNS TABLE (
    patient_id       uuid,
    patient_short_id text,
    patient_name     text,
    patient_email    text,
    assigned_at      timestamp with time zone,
    total_reports    bigint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        dpa.patient_id,
        usi.short_id as patient_short_id,
        COALESCE(au.raw_user_meta_data->>'name', 'Unknown Patient') as patient_name,
        au.email as patient_email,
        dpa.assigned_at,
        0::BIGINT as total_reports
    FROM public.doctor_patient_assignments dpa
    LEFT JOIN public.user_short_ids usi ON dpa.patient_id = usi.user_id
    LEFT JOIN auth.users au ON dpa.patient_id = au.id
    WHERE dpa.doctor_id = doctor_uuid 
    AND dpa.is_active = true
    ORDER BY dpa.assigned_at DESC;
EXCEPTION WHEN OTHERS THEN
    -- Return empty result if anything fails
    RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_doctor_patients_simple (
  doctor_uuid uuid
)
  RETURNS TABLE (
    patient_id       uuid,
    patient_short_id text,
    patient_name     text,
    patient_email    text,
    assigned_at      timestamp with time zone,
    total_reports    bigint
  )
  LANGUAGE plpgsql
  AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        dpa.patient_id,
        usi.short_id as patient_short_id,
        au.raw_user_meta_data->>'name' as patient_name,
        au.email as patient_email,
        dpa.assigned_at,
        0::BIGINT as total_reports  -- Simplified - count reports separately if needed
    FROM public.doctor_patient_assignments dpa
    LEFT JOIN public.user_short_ids usi ON dpa.patient_id = usi.user_id
    LEFT JOIN auth.users au ON dpa.patient_id = au.id
    WHERE dpa.doctor_id = doctor_uuid 
    AND dpa.is_active = true
    ORDER BY dpa.assigned_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_doctor_reports_with_ml (
  doctor_uuid uuid
)
  RETURNS TABLE (
    report_id       uuid,
    patient_id      text,
    test_type       text,
    original_name   text,
    file_name       text,
    uploaded_at     timestamp with time zone,
    priority        text,
    ml_id           uuid,
    findings        text,
    confidence      numeric,
    recommendations text,
    severity        text,
    ml_status       text,
    processed_at    timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
    doctor_short_id TEXT;
BEGIN
    -- Get doctor's short ID
    SELECT usi.short_id INTO doctor_short_id 
    FROM public.user_short_ids usi 
    WHERE usi.user_id = doctor_uuid;
    
    RETURN QUERY
    SELECT 
        r.id as report_id,
        r.patient_id,
        r.test_type,
        r.original_name,
        r.file_name,
        r.uploaded_at,
        r.priority,
        ml.id as ml_id,
        ml.findings,
        ml.confidence,
        ml.recommendations,
        ml.severity,
        ml.status as ml_status,
        ml.processed_at
    FROM public.reports r
    LEFT JOIN public.ml_suggestions ml ON r.id = ml.report_id
    WHERE (r.doctor_id = doctor_uuid::TEXT OR r.doctor_id = doctor_short_id)
    ORDER BY r.uploaded_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.minimal_handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
    -- Only create entry in public.users table, ignore errors
    BEGIN
        INSERT INTO public.users (auth_id, email, name, role, created_at)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
            COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
            NOW()
        )
        ON CONFLICT (auth_id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
        -- Ignore any errors during user creation
        RAISE NOTICE 'Could not create user record for %: %', NEW.email, SQLERRM;
    END;

    -- Try to create short_id entry, ignore errors
    BEGIN
        INSERT INTO public.user_short_ids (user_id, short_id, role)
        VALUES (NEW.id, public.gen_short_id(10), COALESCE(NEW.raw_user_meta_data->>'role','unknown'))
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore any errors during short_id creation
        RAISE NOTICE 'Could not create short_id for %: %', NEW.email, SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.propagate_short_id_to_users()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  update public.users
  set short_id = new.short_id
  where auth_id = new.user_id and short_id is null;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.resolve_doctor_id (
  input_id text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.resolve_patient_id (
  input_id text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.safe_appointment_update (
  appointment_id text,
  update_data    jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_consultation_meetings_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.users_set_short_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if new.short_id is null then
    select short_id into new.short_id
    from public.user_short_ids
    where user_id = new.auth_id;
  end if;
  return new;
end; $function$;

ALTER TABLE "public"."consultation_meetings"
  ADD CONSTRAINT "consultation_meetings_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

ALTER TABLE "public"."patient_profiles"
  ADD CONSTRAINT "patient_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."ml_suggestions"
  ADD CONSTRAINT "fk_ml_suggestions_report_id" FOREIGN KEY (report_id) REFERENCES public.reports(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."video_call_logs"
  ADD CONSTRAINT "video_call_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE "public"."video_call_messages"
  ADD CONSTRAINT "video_call_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.users(id);

ALTER TABLE "public"."video_call_sessions"
  ADD CONSTRAINT "video_call_sessions_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE "public"."video_call_sessions"
  ADD CONSTRAINT "video_call_sessions_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES public.users(id);

ALTER TABLE "public"."video_call_sessions"
  ADD CONSTRAINT "video_call_sessions_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES public.users(id);

ALTER TABLE "public"."video_call_logs"
  ADD CONSTRAINT "video_call_logs_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.video_call_sessions(id);

ALTER TABLE "public"."video_call_messages"
  ADD CONSTRAINT "video_call_messages_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.video_call_sessions(id);

CREATE VIEW "public"."patient_profiles_unified" AS  SELECT COALESCE(pp.id, p.id, u.id) AS id,
    u.auth_id AS user_id,
    usi.short_id,
    COALESCE(pp.name, u.name, u.email, 'Patient'::text) AS name,
    COALESCE(pp.full_name, pp.name, u.name, u.email, 'Patient'::text) AS full_name,
    COALESCE(pp.email, u.email) AS email,
    pp.phone,
    pp.date_of_birth,
    pp.gender,
    pp.address,
    pp.emergency_contact,
    pp.medical_history,
    pp.allergies,
    pp.medications,
    COALESCE(pp.created_at, u.created_at) AS created_at,
    COALESCE(pp.updated_at, u.updated_at) AS updated_at
   FROM (((public.users u
     LEFT JOIN public.patients p ON ((p.user_id = u.auth_id)))
     LEFT JOIN public.patient_profiles pp ON ((pp.user_id = u.id)))
     LEFT JOIN public.user_short_ids usi ON ((usi.user_id = u.auth_id)))
  WHERE ((u.role = 'patient'::text) AND (u.auth_id IS NOT NULL));

CREATE INDEX appointments_completed_at_idx ON public.appointments USING btree (completed_at);

CREATE INDEX appointments_date_idx ON public.appointments USING btree (appointment_date);

CREATE INDEX appointments_doctor_id_idx ON public.appointments USING btree (doctor_id);

CREATE INDEX appointments_is_demo_idx ON public.appointments USING btree (is_demo);

CREATE INDEX appointments_patient_id_idx ON public.appointments USING btree (patient_id);

CREATE INDEX appointments_status_idx ON public.appointments USING btree (status);

CREATE INDEX doctor_availability_day_idx ON public.doctor_availability USING btree (day_of_week);

CREATE INDEX doctor_availability_doctor_id_idx ON public.doctor_availability USING btree (doctor_id);

CREATE INDEX doctor_patient_assignments_doctor_idx ON public.doctor_patient_assignments USING btree (doctor_id)
  WHERE (is_active = true);

CREATE INDEX doctor_patient_assignments_patient_idx ON public.doctor_patient_assignments USING btree (patient_id)
  WHERE (is_active = true);

CREATE INDEX doctors_user_id_idx ON public.doctors USING btree (user_id);

CREATE INDEX idx_appointments_date ON public.appointments USING btree (appointment_date);

CREATE INDEX idx_appointments_doctor_id ON public.appointments USING btree (doctor_id);

CREATE INDEX idx_appointments_patient_id ON public.appointments USING btree (patient_id);

CREATE INDEX idx_availability_doctor_id ON public.doctor_availability USING btree (doctor_id);

CREATE INDEX idx_chat_channels_participants ON public.chat_channels USING gin (participants);

CREATE INDEX idx_chat_messages_channel_id ON public.chat_messages USING btree (channel_id);

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at);

CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages USING btree (sender_id);

CREATE INDEX idx_consultation_meetings_active ON public.consultation_meetings USING btree (is_active);

CREATE INDEX idx_consultation_meetings_appointment_id ON public.consultation_meetings USING btree (appointment_id);

CREATE INDEX idx_consultation_meetings_meeting_id ON public.consultation_meetings USING btree (meeting_id);

CREATE INDEX idx_doctors_user_id ON public.doctors USING btree (user_id);

CREATE INDEX idx_labs_lab_type ON public.labs USING btree (lab_type);

CREATE INDEX idx_labs_user_id ON public.labs USING btree (user_id);

CREATE INDEX idx_medical_records_priority ON public.medical_records USING btree (priority);

CREATE INDEX idx_medical_records_record_date ON public.medical_records USING btree (record_date);

CREATE INDEX idx_medical_reports_doctor_id ON public.medical_reports USING btree (doctor_id);

CREATE INDEX idx_medical_reports_patient_id ON public.medical_reports USING btree (patient_id);

CREATE INDEX idx_medical_reports_priority ON public.medical_reports USING btree (priority);

CREATE INDEX idx_medical_reports_status ON public.medical_reports USING btree (status);

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);

CREATE INDEX idx_messages_receiver_id ON public.messages USING btree (receiver_id);

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);

CREATE INDEX idx_ml_suggestions_patient_id ON public.ml_suggestions USING btree (patient_id);

CREATE INDEX idx_ml_suggestions_processed_at ON public.ml_suggestions USING btree (processed_at);

CREATE INDEX idx_ml_suggestions_report_id ON public.ml_suggestions USING btree (report_id);

CREATE INDEX idx_ml_suggestions_severity ON public.ml_suggestions USING btree (severity);

CREATE INDEX idx_ml_suggestions_status ON public.ml_suggestions USING btree (status);

CREATE INDEX idx_ml_suggestions_test_type ON public.ml_suggestions USING btree (test_type);

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);

CREATE INDEX idx_notifications_type ON public.notifications USING btree (notification_type);

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);

CREATE INDEX idx_patient_profiles_blood_type ON public.patient_profiles USING btree (blood_type);

CREATE INDEX idx_patient_profiles_full_name ON public.patient_profiles USING btree (full_name);

CREATE INDEX idx_patient_profiles_phone_number ON public.patient_profiles USING btree (phone_number);

CREATE INDEX idx_patient_profiles_user_id ON public.patient_profiles USING btree (user_id);

CREATE INDEX idx_patients_email ON public.patients USING btree (email);

CREATE INDEX idx_patients_user_id ON public.patients USING btree (user_id);

CREATE INDEX idx_users_auth_id ON public.users USING btree (auth_id);

CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE INDEX ml_suggestions_patient_id_idx ON public.ml_suggestions USING btree (patient_id);

CREATE INDEX ml_suggestions_report_id_idx ON public.ml_suggestions USING btree (report_id);

CREATE INDEX ml_suggestions_status_idx ON public.ml_suggestions USING btree (status);

CREATE INDEX patient_profiles_short_id_idx ON public.patient_profiles USING btree (short_id);

CREATE INDEX patient_profiles_user_id_idx ON public.patient_profiles USING btree (user_id);

CREATE INDEX patients_user_id_idx ON public.patients USING btree (user_id);

CREATE INDEX reports_created_at_idx ON public.reports USING btree (created_at DESC);

CREATE INDEX reports_doctor_id_idx ON public.reports USING btree (doctor_id);

CREATE INDEX reports_patient_id_idx ON public.reports USING btree (patient_id);

CREATE INDEX reports_priority_idx ON public.reports USING btree (priority);

CREATE INDEX reports_test_type_idx ON public.reports USING btree (test_type);

CREATE INDEX reports_uploaded_at_idx ON public.reports USING btree (uploaded_at DESC);

CREATE UNIQUE INDEX unique_active_meeting_per_appointment ON public.consultation_meetings USING btree (appointment_id)
  WHERE (is_active = true);

CREATE INDEX user_short_ids_role_idx ON public.user_short_ids USING btree (ROLE);

CREATE INDEX users_auth_id_idx ON public.users USING btree (auth_id);

CREATE TRIGGER on_auth_user_created_minimal
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.minimal_handle_new_user();

CREATE TRIGGER trigger_update_consultation_meetings_updated_at
  BEFORE UPDATE ON public.consultation_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_consultation_meetings_updated_at();

CREATE TRIGGER propagate_short_id
  AFTER INSERT ON public.user_short_ids
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_short_id_to_users();

CREATE TRIGGER fill_short_id_on_users
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_set_short_id();

CREATE TRIGGER trg_users_ensure_patient_row
  AFTER INSERT OR UPDATE OF ROLE, auth_id, name, email ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_patient_row_from_users();

CREATE POLICY "Users can create channels" ON "public"."chat_channels"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((auth.uid())::text = ANY ((participants)::text[])));

CREATE POLICY "Users can read channels they participate in" ON "public"."chat_channels"
  FOR SELECT
  TO "authenticated"
  USING ((((auth.uid())::text = ANY ((participants)::text[])) OR (channel_type = 'general'::text)));

CREATE POLICY "Users can read messages in their channels" ON "public"."chat_messages"
  FOR SELECT
  TO "authenticated"
  USING ((channel_id IN ( SELECT chat_channels.id
   FROM public.chat_channels
  WHERE (((auth.uid())::text = ANY ((chat_channels.participants)::text[])) OR (chat_channels.channel_type = 'general'::text)))));

CREATE POLICY "Users can send messages to their channels" ON "public"."chat_messages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((channel_id IN ( SELECT chat_channels.id
   FROM public.chat_channels
  WHERE ((auth.uid())::text = ANY ((chat_channels.participants)::text[])))));

CREATE POLICY "Allow all authenticated users to view meetings" ON "public"."consultation_meetings"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow authenticated users to create meetings" ON "public"."consultation_meetings"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete meetings" ON "public"."consultation_meetings"
  FOR DELETE
  TO "authenticated"
  USING (true);

CREATE POLICY "Allow authenticated users to read meetings" ON "public"."consultation_meetings"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Allow authenticated users to update meetings" ON "public"."consultation_meetings"
  FOR UPDATE
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow doctors to create meetings" ON "public"."consultation_meetings"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = 'doctor'::text)))));

CREATE POLICY "Allow hosts to update meetings" ON "public"."consultation_meetings"
  FOR UPDATE
  TO PUBLIC
  USING ((host_id = auth.uid()));

CREATE POLICY "Users can insert messages" ON "public"."messages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "Users can read all messages" ON "public"."messages"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Users can update their own messages" ON "public"."messages"
  FOR UPDATE
  TO "authenticated"
  USING (((auth.uid())::text = (sender_id)::text))
  WITH CHECK (((auth.uid())::text = (sender_id)::text));

CREATE POLICY "Users can insert notifications" ON "public"."notifications"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "Users can read their own notifications" ON "public"."notifications"
  FOR SELECT
  TO "authenticated"
  USING (((auth.uid())::text = (user_id)::text));

CREATE POLICY "Users can update their own notifications" ON "public"."notifications"
  FOR UPDATE
  TO "authenticated"
  USING (((auth.uid())::text = (user_id)::text))
  WITH CHECK (((auth.uid())::text = (user_id)::text));

CREATE POLICY "Patients can insert own profile" ON "public"."patient_profiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Patients can update own profile" ON "public"."patient_profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "Patients can view own profile" ON "public"."patient_profiles"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "allow_all_anon_reports" ON "public"."reports"
  FOR ALL
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_authenticated_reports" ON "public"."reports"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_anon_short_ids" ON "public"."user_short_ids"
  FOR ALL
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_authenticated_short_ids" ON "public"."user_short_ids"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_anon" ON "public"."users"
  FOR ALL
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON "public"."users"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read files" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));

CREATE POLICY "Authenticated users can upload files" ON "storage"."objects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));

CREATE POLICY "File owners can delete files" ON "storage"."objects"
  FOR DELETE
  TO PUBLIC
  USING (((bucket_id = 'reports'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "File owners can update files" ON "storage"."objects"
  FOR UPDATE
  TO PUBLIC
  USING (((bucket_id = 'reports'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

COMMENT ON COLUMN "public"."appointments"."completed_at" IS 'Timestamp when consultation/appointment was completed';

COMMENT ON COLUMN "public"."appointments"."diagnosis" IS 'Medical diagnosis from consultation';

COMMENT ON COLUMN "public"."appointments"."notes" IS 'Additional consultation notes';

COMMENT ON COLUMN "public"."appointments"."prescription" IS 'Prescribed medication/treatment';

COMMENT ON TABLE "public"."consultation_meetings" IS 'Stores Zoom meeting details for consultations to ensure doctor and patient join the same meeting';

COMMENT ON TABLE "public"."ml_suggestions" IS 'ML suggestions table - relationship updated';

COMMENT ON TABLE "public"."reports" IS 'Reports table - relationship updated';

GRANT EXECUTE ON FUNCTION "public"."create_message_notification"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."doctor_can_access_patient"(uuid, uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."ensure_patient_row_from_users"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."gen_short_id"(integer) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_doctor_patients"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_doctor_patients_bulletproof"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_doctor_patients_simple"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_doctor_reports_with_ml"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."minimal_handle_new_user"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."propagate_short_id_to_users"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."resolve_doctor_id"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."resolve_patient_id"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."safe_appointment_update"(text, jsonb) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_consultation_meetings_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_updated_at_column"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."users_set_short_id"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."appointments" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chat_channels" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chat_messages" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chat_notifications" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."consultation_meetings" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."doctor_availability" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."doctor_patient_assignments" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."doctors" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."labs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."medical_records" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."medical_reports" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."message_threads" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ml_suggestions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."patient_profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."patients" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reports" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."typing_status" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_short_ids" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."video_call_logs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."video_call_messages" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."video_call_sessions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."patient_profiles_unified" TO "anon", "authenticated", "postgres", "service_role";

