-- Migration C: Create missing Chat tables and enable basic RLS

CREATE TABLE IF NOT EXISTS public.chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    channel_type TEXT,
    participants UUID[],
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name TEXT,
    sender_role TEXT,
    content TEXT,
    message_type TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.chat_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_preview TEXT,
    unread_count INTEGER DEFAULT 1,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    thread_type TEXT,
    participants UUID[],
    last_message_id UUID,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name TEXT,
    sender_role TEXT,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    receiver_name TEXT,
    receiver_role TEXT,
    message_type TEXT,
    subject TEXT,
    attachment_url TEXT,
    attachment_type TEXT,
    attachment_name TEXT,
    is_read BOOLEAN DEFAULT false,
    is_urgent BOOLEAN DEFAULT false,
    related_report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
    related_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.typing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT false,
    last_typing_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and add basic policies
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Users can read their channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can read own chat notifications" ON public.chat_notifications;
DROP POLICY IF EXISTS "Users can read own message threads" ON public.message_threads;
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read relevant typing status" ON public.typing_status;
DROP POLICY IF EXISTS "Users can insert their channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Users can insert their channel messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert chat notifications" ON public.chat_notifications;
DROP POLICY IF EXISTS "Users can insert message threads" ON public.message_threads;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert typing status" ON public.typing_status;

CREATE POLICY "Users can read their channels" ON public.chat_channels FOR SELECT USING (auth.uid() = ANY(participants) OR auth.uid() = created_by);
CREATE POLICY "Users can read their channel messages" ON public.chat_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id AND (auth.uid() = ANY(c.participants) OR auth.uid() = c.created_by)));
CREATE POLICY "Users can read own chat notifications" ON public.chat_notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can read own message threads" ON public.message_threads FOR SELECT USING (auth.uid() = ANY(participants));
CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can read relevant typing status" ON public.typing_status FOR SELECT USING (auth.uid() = user_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert their channels" ON public.chat_channels FOR INSERT WITH CHECK (auth.uid() = ANY(participants) OR auth.uid() = created_by);
CREATE POLICY "Users can insert their channel messages" ON public.chat_messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can insert chat notifications" ON public.chat_notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert message threads" ON public.message_threads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can insert typing status" ON public.typing_status FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
