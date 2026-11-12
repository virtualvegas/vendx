import { describe, expect, it } from "bun:test";
import { buildServiceCalendar } from "../supabase/functions/calendar-feed/ics.ts";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-11-12T16:00:00Z");

describe("employee service calendar", () => {
  it("includes only work assigned to the feed owner", () => {
    const calendar = buildServiceCalendar(ME, [
      { id: "mine-stop", stop_name: "My stop", scheduled_date: "2026-11-13", status: "pending", route: { assigned_to: ME } },
      { id: "other-stop", stop_name: "Other stop", scheduled_date: "2026-11-13", status: "pending", route: { assigned_to: OTHER } },
    ], [
      { id: "mine-ticket", subject: "My ticket", scheduled_date: "2026-11-14", status: "scheduled", assigned_technician_id: ME },
      { id: "other-ticket", subject: "Other ticket", scheduled_date: "2026-11-14", status: "scheduled", assigned_technician_id: OTHER },
    ], [
      { id: "mine-schedule", subject: "My recurring visit", next_run_date: "2026-11-15", active: true, assigned_technician_id: ME },
      { id: "other-schedule", subject: "Other recurring visit", next_run_date: "2026-11-15", active: true, assigned_technician_id: OTHER },
    ], NOW);

    expect(calendar).toContain("My stop");
    expect(calendar).toContain("My ticket");
    expect(calendar).toContain("My recurring visit");
    expect(calendar).not.toContain("Other stop");
    expect(calendar).not.toContain("Other ticket");
    expect(calendar).not.toContain("Other recurring visit");
  });

  it("omits completed and cancelled work", () => {
    const calendar = buildServiceCalendar(ME, [
      { id: "done", stop_name: "Finished stop", scheduled_date: "2026-11-13", status: "completed", route: { assigned_to: ME } },
    ], [
      { id: "cancelled", subject: "Cancelled visit", scheduled_date: "2026-11-14", status: "cancelled", assigned_technician_id: ME },
    ], [], NOW);

    expect(calendar).not.toContain("Finished stop");
    expect(calendar).not.toContain("Cancelled visit");
    expect(calendar).not.toContain("BEGIN:VEVENT");
  });

  it("keeps scheduled time local and creates an exclusive all-day end date", () => {
    const calendar = buildServiceCalendar(ME, [
      { id: "all-day", stop_name: "All day route", scheduled_date: "2026-11-13", status: "pending", route: { assigned_to: ME } },
    ], [
      { id: "timed", subject: "Timed visit", scheduled_date: "2026-11-14", scheduled_time: "09:30:00", estimated_duration_minutes: 90, status: "scheduled", assigned_technician_id: ME },
    ], [], NOW);

    expect(calendar).toContain("DTSTART;VALUE=DATE:20261113");
    expect(calendar).toContain("DTEND;VALUE=DATE:20261114");
    expect(calendar).toContain("DTSTART:20261114T093000");
    expect(calendar).toContain("DTEND:20261114T110000");
  });

  it("converts recurring schedules and avoids duplicate generated ticket occurrences", () => {
    const calendar = buildServiceCalendar(ME, [], [
      { id: "ticket", subject: "Generated visit", schedule_id: "schedule", scheduled_date: "2026-11-15", scheduled_time: "10:00:00", status: "scheduled", assigned_technician_id: ME },
    ], [
      { id: "schedule", subject: "Monthly maintenance", next_run_date: "2026-11-15", preferred_time: "10:00:00", recurrence: "monthly", interval_count: 1, active: true, assigned_technician_id: ME },
    ], NOW);

    expect(calendar).toContain("RRULE:FREQ=MONTHLY;INTERVAL=1");
    expect(calendar).toContain("EXDATE:20261115T100000");
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
