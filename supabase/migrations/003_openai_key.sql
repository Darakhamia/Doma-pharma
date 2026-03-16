-- Добавить поле для ключа OpenAI в профиль пользователя
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS openai_api_key text;
