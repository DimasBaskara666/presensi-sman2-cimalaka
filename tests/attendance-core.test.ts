import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type CheckInResult = "rejected" | "on_time" | "late";

function classifyCheckIn(localTime: string): CheckInResult {
  if (localTime < "06:30:00.000") return "rejected";
  return localTime <= "06:45:00.000" ? "on_time" : "late";
}

test("approved check-in boundaries are exact", () => {
  assert.equal(classifyCheckIn("06:29:59.999"), "rejected");
  assert.equal(classifyCheckIn("06:30:00.000"), "on_time");
  assert.equal(classifyCheckIn("06:45:00.000"), "on_time");
  assert.equal(classifyCheckIn("06:45:00.001"), "late");
});

test("Attendance Core migration preserves one Student/date and immutable snapshots", async () => {
  const foundation = await readFile(
    new URL("../supabase/migrations/20260820000000_foundation.sql", import.meta.url),
    "utf8",
  );
  const sql = await readFile(
    new URL("../supabase/migrations/20260825200000_attendance_core.sql", import.meta.url),
    "utf8",
  );
  assert.match(foundation, /attendance_daily_student_date_unique unique \(student_id, attendance_date\)/);
  assert.match(sql, /student_login_id_snapshot text/);
  assert.match(sql, /student_full_name_snapshot text/);
  assert.match(sql, /student_class_name_snapshot text/);
  assert.match(sql, /alter column student_login_id_snapshot set not null/);
  assert.match(sql, /create trigger attendance_daily_set_student_snapshot/);
  assert.match(sql, /where p\.id = new\.student_id[\s\S]*and p\.role = 'student'/);
  const transactionalSql = sql.slice(sql.indexOf("create function private.apply_attendance_check_in"));
  assert.doesNotMatch(
    transactionalSql,
    /student_(?:login_id|full_name|class_name)_snapshot\s*=/,
  );
});

test("database functions own live timestamps, status, weekdays, and checkout minimums", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260825200000_attendance_core.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /v_local_time < v_settings\.official_start_time/);
  assert.match(sql, /v_local_time <= v_settings\.on_time_cutoff/);
  assert.match(sql, /v_status := 'on_time'/);
  assert.match(sql, /v_status := 'late'/);
  assert.match(sql, /v_iso_day in \(6, 7\)/);
  assert.match(sql, /when 1 then v_settings\.monday_checkout_minimum/);
  assert.match(sql, /when 4 then v_settings\.thursday_checkout_minimum/);
  assert.match(sql, /when 5 then v_settings\.friday_checkout_minimum/);
  assert.match(sql, /v_local_time < v_checkout_minimum/);

  const manualFunctions = [
    sql.match(/create function public\.record_manual_check_in[\s\S]*?\$\$;/)?.[0] ?? "",
    sql.match(/create function public\.record_manual_absence[\s\S]*?\$\$;/)?.[0] ?? "",
    sql.match(/create function public\.record_manual_check_out[\s\S]*?\$\$;/)?.[0] ?? "",
  ];
  for (const source of manualFunctions) {
    assert.match(source, /clock_timestamp\(\)/);
    assert.doesNotMatch(source, /p_event_at|p_attendance_date|p_method|p_actor_id/);
  }
});

test("presence, absence, and duplicate transitions remain database-controlled", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260825200000_attendance_core.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /on conflict \(student_id, attendance_date\) do nothing/);
  assert.match(sql, /for update/);
  assert.match(sql, /if v_existing\.check_in_at is not null then return v_existing\.id/);
  assert.match(sql, /absence_category = null[\s\S]*absence_recorded_at = null/);
  assert.match(sql, /if v_existing\.check_in_at is not null then[\s\S]*attendance_presence_exists/);
  assert.match(sql, /attendance_check_in_required/);
  assert.doesNotMatch(sql, /generate_series|automatically absent|auto_absent/i);
});

test("Admin corrections are reasoned, audited, and database-revalidated", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260825200000_attendance_core.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create table public\.attendance_corrections/);
  assert.match(sql, /before_data jsonb not null/);
  assert.match(sql, /after_data jsonb not null/);
  assert.match(sql, /if \(select private\.current_user_role\(\)\) is distinct from 'admin'/);
  assert.match(sql, /v_reason := btrim\(p_reason\)/);
  assert.match(sql, /insert into public\.attendance_corrections/);
  assert.match(sql, /v_before_data[\s\S]*to_jsonb\(v_after\)/);
  assert.match(sql, /attendance_check_in_date_mismatch/);
  assert.match(sql, /attendance_checkout_too_early/);
  assert.match(sql, /attendance_presence_or_absence_required/);
  assert.match(sql, /attendance_future_timestamp_rejected/);
});

test("settings and grants are hardened without browser table writes", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260825200000_attendance_core.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /attendance_settings_checkout_after_cutoff/);
  assert.match(sql, /pg_catalog\.pg_timezone_names/);
  assert.match(sql, /drop policy attendance_settings_update_admin/);
  assert.match(sql, /revoke update on table public\.attendance_settings from authenticated/);
  assert.match(sql, /revoke update \([\s\S]*updated_by[\s\S]*\) on table public\.attendance_settings from authenticated/);
  assert.match(sql, /updated_by = v_actor_id/);
  assert.match(sql, /revoke insert, update, delete on table public\.attendance_daily from anon, authenticated/);
  assert.match(sql, /revoke all on table public\.attendance_daily from service_role/);
  assert.match(sql, /revoke all on table public\.attendance_corrections from service_role/);
  assert.match(sql, /attendance_corrections_select_admin/);
  assert.match(sql, /grant execute on function public\.record_manual_check_in\(uuid\) to authenticated/);
  assert.match(sql, /grant execute on function public\.correct_attendance[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all) on table public\.attendance_daily/i);
  assert.doesNotMatch(sql, /disable row level security/i);
  assert.doesNotMatch(sql, /create function public\.[a-z0-9_]*qr/i);
});
