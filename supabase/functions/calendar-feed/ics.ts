export type CalendarRow = Record<string, any>;

type CalendarEvent = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  date: string;
  time?: string | null;
  duration?: number | null;
  updatedAt?: string | null;
  recurrence?: string | null;
  interval?: number | null;
  endDate?: string | null;
  excludedDates?: string[];
};

const CLOSED_ROUTE_STATUSES = new Set(["completed", "skipped", "cancelled", "canceled"]);
const CLOSED_TICKET_STATUSES = new Set(["completed", "cancelled", "canceled", "invoiced"]);

const cleanDate = (value: string) => value.slice(0, 10).replaceAll("-", "");
const cleanTime = (value?: string | null) => (value ? value.slice(0, 8).replaceAll(":", "").padEnd(6, "0") : "");

function addDays(value: string, days: number) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function addMinutes(dateValue: string, timeValue: string, minutes: number) {
  const [year, month, day] = dateValue.slice(0, 10).split("-").map(Number);
  const [hour = 9, minute = 0, second = 0] = timeValue.split(":").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second) + minutes * 60_000);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

function utcStamp(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string) {
  const encoder = new TextEncoder();
  const output: string[] = [];
  let current = "";
  for (const character of line) {
    if (current && encoder.encode(current + character).length > 72) {
      output.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  if (current) output.push(current);
  return output.join("\r\n ");
}

function joinAddress(...values: unknown[]) {
  return values.map((value) => String(value ?? "").trim()).filter(Boolean).join(", ");
}

function recurrenceRule(event: CalendarEvent) {
  if (!event.recurrence || event.recurrence === "none") return "";
  const interval = Math.max(1, Number(event.interval || 1));
  let frequency = "";
  let multiplier = interval;
  switch (event.recurrence) {
    case "daily": frequency = "DAILY"; break;
    case "weekly": frequency = "WEEKLY"; break;
    case "monthly": frequency = "MONTHLY"; break;
    case "quarterly": frequency = "MONTHLY"; multiplier = interval * 3; break;
    case "yearly": frequency = "YEARLY"; break;
    default: return "";
  }
  let rule = `FREQ=${frequency};INTERVAL=${multiplier}`;
  if (event.endDate) {
    rule += `;UNTIL=${event.time ? `${addMinutes(event.endDate, event.time, 24 * 60 - 1)}` : cleanDate(event.endDate)}`;
  }
  return rule;
}

function eventLines(event: CalendarEvent, generatedAt: Date) {
  const time = cleanTime(event.time);
  const duration = Math.max(15, Number(event.duration || 60));
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${utcStamp(generatedAt.toISOString())}`,
    `LAST-MODIFIED:${utcStamp(event.updatedAt || generatedAt.toISOString())}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];

  if (time) {
    lines.push(`DTSTART:${cleanDate(event.date)}T${time}`);
    lines.push(`DTEND:${addMinutes(event.date, event.time!, duration)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${cleanDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${addDays(event.date, 1)}`);
  }
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  const recurrence = recurrenceRule(event);
  if (recurrence) lines.push(`RRULE:${recurrence}`);
  if (event.excludedDates?.length) {
    const values = event.excludedDates.map((date) => time ? `${cleanDate(date)}T${time}` : cleanDate(date));
    lines.push(`${time ? "EXDATE" : "EXDATE;VALUE=DATE"}:${values.join(",")}`);
  }
  lines.push("STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT");
  return lines;
}

export function buildServiceCalendar(
  userId: string,
  routeStops: CalendarRow[],
  externalTickets: CalendarRow[],
  schedules: CalendarRow[],
  generatedAt = new Date(),
) {
  const events: CalendarEvent[] = [];
  const includedRouteStopIds = new Set<string>();

  for (const stop of routeStops) {
    if (!stop.scheduled_date || stop.route?.assigned_to !== userId || CLOSED_ROUTE_STATUSES.has(stop.status)) continue;
    includedRouteStopIds.add(stop.id);
    const routeName = stop.route?.name || "Service route";
    events.push({
      uid: `route-stop-${stop.id}@vendx`,
      summary: `Route: ${stop.stop_name}`,
      description: [
        `Route: ${routeName}`,
        `Status: ${stop.status}`,
        stop.priority ? `Priority: ${stop.priority}` : "",
        stop.machine?.name ? `Machine: ${stop.machine.name}${stop.machine.machine_code ? ` (${stop.machine.machine_code})` : ""}` : "",
        stop.notes ? `Notes: ${stop.notes}` : "",
      ].filter(Boolean).join("\n"),
      location: joinAddress(stop.address || stop.location?.address, stop.location?.city),
      date: stop.scheduled_date,
      duration: stop.estimated_duration_minutes,
      updatedAt: stop.updated_at,
    });
  }

  const assignedTickets = externalTickets.filter((ticket) =>
    ticket.scheduled_date &&
    ticket.assigned_technician_id === userId &&
    !ticket.merged_into_ticket_id &&
    !CLOSED_TICKET_STATUSES.has(ticket.status) &&
    !includedRouteStopIds.has(ticket.route_stop_id)
  );

  for (const ticket of assignedTickets) {
    events.push({
      uid: `external-ticket-${ticket.id}@vendx`,
      summary: `Service${ticket.ticket_number ? ` ${ticket.ticket_number}` : ""}: ${ticket.subject}`,
      description: [
        ticket.client?.company_name || ticket.client?.contact_name || ticket.intake_company_name || ticket.intake_contact_name
          ? `Client: ${ticket.client?.company_name || ticket.client?.contact_name || ticket.intake_company_name || ticket.intake_contact_name}` : "",
        `Status: ${ticket.status}`,
        ticket.priority ? `Priority: ${ticket.priority}` : "",
        ticket.machine?.asset_label ? `Machine: ${ticket.machine.asset_label}` : "",
        ticket.description ? `Work: ${ticket.description}` : "",
        ticket.access_notes ? `Access: ${ticket.access_notes}` : "",
      ].filter(Boolean).join("\n"),
      location: joinAddress(
        ticket.location?.address || ticket.intake_address,
        ticket.location?.city,
        ticket.location?.state,
        ticket.location?.postal_code,
      ),
      date: ticket.scheduled_date,
      time: ticket.scheduled_time,
      duration: ticket.estimated_duration_minutes,
      updatedAt: ticket.updated_at,
    });
  }

  for (const schedule of schedules) {
    if (!schedule.active || !schedule.next_run_date || schedule.assigned_technician_id !== userId) continue;
    if (schedule.recurrence === "none" && assignedTickets.some((ticket) => ticket.schedule_id === schedule.id && ticket.scheduled_date === schedule.next_run_date)) continue;
    const excludedDates = assignedTickets
      .filter((ticket) => ticket.schedule_id === schedule.id)
      .map((ticket) => ticket.scheduled_date);
    events.push({
      uid: `external-schedule-${schedule.id}@vendx`,
      summary: `${schedule.recurrence === "none" ? "Service" : "Recurring service"}: ${schedule.subject}`,
      description: [
        schedule.client?.company_name || schedule.client?.contact_name
          ? `Client: ${schedule.client.company_name || schedule.client.contact_name}` : "",
        schedule.service_package ? `Package: ${String(schedule.service_package).replaceAll("_", " ")}` : "",
        schedule.description ? `Work: ${schedule.description}` : "",
        schedule.access_notes ? `Access: ${schedule.access_notes}` : "",
      ].filter(Boolean).join("\n"),
      location: joinAddress(schedule.location?.address, schedule.location?.city, schedule.location?.state, schedule.location?.postal_code),
      date: schedule.next_run_date,
      time: schedule.preferred_time,
      duration: schedule.estimated_duration_minutes,
      updatedAt: schedule.updated_at,
      recurrence: schedule.recurrence,
      interval: schedule.interval_count,
      endDate: schedule.end_date,
      excludedDates,
    });
  }

  events.sort((a, b) => `${a.date}T${a.time || "99"}` .localeCompare(`${b.date}T${b.time || "99"}`));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VendX Global Corporation//My Service Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:VendX - My Service",
    "X-WR-CALDESC:Assigned route stops, service tickets and recurring visits from VendX.",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of events) lines.push(...eventLines(event, generatedAt));
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
