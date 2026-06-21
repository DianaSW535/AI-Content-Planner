-- Telegram MVP — миграция для уже развёрнутой БД
-- Выполните в Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.user_telegram (
  user_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  telegram_chat_id BIGINT,
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  link_token TEXT,
  link_token_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_telegram_link_token ON public.user_telegram (link_token)
  WHERE link_token IS NOT NULL;

DROP TRIGGER IF EXISTS user_telegram_set_updated_at ON public.user_telegram;
CREATE TRIGGER user_telegram_set_updated_at
  BEFORE UPDATE ON public.user_telegram
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.telegram_reminders_sent (
  content_plan_item_id UUID NOT NULL
    REFERENCES public.content_plan_items (id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_plan_item_id, scheduled_date)
);

CREATE OR REPLACE FUNCTION public.get_telegram_reminders_for_today()
RETURNS TABLE (
  item_id UUID,
  title TEXT,
  scheduled_date DATE,
  telegram_chat_id BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cpi.id AS item_id,
    cpi.title,
    cpi.scheduled_date,
    ut.telegram_chat_id
  FROM public.content_plan_items cpi
  INNER JOIN public.content_plans cp ON cp.id = cpi.content_plan_id
  INNER JOIN public.user_telegram ut ON ut.user_id = cp.user_id
  WHERE cp.is_active = TRUE
    AND ut.is_connected = TRUE
    AND ut.reminders_enabled = TRUE
    AND ut.telegram_chat_id IS NOT NULL
    AND cpi.scheduled_date = CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1
      FROM public.telegram_reminders_sent trs
      WHERE trs.content_plan_item_id = cpi.id
        AND trs.scheduled_date = cpi.scheduled_date
    );
$$;

REVOKE ALL ON FUNCTION public.get_telegram_reminders_for_today() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_telegram_reminders_for_today() TO service_role;

ALTER TABLE public.user_telegram ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_reminders_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_telegram_select_own" ON public.user_telegram;
CREATE POLICY "user_telegram_select_own"
  ON public.user_telegram FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_telegram_update_own" ON public.user_telegram;
CREATE POLICY "user_telegram_update_own"
  ON public.user_telegram FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
