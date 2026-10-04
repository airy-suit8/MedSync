-- Notifications are created by trusted server-side workflows. Authenticated
-- browser sessions must not be able to forge notifications for arbitrary users.
DROP POLICY IF EXISTS "Users can insert notifications"
  ON public.notifications;
