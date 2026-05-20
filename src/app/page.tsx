'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

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

const SAMPLE_STEAM_ID = '76561198115468824';
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MAX_EVENT_LANES = 3;

export default function Home() {
  const [steamId64, setSteamId64] = useState(SAMPLE_STEAM_ID);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [visibleMonth, setVisibleMonth] = useState(() => monthKeyFromIsoDate(new Date().toISOString().slice(0, 10)));

  const feedUrl = useMemo(() => {
    if (!preview) {
      return '';
    }

    if (typeof window === 'undefined') {
      return preview.feedPath;
    }

    return `${window.location.origin}${preview.feedPath}`;
  }, [preview]);

  const webcalUrl = useMemo(() => {
    if (!preview) {
      return '';
    }

    const calendarUrl = typeof window === 'undefined'
      ? preview.calendarPath
      : `${window.location.origin}${preview.calendarPath}`;

    return calendarUrl.replace(/^https?:\/\//, 'webcal://');
  }, [preview]);

  const isLocalFeed = useMemo(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  }, [preview]);

  const sortedEvents = useMemo(() => {
    return [...(preview?.events ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [preview]);

  useEffect(() => {
    if (sortedEvents.length > 0) {
      setVisibleMonth(monthKeyFromIsoDate(sortedEvents[0].startDate));
    }
  }, [sortedEvents]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setPreview(null);
    setCopyStatus('idle');

    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ steamId64 }),
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

  async function copyFeedUrl() {
    if (!feedUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">Wishlist in Calendar</p>
        <h1>Put your Steam wishlist into the calendar you actually live in.</h1>
        <p className="lede">
          Paste a SteamID64, preview future release dates and major Steam moments, then subscribe from Apple Calendar.
        </p>
      </section>

      <section className="workspace" aria-label="Steam wishlist calendar generator">
        <form className="lookup" onSubmit={handleSubmit}>
          <label htmlFor="steam-id">SteamID64</label>
          <div className="lookupRow">
            <input
              id="steam-id"
              inputMode="numeric"
              placeholder={SAMPLE_STEAM_ID}
              value={steamId64}
              onChange={(event) => setSteamId64(event.target.value)}
            />
            <button disabled={isLoading} type="submit">
              {isLoading ? 'Previewing...' : 'Preview'}
            </button>
          </div>
          <p className="hint">
            Prototype supports SteamID64 only. Public wishlist appIDs come from Steam's wishlist service.
          </p>
        </form>

        {error ? <div className="notice error">{error}</div> : null}

        {preview ? (
          <div className="results">
            <div className="resultShell">
              <aside className="feedPanel" aria-label="Subscription controls">
                <div className="panelHeader">
                  <h2>Subscription</h2>
                  <p>
                    {isLocalFeed
                      ? 'Local mode: one-click uses an extensionless webcal URL. If Calendar rejects localhost, copy the HTTP URL.'
                      : 'Use the webcal button, or copy the URL into Apple Calendar.'}
                  </p>
                </div>

                <div className="summary">
                  <div>
                    <span>{preview.stats.wishlistGames}</span>
                    wishlist apps
                  </div>
                  <div>
                    <span>{preview.stats.wishlistReleaseEvents}</span>
                    future releases
                  </div>
                  <div>
                    <span>{preview.stats.steamMajorEvents}</span>
                    Steam events
                  </div>
                </div>

                <div className="actions">
                  <a href={webcalUrl}>Import Calendar</a>
                  <button className="secondary" type="button" onClick={copyFeedUrl}>Copy URL</button>
                  <a className="secondary" href={preview.feedPath}>Open .ics</a>
                </div>

                <label className="feedLabel" htmlFor="feed-url">Feed URL</label>
                <input id="feed-url" className="feedUrl" readOnly value={feedUrl} aria-label="Calendar feed URL" />
                {copyStatus !== 'idle' ? (
                  <p className="copyStatus">
                    {copyStatus === 'copied' ? 'Copied. Paste it into Apple Calendar subscription.' : 'Copy failed. Select the URL field manually.'}
                  </p>
                ) : null}
                {isLocalFeed ? (
                  <p className="localNote">
                    Apple Calendar may reject local <code>webcal://</code> links on non-standard ports. The HTTP feed above is the reliable local fallback.
                  </p>
                ) : null}
              </aside>

              <CalendarPreview
                events={sortedEvents}
                visibleMonth={visibleMonth}
                onPreviousMonth={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}
                onNextMonth={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
              />
            </div>
          </div>
        ) : null}
      </section>
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) ?? null : null;

  useEffect(() => {
    setSelectedEventId(null);
  }, [visibleMonth]);

  return (
    <section className="calendarApp" aria-label="Simulated calendar app preview">
      <div className="iphoneCalendarChrome">
        <div className="iphoneStatusBar" aria-hidden="true">
          <span>1:03</span>
          <span className="iphoneStatusIcons">▮▮▮  Wi-Fi  77</span>
        </div>
        <div className="iphoneTopBar">
          <button className="iphoneYearButton" type="button" aria-label="Back to year view">
            <ChevronIcon direction="left" />
            <span>{visibleMonth.slice(0, 4)}年</span>
          </button>
          <div className="iphoneTopActions">
            <button className="toolbarIcon" type="button" aria-label="Calendar list">
              <CalendarListIcon />
            </button>
            <button className="toolbarIcon" type="button" aria-label="Search">
              <SearchIcon />
            </button>
            <button className="toolbarIcon" type="button" aria-label="Add event">
              <PlusIcon />
            </button>
          </div>
        </div>
        <div className="iphoneMonthTitle">{formatChineseMonthName(visibleMonth)}</div>
      </div>

      <div className="calendarChrome">
        <div className="windowControls" aria-hidden="true">
          <span className="windowControl close" />
          <span className="windowControl minimize" />
          <span className="windowControl zoom" />
        </div>
        <div className="calendarToolbarLeft">
          <button className="toolbarIcon isSelected" type="button" aria-label="Calendars">
            <CalendarListIcon />
          </button>
          <button className="toolbarIcon" type="button" aria-label="Inbox">
            <InboxIcon />
          </button>
          <button className="toolbarIcon addButton" type="button" aria-label="Add event">
            <PlusIcon />
          </button>
        </div>
        <div className="viewSwitcher" aria-label="Calendar view">
          <button type="button">日</button>
          <button type="button">周</button>
          <button className="isSelected" type="button">月</button>
          <button type="button">年</button>
        </div>
        <button className="toolbarIcon searchButton" type="button" aria-label="Search">
          <SearchIcon />
        </button>
      </div>

      <div className="calendarMonthBar">
        <h2>{formatCalendarMonthTitle(visibleMonth)}</h2>
        <div className="monthControls" aria-label="Month navigation">
          <button type="button" onClick={onPreviousMonth} aria-label="Previous month">
            <ChevronIcon direction="left" />
          </button>
          <button className="todayButton" type="button" aria-label="Today">
            今天
          </button>
          <button type="button" onClick={onNextMonth} aria-label="Next month">
            <ChevronIcon direction="right" />
          </button>
        </div>
      </div>

      <div
        className="calendarGrid"
        role="grid"
        aria-label={`${formatMonth(visibleMonth)} calendar preview`}
        onClick={() => setSelectedEventId(null)}
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
            <span className="dayNumber">{cell.day}</span>
          </div>
        ))}
        {previewData.segments.map((segment) => (
          <button
            aria-label={segment.event.title}
            className={[
              'calendarSegment',
              segment.event.type,
              selectedEventId === segment.event.id ? 'isSelected' : '',
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
            onClick={(event) => {
              event.stopPropagation();
              setSelectedEventId(segment.event.id);
            }}
          >
            {compactEventTitle(segment.event.title)}
          </button>
        ))}
      </div>

      {selectedEvent ? (
        <EventPopover event={selectedEvent} onClose={() => setSelectedEventId(null)} />
      ) : null}

      <div className="iphoneBottomBar" aria-hidden="true">
        <span>今天</span>
        <span className="iphoneBottomActions">
          <CalendarListIcon />
          <InboxIcon />
        </span>
      </div>
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

function InboxIcon() {
  return (
    <svg aria-hidden="true" className="toolbarSvg" viewBox="0 0 20 20">
      <path d="M4.2 8.5 6.1 5h7.8l1.9 3.5v5.1a1.7 1.7 0 0 1-1.7 1.7H5.9a1.7 1.7 0 0 1-1.7-1.7Z" />
      <path d="M4.5 9h3.2l.8 1.8h3L12.3 9h3.2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="toolbarSvg" viewBox="0 0 20 20">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="toolbarSvg" viewBox="0 0 20 20">
      <circle cx="9" cy="9" r="5" />
      <path d="m12.8 12.8 3.2 3.2" />
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

function EventPopover({ event, onClose }: { event: PreviewEvent; onClose: () => void }) {
  const sourceHost = event.sourceUrl ? new URL(event.sourceUrl).host : null;

  return (
    <aside className="calendarPopover" aria-label={`${event.title} details`} data-testid="event-popover">
      <div className="popoverAnchor" aria-hidden="true" />
      <div className="popoverHeader">
        <h3>{event.title}</h3>
        <button type="button" aria-label="Close event details" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="popoverCalendar">
        <span className={`calendarDot ${event.type}`} />
        <span>Wishlist in Calendar</span>
        <ChevronIcon direction="right" />
      </div>
      {event.sourceUrl ? (
        <div className="popoverLink">
          <LinkIcon />
          <span>{sourceHost}</span>
          <a href={event.sourceUrl} target="_blank" rel="noreferrer">打开</a>
        </div>
      ) : null}
      <time className="popoverDate" dateTime={event.startDate}>
        {formatPopoverDateRange(event)}
      </time>
      <p>{event.description.split('\n')[0]}</p>
      {event.sourceUrl ? <a className="popoverUrl" href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceUrl}</a> : null}
      <button className="unsubscribeButton" type="button">取消订阅</button>
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
  const [year, month] = value.split('-').map(Number);
  return `${year}年${month}月`;
}

function formatChineseMonthName(value: string): string {
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const month = Number(value.slice(5, 7));
  return monthNames[month - 1] ?? formatCalendarMonthTitle(value);
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
    return formatChineseDate(event.startDate);
  }

  return `${formatChineseDate(event.startDate)} – ${formatChineseDate(addDays(event.endDate, -1))}`;
}

function formatChineseDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function compactEventTitle(title: string): string {
  return title
    .replace(/^🎮\s*/, '')
    .replace(/^🧪\s*Steam\s*/, '')
    .replace(/^🛒\s*Steam\s*/, '');
}
