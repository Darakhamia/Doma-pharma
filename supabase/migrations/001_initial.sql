-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. СОЗДАНИЕ ВСЕХ ТАБЛИЦ
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text,
  avatar_url text,
  push_subscription jsonb,
  notify_expiry_days int DEFAULT 30,
  notify_low_qty boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text DEFAULT '💊',
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(household_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  expires_at timestamptz DEFAULT now() + INTERVAL '7 days',
  used_by uuid REFERENCES public.profiles(id),
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  substance text,
  purpose text,
  category text,
  form text,
  quantity numeric NOT NULL DEFAULT 0,
  quantity_unit text DEFAULT 'шт',
  low_qty_threshold numeric DEFAULT 5,
  location text,
  expires_at date,
  barcode text,
  notes text,
  added_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicine_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE CASCADE,
  household_id uuid REFERENCES public.households(id),
  user_id uuid REFERENCES public.profiles(id),
  action text CHECK (action IN ('added', 'updated', 'taken', 'removed', 'expired')),
  quantity_change numeric,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medicine_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text UNIQUE NOT NULL,
  name text NOT NULL,
  substance text,
  purpose text,
  category text,
  form text,
  typical_quantity_unit text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. ИНДЕКСЫ
-- ============================================================

CREATE INDEX IF NOT EXISTS medicines_household_id_idx ON public.medicines(household_id);
CREATE INDEX IF NOT EXISTS medicines_expires_at_idx ON public.medicines(expires_at);
CREATE INDEX IF NOT EXISTS medicine_log_medicine_id_idx ON public.medicine_log(medicine_id);
CREATE INDEX IF NOT EXISTS household_members_user_id_idx ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS household_members_household_id_idx ON public.household_members(household_id);

-- ============================================================
-- 3. ROW LEVEL SECURITY — включить на всех таблицах
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_catalog ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS ПОЛИТИКИ — profiles
-- ============================================================

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 5. RLS ПОЛИТИКИ — households
-- (household_members уже существует на этом этапе)
-- ============================================================

CREATE POLICY "households_select_members"
  ON public.households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "households_insert_authenticated"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "households_update_owner"
  ON public.households FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "households_delete_owner"
  ON public.households FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================
-- 6. RLS ПОЛИТИКИ — household_members
-- ============================================================

CREATE POLICY "household_members_select"
  ON public.household_members FOR SELECT
  USING (
    household_id IN (
      SELECT hm.household_id FROM public.household_members hm
      WHERE hm.user_id = auth.uid()
    )
  );

CREATE POLICY "household_members_insert_self"
  ON public.household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "household_members_delete_self"
  ON public.household_members FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "household_members_delete_owner"
  ON public.household_members FOR DELETE
  USING (
    household_id IN (
      SELECT hm.household_id FROM public.household_members hm
      WHERE hm.user_id = auth.uid() AND hm.role = 'owner'
    )
  );

-- ============================================================
-- 7. RLS ПОЛИТИКИ — invites
-- ============================================================

CREATE POLICY "invites_select"
  ON public.invites FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
    OR auth.uid() IS NOT NULL
  );

CREATE POLICY "invites_insert_owner"
  ON public.invites FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "invites_update_authenticated"
  ON public.invites FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 8. RLS ПОЛИТИКИ — medicines
-- ============================================================

CREATE POLICY "medicines_select_members"
  ON public.medicines FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "medicines_insert_members"
  ON public.medicines FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "medicines_update_members"
  ON public.medicines FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "medicines_delete_members"
  ON public.medicines FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 9. RLS ПОЛИТИКИ — medicine_log
-- ============================================================

CREATE POLICY "medicine_log_select_members"
  ON public.medicine_log FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "medicine_log_insert_members"
  ON public.medicine_log FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 10. RLS ПОЛИТИКИ — medicine_catalog
-- ============================================================

CREATE POLICY "medicine_catalog_select_all"
  ON public.medicine_catalog FOR SELECT
  USING (true);

CREATE POLICY "medicine_catalog_insert_all"
  ON public.medicine_catalog FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 11. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.medicines;

-- ============================================================
-- 12. ТРИГГЕР — авто-создание профиля при регистрации
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
