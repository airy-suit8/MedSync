-- Email Verification and Password Reset Setup for MedSync
-- Run these queries in your Supabase SQL Editor

-- 1. Enable email confirmations in Supabase Auth settings
-- Go to Authentication > Settings in Supabase Dashboard
-- Enable "Enable email confirmations"
-- Set "Site URL" to your domain (e.g., https://yourdomain.com)
-- Set "Redirect URLs" to include:
--   - https://yourdomain.com/verify-email
--   - https://yourdomain.com/confirm
--   - http://localhost:3000/verify-email (for development)
--   - http://localhost:3000/confirm (for development)

-- 2. Create email verification tracking table (optional)
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('signup', 'password_reset', 'email_change')),
  token_hash TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS on email_verifications table
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for email_verifications
CREATE POLICY "Users can view their own verification records" ON email_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verification records" ON email_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own verification records" ON email_verifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Create function to handle email verification
CREATE OR REPLACE FUNCTION handle_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert verification record when user signs up
  IF TG_OP = 'INSERT' AND NEW.email_confirmed_at IS NULL THEN
    INSERT INTO email_verifications (user_id, email, verification_type, expires_at)
    VALUES (NEW.id, NEW.email, 'signup', NOW() + INTERVAL '24 hours');
  END IF;
  
  -- Update verification record when email is confirmed
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE email_verifications 
    SET verified_at = NEW.email_confirmed_at, updated_at = NOW()
    WHERE user_id = NEW.id AND verification_type = 'signup' AND verified_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger for email verification
DROP TRIGGER IF EXISTS on_auth_user_email_verification ON auth.users;
CREATE TRIGGER on_auth_user_email_verification
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_email_verification();

-- 7. Create function to clean up expired verification tokens
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verifications 
  WHERE expires_at < NOW() AND verified_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to resend verification email (call from your app)
CREATE OR REPLACE FUNCTION request_email_verification(user_email TEXT)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  result JSON;
BEGIN
  -- Find user by email
  SELECT id, email, email_confirmed_at INTO user_record
  FROM auth.users 
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;
  
  IF user_record.email_confirmed_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'Email already verified');
  END IF;
  
  -- Update or insert verification record
  INSERT INTO email_verifications (user_id, email, verification_type, expires_at)
  VALUES (user_record.id, user_record.email, 'signup', NOW() + INTERVAL '24 hours')
  ON CONFLICT (user_id, verification_type) 
  WHERE verified_at IS NULL
  DO UPDATE SET 
    expires_at = NOW() + INTERVAL '24 hours',
    updated_at = NOW();
  
  RETURN json_build_object('success', true, 'message', 'Verification email will be sent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON email_verifications TO authenticated;
GRANT EXECUTE ON FUNCTION request_email_verification(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_verifications() TO authenticated;

-- 10. Create index for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- 11. Insert sample email templates (optional - for reference)
-- You can customize these in Supabase Auth > Email Templates
/*
Email Confirmation Template:
Subject: Confirm your MedSync account
Body:
<h2>Welcome to MedSync!</h2>
<p>Please confirm your email address by clicking the link below:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email Address</a></p>
<p>If you didn't create an account with MedSync, you can safely ignore this email.</p>

Password Recovery Template:
Subject: Reset your MedSync password
Body:
<h2>Reset your MedSync password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>If you didn't request a password reset, you can safely ignore this email.</p>
*/

-- 12. Create scheduled job to clean up expired tokens (run daily)
-- Note: This requires the pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-expired-verifications', '0 2 * * *', 'SELECT cleanup_expired_verifications();');

COMMENT ON TABLE email_verifications IS 'Tracks email verification attempts and status';
COMMENT ON FUNCTION handle_email_verification() IS 'Automatically handles email verification workflow';
COMMENT ON FUNCTION cleanup_expired_verifications() IS 'Removes expired verification tokens';
COMMENT ON FUNCTION request_email_verification(TEXT) IS 'Allows users to request new verification emails';