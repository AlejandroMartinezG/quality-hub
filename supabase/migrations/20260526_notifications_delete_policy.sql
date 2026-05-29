-- Add missing DELETE and UPDATE RLS policies for notifications table.
-- Without a DELETE policy, users could not permanently remove their own notifications —
-- the client-side delete appeared to work but the row was never deleted from the DB,
-- causing it to reappear on the next polling cycle.

DO $$
BEGIN
    -- DELETE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'notifications'
          AND cmd        = 'DELETE'
    ) THEN
        CREATE POLICY "Users can delete own notifications"
        ON public.notifications
        FOR DELETE
        USING (user_id = auth.uid());
    END IF;

    -- UPDATE policy (mark as read) — add if also missing
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'notifications'
          AND cmd        = 'UPDATE'
    ) THEN
        CREATE POLICY "Users can update own notifications"
        ON public.notifications
        FOR UPDATE
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
END $$;
