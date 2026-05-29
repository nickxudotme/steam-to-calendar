import { createEvents } from "ics";
import type { CalendarEvent } from "@/domain/calendar/event-mapper";

type IcsEvent = Parameters<typeof createEvents>[0][number];

export function generateCalendar(events: CalendarEvent[]): string {
  const { error, value } = createEvents(events.map(toIcsEvent));

  if (error || !value) {
    throw new Error(`Could not generate calendar: ${error?.message ?? "unknown error"}`);
  }

  return addCalendarMetadata(value);
}

export function calendarContentType(): string {
  return "text/calendar; charset=utf-8";
}

function toIcsEvent(event: CalendarEvent): IcsEvent {
  // CalendarEvent.startDate/endDate are all-day ISO dates, so the ics library expects
  // [year, month, day] arrays rather than JavaScript Date objects with timezone baggage.
  const common = {
    uid: `${event.id}@steam-to-calendar`,
    title: event.title,
    description: event.description,
    start: toDateArray(event.startDate),
    url: event.sourceUrl,
  };

  if (event.endDate) {
    return {
      ...common,
      end: toDateArray(event.endDate),
    };
  }

  return {
    ...common,
    end: toDateArray(nextIsoDate(event.startDate)),
  };
}

function toDateArray(date: string): [number, number, number] {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date: ${date}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function nextIsoDate(date: string): string {
  const [year, month, day] = toDateArray(date);
  const value = new Date(Date.UTC(year, month - 1, day + 1));

  return value.toISOString().slice(0, 10);
}

function addCalendarMetadata(calendar: string): string {
  // The ics package emits a generic PRODID. Patch the header so imported calendars carry
  // our product name and color in calendar clients.
  return calendar
    .replace(
      [
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "PRODID:adamgibbons/ics",
        "METHOD:PUBLISH",
        "X-PUBLISHED-TTL:PT1H",
        "",
      ].join("\r\n"),
      [
        "VERSION:2.0",
        "PRODID:-//steam-to-calendar//steam-to-calendar//EN",
        "X-WR-CALNAME:Steam to Calendar",
        "X-APPLE-CALENDAR-COLOR:#66C0F4",
        "CALSCALE:GREGORIAN",
        "",
      ].join("\r\n"),
    )
    .replace(/^URL:/gm, "URL;VALUE=URI:");
}
