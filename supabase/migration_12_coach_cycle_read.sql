-- Миграция 12: тренер-автор видит составленный им план даже без активной связи
-- (например, если подопечный открепился — план остаётся у обоих, как у обычного владельца)

drop policy if exists "cycles: read own, public or coach" on cycles;

create policy "cycles: read own, public, author or coach" on cycles for select
  using (user_id = auth.uid() or is_public or created_by = auth.uid() or has_active_coach(user_id));
