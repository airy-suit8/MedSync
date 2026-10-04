-- Create consultation_messages table for storing chat messages during video consultations

CREATE TABLE IF NOT EXISTS public.consultation_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('doctor', 'patient')),
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_consultation_messages_consultation_id ON public.consultation_messages(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_messages_sender_id ON public.consultation_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_consultation_messages_created_at ON public.consultation_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view messages for consultations they are part of" ON public.consultation_messages
    FOR SELECT USING (
        consultation_id IN (
            SELECT id FROM public.appointments 
            WHERE doctor_id = auth.uid() OR patient_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages for consultations they are part of" ON public.consultation_messages
    FOR INSERT WITH CHECK (
        consultation_id IN (
            SELECT id FROM public.appointments 
            WHERE doctor_id = auth.uid() OR patient_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_consultation_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_consultation_messages_updated_at
    BEFORE UPDATE ON public.consultation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_consultation_messages_updated_at();

-- Add some sample data for testing (optional)
-- INSERT INTO public.consultation_messages (consultation_id, sender_id, sender_name, sender_role, content, message_type)
-- VALUES 
--     ('your-consultation-id-here', 'your-sender-id-here', 'Dr. Smith', 'doctor', 'Hello, how are you feeling today?', 'text'),
--     ('your-consultation-id-here', 'your-sender-id-here', 'John Doe', 'patient', 'I am feeling better, thank you doctor.', 'text');
