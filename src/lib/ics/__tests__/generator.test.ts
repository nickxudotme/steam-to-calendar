import { describe, expect, it } from 'vitest';
import { calendarContentType, generateCalendar } from '../generator';
import type { CalendarEvent } from '@/lib/events/mapper';

describe('ICS generator', () => {
  it('generates text/calendar content type', () => {
    expect(calendarContentType()).toBe('text/calendar; charset=utf-8');
  });

  it('generates a one-day wishlist release event', () => {
    const calendar = generateCalendar([
      {
        id: 'steam-app-1962700-release',
        title: '🎮 Subnautica 2 releases',
        description: 'Steam app 1962700\nhttps://store.steampowered.com/app/1962700/',
        startDate: '2026-05-14',
        sourceUrl: 'https://store.steampowered.com/app/1962700/',
        type: 'wishlist_release',
      },
    ]);

    expect(calendar).toContain('BEGIN:VCALENDAR');
    expect(calendar).toContain('VERSION:2.0');
    expect(calendar).toContain('PRODID:-//steam-sale-calendar//sale-calendar//EN');
    expect(calendar).toContain('X-WR-CALNAME:Steam Sale Calendar');
    expect(calendar).toContain('X-APPLE-CALENDAR-COLOR:#66C0F4');
    expect(calendar).not.toContain('METHOD:PUBLISH');
    expect(calendar).not.toContain('X-PUBLISHED-TTL');
    expect(calendar).toContain('BEGIN:VEVENT');
    expect(calendar).toContain('UID:steam-app-1962700-release@wishlist-in-calendar');
    expect(calendar).toContain('SUMMARY:🎮 Subnautica 2 releases');
    expect(calendar).toContain('DTSTART;VALUE=DATE:20260514');
    expect(calendar).toContain('DTEND;VALUE=DATE:20260515');
    expect(calendar).not.toContain('DURATION:P1D');
    expect(calendar).toContain('URL;VALUE=URI:https://store.steampowered.com/app/1962700/');
    expect(calendar).toContain('END:VCALENDAR');
  });

  it('generates an all-day range event with exclusive DTEND', () => {
    const calendar = generateCalendar([
      {
        id: 'steam-summer-sale-2026',
        title: '🛒 Steam Summer Sale',
        description: 'Major Steam seasonal sale.',
        startDate: '2026-06-25',
        endDate: '2026-07-10',
        sourceUrl: 'https://store.steampowered.com/',
        type: 'steam_major_event',
      },
    ]);

    expect(calendar).toContain('UID:steam-summer-sale-2026@wishlist-in-calendar');
    expect(calendar).toContain('DTSTART;VALUE=DATE:20260625');
    expect(calendar).toContain('DTEND;VALUE=DATE:20260710');
    expect(calendar).not.toContain('DURATION:P1D');
  });

  it('escapes description text through the iCalendar library', () => {
    const calendar = generateCalendar([
      {
        id: 'escaping-test',
        title: 'Comma, Semicolon; Backslash \\',
        description: 'Line 1\nLine 2, with comma; and semicolon \\',
        startDate: '2026-01-01',
        type: 'wishlist_release',
      },
    ]);

    expect(calendar).toContain('SUMMARY:Comma\\, Semicolon\\; Backslash \\\\');
    expect(calendar).toContain('DESCRIPTION:Line 1\\nLine 2\\, with comma\\; and semicolon \\\\');
  });

  it('rejects invalid ISO dates', () => {
    expect(() =>
      generateCalendar([
        {
          id: 'bad-date',
          title: 'Bad date',
          description: 'Invalid',
          startDate: 'May 14, 2026',
          type: 'wishlist_release',
        },
      ]),
    ).toThrow('Invalid date');
  });
});
