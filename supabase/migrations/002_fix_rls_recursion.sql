-- ============================================================
-- ФИКС: Бесконечная рекурсия в RLS политиках household_members
-- Решение: security definer функция обходит RLS при проверке членства
-- ============================================================

-- 1. Функция возвращает household_id-ы текущего пользователя БЕЗ RLS
CREATE OR REPLACE FUNCTION public.get_my_household_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid();
$$;

-- 2. Функция проверяет — является ли пользователь owner конкретного household
CREATE OR REPLACE FUNCTION public.is_household_owner(hh_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = hh_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- 3. Пересоздаём рекурсивные политики через функции
DROP POLICY IF EXISTS "household_members_select" ON public.household_members;
CREATE POLICY "household_members_select"
  ON public.household_members FOR SELECT
  USING (household_id IN (SELECT public.get_my_household_ids()));

DROP POLICY IF EXISTS "household_members_delete_owner" ON public.household_members;
CREATE POLICY "household_members_delete_owner"
  ON public.household_members FOR DELETE
  USING (public.is_household_owner(household_id));

-- 4. Также обновляем households SELECT через ту же функцию (для консистентности)
DROP POLICY IF EXISTS "households_select_members" ON public.households;
CREATE POLICY "households_select_members"
  ON public.households FOR SELECT
  USING (id IN (SELECT public.get_my_household_ids()));
