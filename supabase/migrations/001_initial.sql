-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users)
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
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

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text DEFAULT '💊',
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their households"
  ON public.households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their households"
  ON public.households FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can delete their households"
  ON public.households FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================
-- HOUSEHOLD MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(household_id, user_id)
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view membership in their households"
  ON public.household_members FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members hm
      WHERE hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage members"
  ON public.household_members FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members hm
      WHERE hm.user_id = auth.uid() AND hm.role = 'owner'
    )
  );

CREATE POLICY "Users can join via invite (insert own membership)"
  ON public.household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave (delete own membership)"
  ON public.household_members FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  expires_at timestamptz DEFAULT now() + INTERVAL '7 days',
  used_by uuid REFERENCES public.profiles(id),
  used_at timestamptz
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view invites"
  ON public.invites FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
    OR token IS NOT NULL  -- Anyone can view by token for accept flow
  );

CREATE POLICY "Owners can create invites"
  ON public.invites FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Authenticated users can update invite (mark as used)"
  ON public.invites FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- MEDICINES
-- ============================================================
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

CREATE INDEX IF NOT EXISTS medicines_household_id_idx ON public.medicines(household_id);
CREATE INDEX IF NOT EXISTS medicines_expires_at_idx ON public.medicines(expires_at);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view medicines"
  ON public.medicines FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Household members can add medicines"
  ON public.medicines FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Household members can update medicines"
  ON public.medicines FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Household members can delete medicines"
  ON public.medicines FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

-- Enable realtime for medicines
ALTER PUBLICATION supabase_realtime ADD TABLE public.medicines;

-- ============================================================
-- MEDICINE LOG
-- ============================================================
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

CREATE INDEX IF NOT EXISTS medicine_log_medicine_id_idx ON public.medicine_log(medicine_id);

ALTER TABLE public.medicine_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view medicine log"
  ON public.medicine_log FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Household members can insert log entries"
  ON public.medicine_log FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- MEDICINE CATALOG (AI cache)
-- ============================================================
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

ALTER TABLE public.medicine_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read medicine catalog"
  ON public.medicine_catalog FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert into medicine catalog"
  ON public.medicine_catalog FOR INSERT
  WITH CHECK (true);
