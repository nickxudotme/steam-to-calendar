'use client';

import type { CSSProperties, FormEvent, WheelEvent } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

type CalendarWeek = {
  weekStartIso: string;
  cells: CalendarCell[];
  segments: CalendarEventSegment[];
};

const STEAM_EVENTS_CALENDAR_ID = 'steam-events';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_EVENT_LANES = 3;
const INITIAL_WEEK_BUFFER = 8;
const INITIAL_WEEK_SPAN = 34;
const WEEK_EXTENSION_SIZE = 16;
const WEEK_EXTENSION_THRESHOLD = 4;
const MONTH_WHEEL_THRESHOLD = 20;
const MONTH_SCROLL_COOLDOWN_MS = 620;
const PREVIEW_TODAY_ISO = '2026-06-15';
const INITIAL_PREVIEW_MONTH = monthKeyFromIsoDate(PREVIEW_TODAY_ISO);
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
  const [initialMonth, setInitialMonth] = useState(INITIAL_PREVIEW_MONTH);
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
    setInitialMonth(INITIAL_PREVIEW_MONTH);
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
            <span className="brandIcon">
              <img src="/logo/wishlist-in-calendar-logo.png" alt="" />
            </span>
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
              initialMonth={initialMonth}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function CalendarPreview({
  events,
  initialMonth,
}: {
  events: PreviewEvent[];
  initialMonth: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const weekRefs = useRef(new Map<string, HTMLElement>());
  const initialWeekStart = useMemo(() => calendarGridStartForMonth(initialMonth), [initialMonth]);
  const [weekRange, setWeekRange] = useState(() => buildInitialWeekRange(initialWeekStart));
  const weeks = useMemo(() => buildContinuousCalendarWeeks(events, weekRange.startIso, weekRange.endIso), [events, weekRange]);
  const shouldAlignInitialWeek = useRef(true);
  const hasUserScrollIntent = useRef(false);
  const isMonthScrollLocked = useRef(false);
  const monthScrollUnlockTimer = useRef<number | null>(null);
  const pendingMonthScroll = useRef<string | null>(null);
  const pendingPrepend = useRef<null | {
    previousFirstWeek: string;
    previousScrollTop: number;
  }>(null);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const activeEvent = activeEventId ? events.find((event) => event.id === activeEventId) ?? null : null;

  useLayoutEffect(() => {
    shouldAlignInitialWeek.current = true;
    setWeekRange(buildInitialWeekRange(initialWeekStart));
  }, [initialWeekStart]);

  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    if (pendingPrepend.current) {
      const preservedWeek = weekRefs.current.get(pendingPrepend.current.previousFirstWeek);

      if (preservedWeek) {
        scrollElement.scrollTop = pendingPrepend.current.previousScrollTop + preservedWeek.offsetTop - scrollElement.offsetTop;
      }

      pendingPrepend.current = null;
      return;
    }

    if (!shouldAlignInitialWeek.current) {
      if (pendingMonthScroll.current) {
        const targetMonth = pendingMonthScroll.current;
        pendingMonthScroll.current = null;
        scrollToCalendarMonth(targetMonth, 'auto');
      }

      return;
    }

    const targetWeek = weekRefs.current.get(initialWeekStart);

    if (scrollElement && targetWeek) {
      scrollElement.scrollTop = targetWeek.offsetTop - scrollElement.offsetTop;
      setVisibleMonth(initialMonth);
      shouldAlignInitialWeek.current = false;
    }
  }, [initialMonth, initialWeekStart, weeks]);

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    let frameId = 0;
    const updateVisibleMonth = () => {
      if (shouldAlignInitialWeek.current) {
        return;
      }

      frameId = 0;
      const scrollTop = scrollElement.scrollTop;
      let nearestWeek = weeks[0]?.weekStartIso ?? initialWeekStart;
      let nearestDistance = Number.POSITIVE_INFINITY;

      weekRefs.current.forEach((node, weekStartIso) => {
        const distance = Math.abs(node.offsetTop - scrollElement.offsetTop - scrollTop);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestWeek = weekStartIso;
        }
      });

      setVisibleMonth(inferVisibleMonthFromWeek(nearestWeek));

      if (!hasUserScrollIntent.current) {
        return;
      }

      const rowHeight = getCalendarWeekStep(scrollElement);

      if (scrollTop < rowHeight * WEEK_EXTENSION_THRESHOLD) {
        pendingPrepend.current = {
          previousFirstWeek: weekRange.startIso,
          previousScrollTop: scrollTop,
        };
        setWeekRange((range) => ({
          startIso: addDays(range.startIso, -WEEK_EXTENSION_SIZE * 7),
          endIso: range.endIso,
        }));
        return;
      }

      if (scrollElement.scrollHeight - scrollElement.clientHeight - scrollTop < rowHeight * WEEK_EXTENSION_THRESHOLD) {
        setWeekRange((range) => ({
          startIso: range.startIso,
          endIso: addDays(range.endIso, WEEK_EXTENSION_SIZE * 7),
        }));
      }
    };

    const handleScroll = () => {
      if (frameId) {
        return;
      }

      frameId = requestAnimationFrame(updateVisibleMonth);
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    updateVisibleMonth();

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [initialMonth, initialWeekStart, weekRange, weeks]);

  useEffect(() => {
    setActiveEventId(null);
  }, [visibleMonth]);

  useEffect(() => {
    return () => {
      if (monthScrollUnlockTimer.current !== null) {
        window.clearTimeout(monthScrollUnlockTimer.current);
      }
    };
  }, []);

  function markCalendarScrollIntent() {
    hasUserScrollIntent.current = true;
  }

  function unlockMonthScrollAfterCooldown() {
    if (monthScrollUnlockTimer.current !== null) {
      window.clearTimeout(monthScrollUnlockTimer.current);
    }

    monthScrollUnlockTimer.current = window.setTimeout(() => {
      isMonthScrollLocked.current = false;
    }, MONTH_SCROLL_COOLDOWN_MS);
  }

  function scrollToCalendarMonth(monthKey: string, behavior: ScrollBehavior = 'smooth') {
    const scrollElement = scrollRef.current;
    const targetWeekIso = calendarGridStartForMonth(monthKey);
    const targetWeek = weekRefs.current.get(targetWeekIso);

    if (!scrollElement || !targetWeek) {
      pendingMonthScroll.current = monthKey;
      setWeekRange((range) => ({
        startIso: targetWeekIso < range.startIso ? addDays(targetWeekIso, -WEEK_EXTENSION_SIZE * 7) : range.startIso,
        endIso: targetWeekIso >= range.endIso ? addDays(targetWeekIso, (WEEK_EXTENSION_SIZE + 1) * 7) : range.endIso,
      }));
      return;
    }

    scrollElement.scrollTo({
      top: targetWeek.offsetTop - scrollElement.offsetTop,
      behavior,
    });
    setVisibleMonth(monthKey);
  }

  function handleCalendarWheel(event: WheelEvent<HTMLDivElement>) {
    markCalendarScrollIntent();

    if (Math.abs(event.deltaY) < MONTH_WHEEL_THRESHOLD) {
      return;
    }

    event.preventDefault();

    if (isMonthScrollLocked.current) {
      return;
    }

    isMonthScrollLocked.current = true;
    scrollToCalendarMonth(shiftMonth(visibleMonth, event.deltaY > 0 ? 1 : -1));
    unlockMonthScrollAfterCooldown();
  }

  return (
    <section className="calendarApp" aria-label="Calendar preview" onMouseLeave={() => setActiveEventId(null)}>
      <div className="calendarHeader">
        <div className="calendarHeaderSpacer" aria-hidden="true" />

        <h2>{formatCalendarMonthTitle(visibleMonth)}</h2>

        <div className="calendarControls">
          <button className="settingsButton" type="button" aria-label="Calendar settings">
            <SettingsIcon />
          </button>
        </div>
      </div>

      <div
        className="calendarWeekdays"
        aria-hidden="true"
      >
        {WEEKDAYS.map((weekday) => (
          <div className="weekday" key={weekday}>{weekday}</div>
        ))}
      </div>

      <div
        className="calendarScroll"
        ref={scrollRef}
        aria-label="Scrollable calendar weeks"
        onKeyDown={markCalendarScrollIntent}
        onPointerDown={markCalendarScrollIntent}
        onTouchStart={markCalendarScrollIntent}
        onWheel={handleCalendarWheel}
        tabIndex={0}
      >
        <div className="calendarTimeline" role="grid" aria-label="Continuous calendar grid">
          {weeks.map((week) => (
            <div
              aria-label={`Week of ${formatDate(week.weekStartIso)}`}
              className="calendarWeek"
              data-week-start={week.weekStartIso}
              key={week.weekStartIso}
              ref={(node) => {
                if (node) {
                  weekRefs.current.set(week.weekStartIso, node);
                } else {
                  weekRefs.current.delete(week.weekStartIso);
                }
              }}
              role="row"
            >
              {week.cells.map((cell, index) => (
                <div
                  className={cell.date.startsWith(`${visibleMonth}-`) ? 'dayCell' : 'dayCell outsideMonth'}
                  key={cell.date}
                  role="gridcell"
                  aria-label={`${formatDate(cell.date)}${cell.events.length ? `, ${cell.events.length} events` : ''}`}
                  style={{ gridColumn: index + 1 } as CSSProperties}
                >
                  <span className={cell.date === PREVIEW_TODAY_ISO ? 'dayNumber isToday' : 'dayNumber'}>{cell.day}</span>
                </div>
              ))}
              {week.segments.map((segment) => (
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
                  key={`${week.weekStartIso}-${segment.event.id}`}
                  style={{
                    '--segment-lane': segment.lane,
                    '--segment-start': segment.startColumn,
                    '--segment-span': segment.endColumn - segment.startColumn + 1,
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
          ))}
        </div>
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

function buildInitialWeekRange(initialWeekStart: string): { startIso: string; endIso: string } {
  const startIso = addDays(initialWeekStart, -INITIAL_WEEK_BUFFER * 7);

  return {
    startIso,
    endIso: addDays(startIso, INITIAL_WEEK_SPAN * 7),
  };
}

function buildContinuousCalendarWeeks(events: PreviewEvent[], gridStartIso: string, gridEndIso: string): CalendarWeek[] {
  const weeks = [];

  for (let weekStartIso = gridStartIso; weekStartIso < gridEndIso; weekStartIso = addDays(weekStartIso, 7)) {
    const cells = Array.from({ length: 7 }, (_, index) => {
      const isoDate = addDays(weekStartIso, index);
      const [, , day] = isoDate.split('-').map(Number);

      return {
        date: isoDate,
        day,
        isCurrentMonth: true,
        events: events.filter((event) => eventOccursOn(event, isoDate)),
      };
    });

    weeks.push({
      weekStartIso,
      cells,
      segments: buildWeekEventSegments(events, weekStartIso),
    });
  }

  return weeks;
}

function calendarGridStartForMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  firstOfMonth.setUTCDate(firstOfMonth.getUTCDate() - firstOfMonth.getUTCDay());
  return firstOfMonth.toISOString().slice(0, 10);
}

function calendarGridEndForMonth(monthKey: string): string {
  const [year, month] = shiftMonth(monthKey, 1).split('-').map(Number);
  const firstOfNextMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysToNextSunday = (7 - firstOfNextMonth.getUTCDay()) % 7;
  firstOfNextMonth.setUTCDate(firstOfNextMonth.getUTCDate() + daysToNextSunday);
  return firstOfNextMonth.toISOString().slice(0, 10);
}

function inferVisibleMonthFromWeek(weekStartIso: string): string {
  for (let index = 0; index < 7; index += 1) {
    const isoDate = addDays(weekStartIso, index);

    if (isoDate.endsWith('-01')) {
      return monthKeyFromIsoDate(isoDate);
    }
  }

  return monthKeyFromIsoDate(addDays(weekStartIso, 3));
}

function getCalendarWeekStep(scrollElement: HTMLElement): number {
  const firstWeek = scrollElement.querySelector<HTMLElement>('.calendarWeek');
  const timeline = scrollElement.querySelector<HTMLElement>('.calendarTimeline');

  if (!firstWeek) {
    return 103;
  }

  const gap = timeline ? Number.parseFloat(getComputedStyle(timeline).rowGap || '0') : 0;
  return firstWeek.getBoundingClientRect().height + (Number.isNaN(gap) ? 0 : gap);
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

function buildWeekEventSegments(events: PreviewEvent[], weekStartIso: string): CalendarEventSegment[] {
  const weekEndExclusive = addDays(weekStartIso, 7);
  const occupied: Array<Array<{ startColumn: number; endColumn: number }>> = Array.from(
    { length: MAX_EVENT_LANES },
    () => [],
  );

  return events.flatMap((event) => {
    const eventStart = event.startDate;
    const eventEndExclusive = event.endDate ?? addDays(event.startDate, 1);

    if (eventEndExclusive <= weekStartIso || eventStart >= weekEndExclusive) {
      return [];
    }

    const startColumn = daysBetween(weekStartIso, maxIsoDate(eventStart, weekStartIso));
    const endColumn = daysBetween(weekStartIso, minIsoDate(eventEndExclusive, weekEndExclusive)) - 1;
    const lane = reserveWeekSegmentLane(occupied, startColumn, endColumn);

    if (lane === null) {
      return [];
    }

    return [{
      event,
      weekIndex: 0,
      lane,
      startColumn,
      endColumn,
      startsAtEvent: addDays(weekStartIso, startColumn) === eventStart,
      endsAtEvent: addDays(weekStartIso, endColumn + 1) === eventEndExclusive,
    }];
  });
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

function reserveWeekSegmentLane(
  occupied: Array<Array<{ startColumn: number; endColumn: number }>>,
  startColumn: number,
  endColumn: number,
): number | null {
  for (let lane = 0; lane < MAX_EVENT_LANES; lane += 1) {
    const hasCollision = occupied[lane].some((range) =>
      startColumn <= range.endColumn && range.startColumn <= endColumn,
    );

    if (!hasCollision) {
      occupied[lane].push({ startColumn, endColumn });
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
