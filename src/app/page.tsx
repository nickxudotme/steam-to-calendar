'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { mapSteamMajorEvents } from '@/lib/events/mapper';

type PreviewEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  sourceUrl?: string;
  type: 'wishlist_release' | 'steam_major_event';
};

type PreviewResponse = {
  steamId64: string;
  feedPath: string;
  calendarPath: string;
  wishlistUrl: string;
  stats: {
    wishlistGames: number;
    appDetails: number;
    skippedAppIds: number;
    wishlistReleaseEvents: number;
    steamMajorEvents: number;
  };
  events: PreviewEvent[];
};

type CalendarCell = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  events: PreviewEvent[];
};

type CalendarEventSegment = {
  event: PreviewEvent;
  weekIndex: number;
  lane: number;
  startColumn: number;
  endColumn: number;
  startsAtEvent: boolean;
  endsAtEvent: boolean;
};

const STEAM_EVENTS_CALENDAR_ID = 'steam-events';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_EVENT_LANES = 3;
const PREVIEW_TODAY_ISO = '2026-06-15';
const PUBLIC_STEAM_EVENTS = mapSteamMajorEvents(undefined, { today: '2026-05-20' });
const PUBLIC_PREVIEW: PreviewResponse = {
  steamId64: STEAM_EVENTS_CALENDAR_ID,
  feedPath: `/feed/${STEAM_EVENTS_CALENDAR_ID}.ics`,
  calendarPath: `/cal/${STEAM_EVENTS_CALENDAR_ID}`,
  wishlistUrl: '',
  stats: {
    wishlistGames: 0,
    appDetails: 0,
    skippedAppIds: 0,
    wishlistReleaseEvents: 0,
    steamMajorEvents: PUBLIC_STEAM_EVENTS.length,
  },
  events: PUBLIC_STEAM_EVENTS,
};

export default function Home() {
  const [steamId64, setSteamId64] = useState('');
  const [preview, setPreview] = useState<PreviewResponse>(PUBLIC_PREVIEW);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthKeyFromIsoDate(PUBLIC_PREVIEW.events[0]?.startDate ?? new Date().toISOString().slice(0, 10)));
  const [origin, setOrigin] = useState('');

  const webcalUrl = useMemo(() => {
    const calendarUrl = origin ? `${origin}${preview.calendarPath}` : preview.calendarPath;

    return calendarUrl.replace(/^https?:\/\//, 'webcal://');
  }, [origin, preview]);

  const sortedEvents = useMemo(() => {
    return [...preview.events].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [preview]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (sortedEvents.length > 0) {
      setVisibleMonth(monthKeyFromIsoDate(sortedEvents[0].startDate));
    }
  }, [sortedEvents]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSteamId64 = steamId64.trim();

    if (!trimmedSteamId64) {
      window.location.href = webcalUrl;
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ steamId64: trimmedSteamId64 }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? 'Could not preview this Steam wishlist.');
      }

      setPreview(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not preview this Steam wishlist.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="appRoot">
      <div className="shell">
        <header className="siteHeader">
          <a className="brandMark" href="/" aria-label="Wishlist in Calendar home">
            <span className="brandIcon"><CalendarListIcon /></span>
            <span>Wishlist in Calendar</span>
            <span className="betaBadge">Beta</span>
          </a>
        </header>

        <section className="heroStage" aria-label="Wishlist in Calendar preview">
          <div className="heroCopy">
            <h1>
              Put your Steam wishlist into <span>your calendar.</span>
            </h1>
            <p>
              Enter a public Steam profile to preview upcoming wishlist releases and subscribe from your calendar app.
            </p>

            <form className="steamConnectForm" onSubmit={handleSubmit} aria-label="Add Steam wishlist releases to the calendar">
              <label className="srOnly" htmlFor="steam-id">Add your Steam wishlist</label>
              <div className="steamInputWrap">
                <CalendarListIcon />
                <input
                  id="steam-id"
                  inputMode="text"
                  placeholder="Enter SteamID64 or profile URL"
                  value={steamId64}
                  onChange={(event) => setSteamId64(event.target.value)}
                />
                <LinkIcon />
              </div>
              <button disabled={isLoading} type="submit">
                <CalendarListIcon />
                {isLoading ? 'Adding...' : 'Add to your Calendar'}
              </button>
            </form>

            {error ? <div className="notice error">{error}</div> : null}
          </div>

          <div className="calendarExperience">
            <CalendarPreview
              events={sortedEvents}
              visibleMonth={visibleMonth}
              onPreviousMonth={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}
              onNextMonth={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function CalendarPreview({
  events,
  visibleMonth,
  onPreviousMonth,
  onNextMonth,
}: {
  events: PreviewEvent[];
  visibleMonth: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}) {
  const previewData = useMemo(() => buildCalendarPreviewData(visibleMonth, events), [visibleMonth, events]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const activeEvent = activeEventId ? events.find((event) => event.id === activeEventId) ?? null : null;

  useEffect(() => {
    setActiveEventId(null);
  }, [visibleMonth]);

  return (
    <section className="calendarApp" aria-label="Calendar preview" onMouseLeave={() => setActiveEventId(null)}>
      <div className="calendarHeader">
        <div className="monthControls" aria-label="Month navigation">
          <button type="button" onClick={onPreviousMonth} aria-label="Previous month">
            <ChevronIcon direction="left" />
          </button>
          <button type="button" onClick={onNextMonth} aria-label="Next month">
            <ChevronIcon direction="right" />
          </button>
        </div>

        <h2>{formatCalendarMonthTitle(visibleMonth)}</h2>

        <div className="calendarControls">
          <button className="settingsButton" type="button" aria-label="Calendar settings">
            <SettingsIcon />
          </button>
        </div>
      </div>

      <div
        className="calendarGrid"
        role="grid"
        aria-label={`${formatMonth(visibleMonth)} calendar preview`}
      >
        {WEEKDAYS.map((weekday) => (
          <div className="weekday" key={weekday} role="columnheader">{weekday}</div>
        ))}
        {previewData.cells.map((cell, index) => (
          <div
            className={cell.isCurrentMonth ? 'dayCell' : 'dayCell outsideMonth'}
            key={cell.date}
            role="gridcell"
            aria-label={`${formatDate(cell.date)}${cell.events.length ? `, ${cell.events.length} events` : ''}`}
            style={{
              gridColumn: (index % 7) + 1,
              gridRow: Math.floor(index / 7) + 2,
            } as CSSProperties}
          >
            <span className={cell.date === PREVIEW_TODAY_ISO ? 'dayNumber isToday' : 'dayNumber'}>{cell.day}</span>
          </div>
        ))}
        {previewData.segments.map((segment) => (
          <button
            aria-label={segment.event.title}
            className={[
              'calendarSegment',
              segment.event.type,
              eventVisualClass(segment.event),
              activeEventId === segment.event.id ? 'isSelected' : '',
              segment.startsAtEvent ? 'startsAtEvent' : '',
              segment.endsAtEvent ? 'endsAtEvent' : '',
            ].filter(Boolean).join(' ')}
            data-event-id={segment.event.id}
            data-testid="calendar-event-segment"
            key={`${segment.event.id}-${segment.weekIndex}`}
            style={{
              '--segment-lane': segment.lane,
              gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
              gridRow: segment.weekIndex + 2,
            } as CSSProperties}
            title={segment.event.title}
            type="button"
            onFocus={() => setActiveEventId(segment.event.id)}
            onMouseEnter={() => setActiveEventId(segment.event.id)}
          >
            <span className="segmentTitle">{compactEventTitle(segment.event.title)}</span>
          </button>
        ))}
      </div>

      {activeEvent ? (
        <EventPopover event={activeEvent} isPersonalized={events.some((event) => event.type === 'wishlist_release')} />
      ) : null}
    </section>
  );
}

function CalendarListIcon() {
  return (
    <svg aria-hidden="true" className="toolbarSvg" viewBox="0 0 20 20">
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <path d="M4 8.2h12M7.8 4v12M4 12.1h12" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" className="chevronIcon" viewBox="0 0 20 20">
      <path d={direction === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'} />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="miniIcon" viewBox="0 0 20 20">
      <path d="M8.9 3.2h2.2l.5 1.8 1.3.5 1.6-.9 1.6 1.6-.9 1.6.5 1.3 1.8.5v2.2l-1.8.5-.5 1.3.9 1.6-1.6 1.6-1.6-.9-1.3.5-.5 1.8H8.9l-.5-1.8-1.3-.5-1.6.9-1.6-1.6.9-1.6-.5-1.3-1.8-.5V9.6l1.8-.5.5-1.3-.9-1.6 1.6-1.6 1.6.9 1.3-.5.5-1.8Z" />
      <circle cx="10" cy="10.7" r="2.2" />
    </svg>
  );
}

function EventPopover({ event, isPersonalized }: { event: PreviewEvent; isPersonalized: boolean }) {
  const sourceHost = event.sourceUrl ? new URL(event.sourceUrl).host : null;
  const isWishlistRelease = event.type === 'wishlist_release';
  const isSale = eventVisualClass(event) === 'saleEvent';

  return (
    <aside className="calendarPopover" aria-label={`${event.title} details`} data-testid="event-popover">
      <div className="popoverAnchor" aria-hidden="true" />
      <div className={`popoverBanner ${eventVisualClass(event)}`} aria-hidden="true" />
      <div className="popoverHeader">
        <h3>{event.title}</h3>
      </div>
      <div className="popoverCalendar">
        <span className={`calendarDot ${event.type} ${eventVisualClass(event)}`} />
        <span>Wishlist in Calendar</span>
        <ChevronIcon direction="right" />
      </div>
      {event.sourceUrl ? (
        <div className="popoverLink">
          <LinkIcon />
          <span>{sourceHost}</span>
          <a href={event.sourceUrl} target="_blank" rel="noreferrer">Open site</a>
        </div>
      ) : null}
      <time className="popoverDate" dateTime={event.startDate}>
        {formatPopoverDateRange(event)}
      </time>
      <div className="popoverMeta">
        {isWishlistRelease ? 'Release date from your wishlist' : isPersonalized ? 'Wishlist-related Steam season' : 'Add SteamID64 to see wishlist matches'}
      </div>
      <p>{event.description.split('\n')[0]}</p>
      {isSale ? (
        <div className="popoverMatches" aria-label="Wishlist sale matches">
          <div className="matchSummary">
            <span>8 wishlist games on sale</span>
            <ChevronIcon direction="right" />
          </div>
          <div className="discountRow">
            <span className="gameThumb red" />
            <span>RPG adventure</span>
            <strong>-60%</strong>
          </div>
          <div className="discountRow">
            <span className="gameThumb amber" />
            <span>Co-op roguelite</span>
            <strong>-50%</strong>
          </div>
          <div className="discountRow">
            <span className="gameThumb blue" />
            <span>Detective story</span>
            <strong>-75%</strong>
          </div>
        </div>
      ) : null}
      {event.sourceUrl ? <a className="popoverUrl" href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceUrl}</a> : null}
    </aside>
  );
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" className="linkIcon" viewBox="0 0 20 20">
      <path d="M8.2 11.8a3 3 0 0 1 0-4.2l2-2a3 3 0 1 1 4.2 4.2l-1.1 1.1" />
      <path d="M11.8 8.2a3 3 0 0 1 0 4.2l-2 2a3 3 0 1 1-4.2-4.2l1.1-1.1" />
    </svg>
  );
}

function buildCalendarPreviewData(monthKey: string, events: PreviewEvent[]): {
  cells: CalendarCell[];
  segments: CalendarEventSegment[];
} {
  const [year, month] = monthKey.split('-').map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - firstOfMonth.getUTCDay());
  const gridStartIso = gridStart.toISOString().slice(0, 10);

  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const isoDate = date.toISOString().slice(0, 10);

    return {
      date: isoDate,
      day: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === month - 1,
      events: events.filter((event) => eventOccursOn(event, isoDate)),
    };
  });

  return {
    cells,
    segments: buildCalendarEventSegments(events, gridStartIso),
  };
}

function eventOccursOn(event: PreviewEvent, isoDate: string): boolean {
  if (!event.endDate) {
    return event.startDate === isoDate;
  }

  return event.startDate <= isoDate && isoDate < event.endDate;
}

function buildCalendarEventSegments(events: PreviewEvent[], gridStartIso: string): CalendarEventSegment[] {
  const gridEndExclusive = addDays(gridStartIso, 42);
  const occupied: Array<Array<Array<{ startColumn: number; endColumn: number }>>> = Array.from(
    { length: 6 },
    () => Array.from({ length: MAX_EVENT_LANES }, () => []),
  );

  return events
    .flatMap((event) => {
      const eventStart = event.startDate;
      const eventEndExclusive = event.endDate ?? addDays(event.startDate, 1);

      if (eventEndExclusive <= gridStartIso || eventStart >= gridEndExclusive) {
        return [];
      }

      const visibleStartIndex = daysBetween(gridStartIso, maxIsoDate(eventStart, gridStartIso));
      const visibleEndIndex = daysBetween(gridStartIso, minIsoDate(eventEndExclusive, gridEndExclusive));
      const segments = [];

      for (
        let weekIndex = Math.floor(visibleStartIndex / 7);
        weekIndex <= Math.floor((visibleEndIndex - 1) / 7);
        weekIndex += 1
      ) {
        const weekStartIndex = weekIndex * 7;
        const segmentStartIndex = Math.max(visibleStartIndex, weekStartIndex);
        const segmentEndIndex = Math.min(visibleEndIndex - 1, weekStartIndex + 6);
        const startColumn = segmentStartIndex - weekStartIndex;
        const endColumn = segmentEndIndex - weekStartIndex;
        const lane = reserveSegmentLane(occupied, weekIndex, startColumn, endColumn);

        if (lane === null) {
          continue;
        }

        const segmentStartDate = addDays(gridStartIso, segmentStartIndex);
        const segmentEndExclusive = addDays(gridStartIso, segmentEndIndex + 1);

        segments.push({
          event,
          weekIndex,
          lane,
          startColumn,
          endColumn,
          startsAtEvent: segmentStartDate === eventStart,
          endsAtEvent: segmentEndExclusive === eventEndExclusive,
        });
      }

      return segments;
    });
}

function reserveSegmentLane(
  occupied: Array<Array<Array<{ startColumn: number; endColumn: number }>>>,
  weekIndex: number,
  startColumn: number,
  endColumn: number,
): number | null {
  for (let lane = 0; lane < MAX_EVENT_LANES; lane += 1) {
    const hasCollision = occupied[weekIndex][lane].some((range) =>
      startColumn <= range.endColumn && range.startColumn <= endColumn,
    );

    if (!hasCollision) {
      occupied[weekIndex][lane].push({ startColumn, endColumn });
      return lane;
    }
  }

  return null;
}

function daysBetween(startIso: string, endIso: string): number {
  return Math.round((Date.parse(`${endIso}T00:00:00.000Z`) - Date.parse(`${startIso}T00:00:00.000Z`)) / 86_400_000);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function maxIsoDate(first: string, second: string): string {
  return first >= second ? first : second;
}

function minIsoDate(first: string, second: string): string {
  return first <= second ? first : second;
}

function monthKeyFromIsoDate(value: string): string {
  return value.slice(0, 7);
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1 + delta, 1));
  return value.toISOString().slice(0, 7);
}

function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatCalendarMonthTitle(value: string): string {
  return formatMonth(value);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatPopoverDateRange(event: PreviewEvent): string {
  if (!event.endDate) {
    return formatDate(event.startDate);
  }

  return `${formatDate(event.startDate)} – ${formatDate(addDays(event.endDate, -1))}`;
}

function eventVisualClass(event: PreviewEvent): string {
  if (event.type === 'wishlist_release') {
    return 'wishlistEvent';
  }

  if (event.id.includes('next-fest')) {
    return 'nextFestEvent';
  }

  if (event.id.includes('sale')) {
    return 'saleEvent';
  }

  return 'seasonalEvent';
}

function compactEventTitle(title: string): string {
  return title
    .replace(/^🎮\s*/, '')
    .replace(/^🧪\s*Steam\s*/, '')
    .replace(/^🛒\s*Steam\s*/, '');
}
