'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

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

const SAMPLE_STEAM_ID = '76561198115468824';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const cells = useMemo(() => buildMonthCells(visibleMonth, events), [visibleMonth, events]);
  const visibleEvents = events.filter((event) => event.endDate
    ? event.startDate.slice(0, 7) <= visibleMonth && event.endDate.slice(0, 7) >= visibleMonth
    : event.startDate.startsWith(visibleMonth));

  return (
    <section className="calendarApp" aria-label="Simulated calendar app preview">
      <div className="calendarChrome">
        <div>
          <p className="calendarTitle">Subscribed Calendar Preview</p>
          <h2>{formatMonth(visibleMonth)}</h2>
        </div>
        <div className="monthControls" aria-label="Month navigation">
          <button type="button" onClick={onPreviousMonth} aria-label="Previous month">
            <ChevronIcon direction="left" />
          </button>
          <button type="button" onClick={onNextMonth} aria-label="Next month">
            <ChevronIcon direction="right" />
          </button>
        </div>
      </div>

      <div className="calendarGrid" role="grid" aria-label={`${formatMonth(visibleMonth)} calendar preview`}>
        {WEEKDAYS.map((weekday) => (
          <div className="weekday" key={weekday} role="columnheader">{weekday}</div>
        ))}
        {cells.map((cell) => (
          <div
            className={cell.isCurrentMonth ? 'dayCell' : 'dayCell outsideMonth'}
            key={cell.date}
            role="gridcell"
            aria-label={`${formatDate(cell.date)}${cell.events.length ? `, ${cell.events.length} events` : ''}`}
          >
            <span className="dayNumber">{cell.day}</span>
            <div className="dayEvents">
              {cell.events.slice(0, 3).map((event) => (
                <span
                  aria-label={event.title}
                  className={`calendarPill ${event.type}`}
                  key={`${cell.date}-${event.id}`}
                  title={event.title}
                >
                  {compactEventTitle(event.title)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="agenda" aria-label="Visible month events">
        {visibleEvents.length > 0 ? (
          visibleEvents.map((item) => <EventRow key={item.id} event={item} />)
        ) : (
          <div className="empty">No subscribed events in this month.</div>
        )}
      </div>
    </section>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" className="chevronIcon" viewBox="0 0 20 20">
      <path d={direction === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'} />
    </svg>
  );
}

function EventRow({ event }: { event: PreviewEvent }) {
  return (
    <article className="eventRow">
      <time dateTime={event.startDate}>
        {formatDate(event.startDate)}
        {event.endDate ? ` - ${formatDate(event.endDate)}` : ''}
      </time>
      <div>
        <h3>{event.title}</h3>
        <p>{event.description.split('\n')[0]}</p>
      </div>
    </article>
  );
}

function buildMonthCells(monthKey: string, events: PreviewEvent[]) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - firstOfMonth.getUTCDay());

  return Array.from({ length: 42 }, (_, index) => {
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
}

function eventOccursOn(event: PreviewEvent, isoDate: string): boolean {
  if (!event.endDate) {
    return event.startDate === isoDate;
  }

  return event.startDate <= isoDate && isoDate < event.endDate;
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

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function compactEventTitle(title: string): string {
  return title
    .replace(/^🎮\s*/, '')
    .replace(/^🧪\s*Steam\s*/, '')
    .replace(/^🛒\s*Steam\s*/, '');
}
