-- =============================================================================
-- AI Content Planner — схема V1 для Supabase (PostgreSQL)
-- =============================================================================
-- Как использовать:
--   1. Откройте Supabase Dashboard → SQL Editor → New query
--   2. Вставьте весь этот файл целиком
--   3. Нажмите Run
--
-- V1: только Instagram, календарь по датам (scheduled_date), без уведомлений.
-- Предполагается, что в проекте уже включён Supabase Auth (таблица auth.users).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Расширения
-- -----------------------------------------------------------------------------
-- pgcrypto даёт gen_random_uuid() для генерации UUID по умолчанию
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Перечисления (enum) — фиксированные наборы значений
-- -----------------------------------------------------------------------------
-- В V1 поддерживается только Instagram
CREATE TYPE public.social_provider AS ENUM (
  'instagram'
);

CREATE TYPE public.post_format AS ENUM (
  'reels',
  'carousel',
  'stories',
  'post',
  'other'
);

CREATE TYPE public.post_status AS ENUM (
  'idea',
  'draft',
  'ready',
  'scheduled',
  'published'
);

CREATE TYPE public.recommendation_priority AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TYPE public.plan_horizon AS ENUM (
  'week',
  'month'
);

CREATE TYPE public.plan_item_status AS ENUM (
  'idea',
  'draft',
  'ready'
);

-- -----------------------------------------------------------------------------
-- Вспомогательная функция: автоматически обновлять updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Триггерная функция: перед UPDATE подставляет текущее время в updated_at.';

-- -----------------------------------------------------------------------------
-- Профиль пользователя (1:1 с auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  -- id совпадает с auth.users.id — так проще связывать данные с Supabase Auth
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  handle TEXT,
  avatar_url TEXT,
  plan_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'pro', 'enterprise')),
  theme_preference TEXT NOT NULL DEFAULT 'system'
    CHECK (theme_preference IN ('light', 'dark', 'system')),
  locale TEXT NOT NULL DEFAULT 'ru',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS
  'Публичный профиль пользователя. Создаётся автоматически при регистрации.';
COMMENT ON COLUMN public.profiles.id IS
  'UUID из auth.users — владелец аккаунта.';

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Автосоздание профиля при регистрации в Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'После INSERT в auth.users создаёт строку в public.profiles.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Подключённый аккаунт Instagram (V1 — одна соцсеть на пользователя)
-- -----------------------------------------------------------------------------
CREATE TABLE public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- provider всегда 'instagram' в V1; поле оставлено для расширения в будущем
  provider public.social_provider NOT NULL DEFAULT 'instagram',
  external_account_id TEXT,
  username TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  access_token_encrypted TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

COMMENT ON TABLE public.social_accounts IS
  'Привязанный аккаунт Instagram (OAuth). Один пользователь — один Instagram.';
COMMENT ON COLUMN public.social_accounts.provider IS
  'В V1 всегда instagram. Enum оставлен для будущих интеграций.';

CREATE INDEX idx_social_accounts_user_id ON public.social_accounts (user_id);

CREATE TRIGGER social_accounts_set_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Публикации (посты)
-- -----------------------------------------------------------------------------
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES public.social_accounts (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  caption TEXT,
  content TEXT,
  thumbnail_url TEXT,
  format public.post_format NOT NULL DEFAULT 'post',
  status public.post_status NOT NULL DEFAULT 'draft',
  tags TEXT,
  external_post_id TEXT,
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.posts IS
  'Контент пользователя: черновики, идеи и опубликованные посты Instagram.';

CREATE INDEX idx_posts_user_id ON public.posts (user_id);
CREATE INDEX idx_posts_social_account_id ON public.posts (social_account_id);
CREATE INDEX idx_posts_published_at ON public.posts (published_at DESC);

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Аналитика постов (снимки метрик)
-- -----------------------------------------------------------------------------
CREATE TABLE public.post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reach INTEGER NOT NULL DEFAULT 0 CHECK (reach >= 0),
  engagement INTEGER NOT NULL DEFAULT 0 CHECK (engagement >= 0),
  saves INTEGER NOT NULL DEFAULT 0 CHECK (saves >= 0),
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  comments INTEGER NOT NULL DEFAULT 0 CHECK (comments >= 0),
  link_clicks INTEGER NOT NULL DEFAULT 0 CHECK (link_clicks >= 0),
  er NUMERIC(6, 2) NOT NULL DEFAULT 0,
  raw_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, snapshot_date)
);

COMMENT ON TABLE public.post_analytics IS
  'Метрики поста за день (охват, ER и т.д.). Одна строка = один снимок на дату.';

CREATE INDEX idx_post_analytics_post_id ON public.post_analytics (post_id);
CREATE INDEX idx_post_analytics_snapshot_date ON public.post_analytics (snapshot_date DESC);

-- -----------------------------------------------------------------------------
-- AI-рекомендации
-- -----------------------------------------------------------------------------
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  tag TEXT,
  priority public.recommendation_priority NOT NULL DEFAULT 'medium',
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  is_added_to_plan BOOLEAN NOT NULL DEFAULT FALSE,
  source_post_id UUID REFERENCES public.posts (id) ON DELETE SET NULL,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ai_recommendations IS
  'Подсказки AI по формату, времени публикации и контенту.';

CREATE INDEX idx_ai_recommendations_user_id ON public.ai_recommendations (user_id);

CREATE TRIGGER ai_recommendations_set_updated_at
  BEFORE UPDATE ON public.ai_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Контент-планы (неделя / месяц — рамка календаря)
-- -----------------------------------------------------------------------------
CREATE TABLE public.content_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Контент-план',
  horizon public.plan_horizon NOT NULL DEFAULT 'week',
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.content_plans IS
  'Рамка календаря: неделя или месяц (start_date / end_date задают диапазон).';
COMMENT ON COLUMN public.content_plans.start_date IS
  'Начало периода плана — для фильтрации карточек по scheduled_date.';
COMMENT ON COLUMN public.content_plans.end_date IS
  'Конец периода плана — для фильтрации карточек по scheduled_date.';

CREATE INDEX idx_content_plans_user_id ON public.content_plans (user_id);
CREATE INDEX idx_content_plans_date_range ON public.content_plans (user_id, start_date, end_date);

CREATE TRIGGER content_plans_set_updated_at
  BEFORE UPDATE ON public.content_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Элементы контент-плана (карточки календаря по датам)
-- -----------------------------------------------------------------------------
CREATE TABLE public.content_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id UUID NOT NULL REFERENCES public.content_plans (id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  -- Дата в календаре: одна карточка = один день публикации
  scheduled_date DATE NOT NULL,
  status public.plan_item_status NOT NULL DEFAULT 'idea',
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_item_id UUID REFERENCES public.content_plan_items (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.content_plan_items IS
  'Карточки контент-плана. Каждая привязана к конкретной дате (scheduled_date).';
COMMENT ON COLUMN public.content_plan_items.scheduled_date IS
  'День в календаре, на который запланирована публикация.';
COMMENT ON COLUMN public.content_plan_items.source_item_id IS
  'Если карточка создана копированием (DnD), здесь id исходной записи.';

CREATE INDEX idx_content_plan_items_plan_id ON public.content_plan_items (content_plan_id);
CREATE INDEX idx_content_plan_items_post_id ON public.content_plan_items (post_id);
CREATE INDEX idx_content_plan_items_scheduled_date ON public.content_plan_items (content_plan_id, scheduled_date);
CREATE INDEX idx_content_plan_items_date ON public.content_plan_items (scheduled_date);

CREATE TRIGGER content_plan_items_set_updated_at
  BEFORE UPDATE ON public.content_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- RLS ограничивает доступ на уровне строк: даже при утечке anon key
-- пользователь не увидит чужие данные без политики SELECT.
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_plan_items ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- profiles: id = auth.uid()
-- -----------------------------------------------------------------------------
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- -----------------------------------------------------------------------------
-- social_accounts: user_id = auth.uid()
-- -----------------------------------------------------------------------------
CREATE POLICY "social_accounts_select_own"
  ON public.social_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "social_accounts_insert_own"
  ON public.social_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "social_accounts_update_own"
  ON public.social_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "social_accounts_delete_own"
  ON public.social_accounts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- posts: user_id = auth.uid()
-- -----------------------------------------------------------------------------
CREATE POLICY "posts_select_own"
  ON public.posts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- post_analytics: доступ только к метрикам своих постов
-- -----------------------------------------------------------------------------
CREATE POLICY "post_analytics_select_own"
  ON public.post_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_analytics.post_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "post_analytics_insert_own"
  ON public.post_analytics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_analytics.post_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "post_analytics_update_own"
  ON public.post_analytics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_analytics.post_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_analytics.post_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "post_analytics_delete_own"
  ON public.post_analytics FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_analytics.post_id
        AND p.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- ai_recommendations: user_id = auth.uid()
-- -----------------------------------------------------------------------------
CREATE POLICY "ai_recommendations_select_own"
  ON public.ai_recommendations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ai_recommendations_insert_own"
  ON public.ai_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_recommendations_update_own"
  ON public.ai_recommendations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_recommendations_delete_own"
  ON public.ai_recommendations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- content_plans: user_id = auth.uid()
-- -----------------------------------------------------------------------------
CREATE POLICY "content_plans_select_own"
  ON public.content_plans FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "content_plans_insert_own"
  ON public.content_plans FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "content_plans_update_own"
  ON public.content_plans FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "content_plans_delete_own"
  ON public.content_plans FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- content_plan_items: доступ через владельца родительского плана
-- -----------------------------------------------------------------------------
CREATE POLICY "content_plan_items_select_own"
  ON public.content_plan_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.content_plans cp
      WHERE cp.id = content_plan_items.content_plan_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "content_plan_items_insert_own"
  ON public.content_plan_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.content_plans cp
      WHERE cp.id = content_plan_items.content_plan_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "content_plan_items_update_own"
  ON public.content_plan_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.content_plans cp
      WHERE cp.id = content_plan_items.content_plan_id
        AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.content_plans cp
      WHERE cp.id = content_plan_items.content_plan_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "content_plan_items_delete_own"
  ON public.content_plan_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.content_plans cp
      WHERE cp.id = content_plan_items.content_plan_id
        AND cp.user_id = auth.uid()
    )
  );

-- =============================================================================
-- Права для роли authenticated (клиент Supabase с JWT пользователя)
-- =============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Для enum-типов, чтобы клиент мог читать/писать значения
GRANT USAGE ON TYPE public.social_provider TO authenticated;
GRANT USAGE ON TYPE public.post_format TO authenticated;
GRANT USAGE ON TYPE public.post_status TO authenticated;
GRANT USAGE ON TYPE public.recommendation_priority TO authenticated;
GRANT USAGE ON TYPE public.plan_horizon TO authenticated;
GRANT USAGE ON TYPE public.plan_item_status TO authenticated;

-- =============================================================================
-- Готово. После запуска проверьте в Table Editor, что созданы 7 таблиц:
--   profiles, social_accounts, posts, post_analytics,
--   ai_recommendations, content_plans, content_plan_items
-- В Authentication → Policies убедитесь, что RLS включён.
-- =============================================================================
