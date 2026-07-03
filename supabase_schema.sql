-- ============================================================
-- DIARIUM — DATABÁZOVÉ SCHÉMA
-- Spustit v Supabase SQL Editoru:
-- https://supabase.com/dashboard/project/vmqbslghzgfotwhzgawa/sql/new
-- ============================================================

-- 1. PROFILES (napojené na auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_user TEXT,
  default_repo TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own ON profiles FOR ALL USING (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, github_user)
  VALUES (new.id, new.raw_user_meta_data->>'user_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. ENTRIES — denní zápisy
CREATE TABLE IF NOT EXISTS entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  mood             SMALLINT CHECK (mood BETWEEN 1 AND 5),
  mood_emoji       TEXT,
  sleep_quality    SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  stress           SMALLINT CHECK (stress BETWEEN 1 AND 5),
  activities       JSONB DEFAULT '[]'::jsonb,
  habits           JSONB DEFAULT '{}'::jsonb,
  gratitude        JSONB DEFAULT '[]'::jsonb,
  note             TEXT DEFAULT '',
  weather          JSONB DEFAULT '[]'::jsonb,
  phone_screen_time INTEGER,
  phone_unlocks     INTEGER,
  phone_top_apps    JSONB DEFAULT '[]'::jsonb,
  photo_path       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_entries_mood ON entries (user_id, mood);
CREATE INDEX IF NOT EXISTS idx_entries_activities ON entries USING GIN (activities);
CREATE INDEX IF NOT EXISTS idx_entries_habits ON entries USING GIN (habits);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY entries_own ON entries FOR ALL USING (user_id = auth.uid());

-- 3. ACTIVITY CATALOG — výchozí aktivity
CREATE TABLE IF NOT EXISTS activity_catalog (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  icon        TEXT DEFAULT '📌',
  category    TEXT DEFAULT 'obecné',
  color       TEXT DEFAULT '#6366f1',
  is_default  BOOLEAN DEFAULT true,
  sort_order  SMALLINT DEFAULT 0
);

INSERT INTO activity_catalog (key, label, icon, category, color, sort_order) VALUES
  ('rodina', 'Rodina', '👨‍👩‍👧‍👦', 'sociální', '#8b5cf6', 1),
  ('pratele', 'Přátelé', '👥', 'sociální', '#8b5cf6', 2),
  ('rande', 'Rande', '💕', 'sociální', '#ec4899', 3),
  ('party', 'Párty', '🎉', 'sociální', '#f97316', 4),
  ('office', 'Práce', '💼', 'práce', '#3b82f6', 10),
  ('filmy_a_tv', 'Filmy a TV', '🍿', 'volný čas', '#eab308', 20),
  ('cteni', 'Čtení', '📚', 'volný čas', '#a855f7', 21),
  ('hrani_her', 'Hraní her', '🎮', 'volný čas', '#22c55e', 22),
  ('hudba', 'Hudba', '🎵', 'volný čas', '#ef4444', 23),
  ('sport', 'Sport', '🏃', 'sport', '#22c55e', 30),
  ('trenink', 'Trénink', '🏋️', 'sport', '#16a34a', 31),
  ('chuze', 'Chůze', '🚶', 'sport', '#84cc16', 32),
  ('kolo', 'Kolo', '🚲', 'sport', '#84cc16', 33),
  ('plavani', 'Plavání', '🏊', 'sport', '#06b6d4', 34),
  ('jist_zdrave', 'Jíst zdravě', '🥗', 'jídlo', '#22c55e', 40),
  ('restaurace', 'Restaurace', '🍽️', 'jídlo', '#f97316', 41),
  ('domaci_vyroba', 'Domácí výroba', '🧑‍🍳', 'jídlo', '#f59e0b', 42),
  ('relax', 'Relax', '🧘', 'wellness', '#8b5cf6', 50),
  ('meditovat', 'Meditovat', '🧘‍♂️', 'wellness', '#7c3aed', 51),
  ('slunecno', 'Slunečno', '☀️', 'počasí', '#eab308', 100),
  ('zatazeno', 'Zataženo', '☁️', 'počasí', '#9ca3af', 101),
  ('dest', 'Déšť', '🌧️', 'počasí', '#3b82f6', 102),
  ('snih', 'Sníh', '🌨️', 'počasí', '#e0e7ff', 103),
  ('horko', 'Horko', '🥵', 'počasí', '#ef4444', 104)
ON CONFLICT (key) DO NOTHING;

-- 4. HABIT CATALOG — výchozí návyky
CREATE TABLE IF NOT EXISTS habit_catalog (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  icon        TEXT DEFAULT '✅',
  category    TEXT DEFAULT 'obecné',
  color       TEXT DEFAULT '#6366f1',
  is_default  BOOLEAN DEFAULT true,
  is_negative BOOLEAN DEFAULT false,
  sort_order  SMALLINT DEFAULT 0
);

INSERT INTO habit_catalog (key, label, icon, category, is_negative, sort_order) VALUES
  ('cviceni', 'Cvičení', '🏋️', 'zdraví', false, 1),
  ('cist', 'Čtení', '📖', 'mysl', false, 2),
  ('meditace', 'Meditace', '🧘', 'mysl', false, 3),
  ('zdrave_jidlo', 'Zdravé jídlo', '🥗', 'zdraví', false, 4),
  ('piti_vody', 'Pití vody', '💧', 'zdraví', false, 5),
  ('alkohol', 'Alkohol', '🍺', 'zdraví', true, 10),
  ('porno', 'Porno', '🔞', 'mysl', true, 11),
  ('masturbace', 'Masturbace', '🫣', 'mysl', true, 12)
ON CONFLICT (key) DO NOTHING;

-- 5. USER_ACTIVITIES — vlastní aktivity
CREATE TABLE IF NOT EXISTS user_activities (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  label     TEXT NOT NULL,
  icon      TEXT DEFAULT '📌',
  category  TEXT DEFAULT 'vlastní',
  color     TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, key)
);

ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_activities_own ON user_activities FOR ALL USING (user_id = auth.uid());

-- 6. USER_HABITS — vlastní návyky
CREATE TABLE IF NOT EXISTS user_habits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  icon        TEXT DEFAULT '✅',
  category    TEXT DEFAULT 'vlastní',
  color       TEXT DEFAULT '#6366f1',
  is_negative BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, key)
);

ALTER TABLE user_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_habits_own ON user_habits FOR ALL USING (user_id = auth.uid());

-- HOTOVO ✓
