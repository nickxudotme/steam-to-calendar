'use client';

import { FormEvent, useMemo, useState } from 'react';

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

const SAMPLE_STEAM_ID = '76561199022537892';

export default function Home() {
  const [steamId64, setSteamId64] = useState(SAMPLE_STEAM_ID);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

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
            Prototype supports SteamID64 only. Example wishlist path:
            {' '}
            <code>/wishlist/profiles/{steamId64 || SAMPLE_STEAM_ID}/wishlist/</code>
          </p>
        </form>

        {error ? <div className="notice error">{error}</div> : null}

        {preview ? (
          <div className="results">
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

            <div className="subscribe">
              <div>
                <h2>Calendar feed</h2>
                <p>
                  {isLocalFeed
                    ? 'Local mode: one-click uses an extensionless webcal URL. If Calendar rejects localhost, copy the HTTP URL below.'
                    : 'Use the webcal button, or copy the URL into Apple Calendar: File -> New Calendar Subscription.'}
                </p>
              </div>
              <div className="actions">
                <a href={webcalUrl}>Import Calendar</a>
                <button className="secondary" type="button" onClick={copyFeedUrl}>Copy URL</button>
                <a className="secondary" href={preview.feedPath}>Open .ics</a>
              </div>
            </div>
            <input className="feedUrl" readOnly value={feedUrl} aria-label="Calendar feed URL" />
            {copyStatus !== 'idle' ? (
              <p className="copyStatus">
                {copyStatus === 'copied' ? 'Copied. Paste it into Apple Calendar subscription.' : 'Copy failed. Select the URL field manually.'}
              </p>
            ) : null}
            {isLocalFeed ? (
              <p className="localNote">
                Apple Calendar often rejects local <code>webcal://</code> links on non-standard ports. For local testing, paste the HTTP URL above directly.
              </p>
            ) : null}

            <div className="timeline" aria-label="Calendar preview">
              {preview.events.length > 0 ? (
                preview.events.map((item) => <EventRow key={item.id} event={item} />)
              ) : (
                <div className="empty">No future wishlist releases with exact dates yet. Steam major events will still appear.</div>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
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

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
