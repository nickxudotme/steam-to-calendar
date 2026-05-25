'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  calendarConfigToSearchParams,
  DEFAULT_CALENDAR_CONFIG,
  STEAM_EVENT_CATEGORIES,
  type CalendarConfig,
  type SteamEventCategory,
} from '@/lib/calendar-config';
import { STEAM_EVENTS_CALENDAR_ID } from '@/lib/calendar-constants';
import { countryFlag, STEAM_STORE_REGIONS, steamStoreRegionName } from '@/lib/steam/regions';

type PreviewEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  sourceUrl?: string;
  type: 'wishlist_release' | 'steam_major_event' | 'steam_deal' | 'steam_preorder';
  appId?: string;
  imageUrl?: string;
  discount?: string;
  originalPrice?: string;
  finalPrice?: string;
  releaseTime?: number;
  discountEnd?: number;
  eventCategory?: SteamEventCategory;
};

type PreviewResponse = {
  steamId64: string;
  feedPath: string;
  calendarPath: string;
  wishlistUrl: string;
  locale?: {
    cc: string;
    lang: string;
    uiLang: string;
  };
  stats: {
    wishlistGames: number;
    appDetails: number;
    skippedAppIds: number;
    wishlistReleaseEvents: number;
    steamMajorEvents: number;
  };
  events: PreviewEvent[];
};

type GameSearchResult = {
  appId: string;
  name: string;
  imageUrl?: string;
  price?: {
    discountPercent: number;
    finalFormatted?: string;
    initialFormatted?: string;
  };
  storeUrl: string;
};

type SelectedGame = {
  appId: string;
  name: string;
  imageUrl?: string;
  storeUrl: string;
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_EVENT_LANES = 12;
const INITIAL_WEEK_BUFFER = 8;
const INITIAL_WEEK_SPAN = 34;
const WEEK_EXTENSION_SIZE = 16;
const WEEK_EXTENSION_THRESHOLD = 4;
const STEAM_EVENT_CATEGORY_LABELS: Record<SteamEventCategory, { description: string; title: string }> = {
  seasonal: {
    title: 'Seasonal sales',
    description: 'Summer, Autumn, Winter, and Spring sale windows.',
  },
  next_fest: {
    title: 'Next Fest',
    description: 'Official demo festivals for upcoming games.',
  },
  fest: {
    title: 'Theme fests',
    description: 'Genre and theme events such as bullet heaven or deckbuilders.',
  },
  store_sale: {
    title: 'Store sale pages',
    description: 'Publisher, franchise, and partner sale pages.',
  },
};
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
    steamMajorEvents: 0,
  },
  events: [],
};

export default function Home() {
  const [steamId64, setSteamId64] = useState('');
  const [preview, setPreview] = useState<PreviewResponse>(PUBLIC_PREVIEW);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showDeals, setShowDeals] = useState(true);
  const [showSteamEvents, setShowSteamEvents] = useState(true);
  const [showMyGames, setShowMyGames] = useState(true);
  const [steamEventCategories, setSteamEventCategories] = useState<SteamEventCategory[]>(DEFAULT_CALENDAR_CONFIG.steamEventCategories);
  const [dealCount, setDealCount] = useState(DEFAULT_CALENDAR_CONFIG.dealCount);
  const [eventPastDays, setEventPastDays] = useState(DEFAULT_CALENDAR_CONFIG.eventPastDays);
  const [eventFutureDays, setEventFutureDays] = useState(DEFAULT_CALENDAR_CONFIG.eventFutureDays);
  const [gameSearch, setGameSearch] = useState('');
  const [gameSearchResults, setGameSearchResults] = useState<GameSearchResult[]>([]);
  const [gameSearchError, setGameSearchError] = useState<string | null>(null);
  const [isSearchingGames, setIsSearchingGames] = useState(false);
  const [selectedGames, setSelectedGames] = useState<SelectedGame[]>([]);
  const [recentlyAddedAppId, setRecentlyAddedAppId] = useState<string | null>(null);
  const [storeRegion, setStoreRegion] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(() => new Set());
  const [todayIso, setTodayIso] = useState(() => localIsoDate());
  const [initialMonth, setInitialMonth] = useState(() => monthKeyFromIsoDate(localIsoDate()));
  const [origin, setOrigin] = useState('');
  const userSelectedRegionRef = useRef(false);
  const demoEvents = useMemo(() => buildDemoEvents(todayIso), [todayIso]);
  const effectiveStoreRegion = storeRegion ?? preview.locale?.cc ?? 'US';
  const effectiveStoreRegionLabel = `${countryFlag(effectiveStoreRegion)} ${steamStoreRegionName(effectiveStoreRegion)} Store`;
  const hasConnectedWishlist = preview.steamId64 !== STEAM_EVENTS_CALENDAR_ID;
  const watchedAppIds = useMemo(() => (
    showMyGames && !hasConnectedWishlist ? selectedGames.map((game) => game.appId) : []
  ), [hasConnectedWishlist, selectedGames, showMyGames]);
  const calendarConfig = useMemo<CalendarConfig>(() => ({
    includeDeals: showDeals,
    includeSteamEvents: showSteamEvents,
    includeWishlist: showMyGames,
    watchedAppIds,
    steamEventCategories,
    dealCount,
    eventPastDays,
    eventFutureDays,
  }), [dealCount, eventFutureDays, eventPastDays, showDeals, showMyGames, showSteamEvents, steamEventCategories, watchedAppIds]);

  const publicPreviewQuery = useMemo(() => {
    const params = calendarConfigToSearchParams(calendarConfig);

    if (storeRegion) {
      params.set('cc', storeRegion);
    }

    return params.toString();
  }, [calendarConfig, storeRegion]);

  const calendarQuery = useMemo(() => {
    const params = calendarConfigToSearchParams(calendarConfig);

    params.set('cc', effectiveStoreRegion);

    return params.toString();
  }, [calendarConfig, effectiveStoreRegion]);

  const webcalUrl = useMemo(() => {
    const calendarUrl = origin
      ? `${origin}${preview.calendarPath}?${calendarQuery}`
      : `${preview.calendarPath}?${calendarQuery}`;

    return calendarUrl.replace(/^https?:\/\//, 'webcal://');
  }, [calendarQuery, origin, preview]);

  const calendarEvents = preview.events.length ? preview.events : demoEvents;

  const sortedEvents = useMemo(() => {
    return [...calendarEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [calendarEvents]);
  const trendingGames = useMemo<SelectedGame[]>(() => (
    sortedEvents
      .filter((event) => (event.type === 'steam_deal' || event.type === 'steam_preorder') && event.appId)
      .slice(0, 3)
      .map((event) => ({
        appId: event.appId as string,
        name: detailTitle(event),
        ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
        storeUrl: event.sourceUrl ?? `https://store.steampowered.com/app/${event.appId}/`,
      }))
  ), [sortedEvents]);

  const visibleEvents = useMemo(() => {
    let seenDeals = 0;

    return sortedEvents.filter((event) => {
      if (hiddenEventIds.has(event.id)) {
        return false;
      }

      if (event.type === 'steam_deal' || event.type === 'steam_preorder') {
        seenDeals += 1;
        return showDeals && seenDeals <= dealCount;
      }

      if (event.type === 'steam_major_event') {
        return showSteamEvents && (!event.eventCategory || steamEventCategories.includes(event.eventCategory));
      }

      return showMyGames;
    });
  }, [dealCount, hiddenEventIds, showDeals, showMyGames, showSteamEvents, sortedEvents, steamEventCategories]);

  const preferredEventId = visibleEvents.find((event) => event.type === 'steam_deal')?.id ?? visibleEvents[0]?.id ?? null;
  const selectedEvent = useMemo(() => (
    visibleEvents.find((event) => event.id === selectedEventId) ??
    visibleEvents.find((event) => event.id === preferredEventId) ??
    null
  ), [preferredEventId, selectedEventId, visibleEvents]);

  useEffect(() => {
    setOrigin(window.location.origin);
    const browserTodayIso = localIsoDate();

    setTodayIso(browserTodayIso);
    setInitialMonth(monthKeyFromIsoDate(browserTodayIso));
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicPreview() {
      setIsPreviewLoading(true);

      try {
        const response = await fetch(`/api/public-preview?${publicPreviewQuery}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message ?? 'Could not load Steam events.');
        }

        if (isMounted) {
          setPreview((currentPreview) => (
            currentPreview.steamId64 === STEAM_EVENTS_CALENDAR_ID ? payload : currentPreview
          ));

          if (!userSelectedRegionRef.current && !storeRegion && payload.locale?.cc) {
            setStoreRegion(payload.locale.cc);
          }
        }
      } catch (caught) {
        console.error(caught);
      } finally {
        if (isMounted) {
          setIsPreviewLoading(false);
        }
      }
    }

    void loadPublicPreview();

    return () => {
      isMounted = false;
    };
  }, [publicPreviewQuery, storeRegion]);

  useEffect(() => {
    setInitialMonth(monthKeyFromIsoDate(todayIso));
  }, [todayIso, visibleEvents]);

  useEffect(() => {
    if (!selectedEventId || !visibleEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(preferredEventId);
    }
  }, [preferredEventId, selectedEventId, visibleEvents]);

  useEffect(() => {
    if (!recentlyAddedAppId) {
      return;
    }

    const timeoutId = window.setTimeout(() => setRecentlyAddedAppId(null), 5200);

    return () => window.clearTimeout(timeoutId);
  }, [recentlyAddedAppId]);

  async function handleGameSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = gameSearch.trim();

    if (!query || hasConnectedWishlist) {
      return;
    }

    setIsSearchingGames(true);
    setGameSearchError(null);

    try {
      const params = new URLSearchParams({
        cc: effectiveStoreRegion,
        query,
      });
      const response = await fetch(`/api/search-games?${params.toString()}`);
      const payload = await response.json() as { message?: string; results?: GameSearchResult[] };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Could not search Steam games.');
      }

      setGameSearchResults(payload.results ?? []);
    } catch (caught) {
      setGameSearchError(caught instanceof Error ? caught.message : 'Could not search Steam games.');
    } finally {
      setIsSearchingGames(false);
    }
  }

  function handleAddSelectedGame(game: GameSearchResult) {
    handleAddManualGame({
      appId: game.appId,
      name: game.name,
      ...(game.imageUrl ? { imageUrl: game.imageUrl } : {}),
      storeUrl: game.storeUrl,
    });
  }

  function handleAddManualGame(game: SelectedGame) {
    if (hasConnectedWishlist) {
      return;
    }

    setShowMyGames(true);
    setRecentlyAddedAppId(game.appId);
    setSelectedGames((games) => {
      if (games.some((selectedGame) => selectedGame.appId === game.appId)) {
        return games;
      }

      return [
        ...games,
        game,
      ].slice(-10);
    });
  }

  function handleRemoveSelectedGame(appId: string) {
    setSelectedGames((games) => games.filter((game) => game.appId !== appId));
  }

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
        body: JSON.stringify({
          steamId64: trimmedSteamId64,
          cc: effectiveStoreRegion,
          deals: calendarConfig.includeDeals,
          events: calendarConfig.includeSteamEvents,
          eventTypes: calendarConfig.steamEventCategories.join(','),
          wishlist: true,
          apps: '',
          count: calendarConfig.dealCount,
          pastDays: calendarConfig.eventPastDays,
          futureDays: calendarConfig.eventFutureDays,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? 'Could not preview this Steam wishlist.');
      }

      setPreview(payload);
      setShowMyGames(true);
      setSelectedGames([]);
      setGameSearchResults([]);
      setGameSearchError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not preview this Steam wishlist.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleStoreRegionChange(value: string) {
    userSelectedRegionRef.current = true;
    setStoreRegion(value);
  }

  function handleSteamEventCategoryChange(category: SteamEventCategory, checked: boolean) {
    setSteamEventCategories((categories) => (
      checked
        ? [...categories, category].sort(compareSteamEventCategories)
        : categories.filter((currentCategory) => currentCategory !== category)
    ));
  }

  return (
    <main className="appRoot">
      <div className="shell">
        <header className="siteHeader">
          <a className="brandMark" href="/" aria-label="Wishlist in Calendar home">
            <span className="brandIcon">
              <img src="/assets/brand/wishlist-in-calendar-logo.png" alt="" />
            </span>
            <span>Steam Sale Calendar</span>
          </a>
          <div className="headerControls">
            <label className="regionSelect">
              <span>{effectiveStoreRegionLabel}</span>
              <select
                aria-label="Steam store region"
                value={effectiveStoreRegion}
                onChange={(event) => handleStoreRegionChange(event.target.value)}
              >
                {STEAM_STORE_REGIONS.map((region) => (
                  <option key={region.code} value={region.code}>
                    {countryFlag(region.code)} {region.name}
                  </option>
                ))}
              </select>
            </label>
            <a className="calendarCta" href={webcalUrl}>
              <CalendarListIcon />
              Add to your Calendar
            </a>
          </div>
        </header>

        <h1 className="srOnly">Build your Steam Sale Calendar</h1>

        <section className="calendarWorkbench" aria-label="Steam Sale Calendar workbench">
          <aside className="configPanel" aria-label="Calendar configuration">
            <div className="panelHeader">
              <h2>Calendar sources</h2>
            </div>

            <SourceToggle
              checked={showDeals}
              title="Hot Deals & Preorders"
              description="Top sellers that are currently discounted or available to preorder."
              onChange={setShowDeals}
            />

            <div className="controlRow">
              <span>Items</span>
              <div className="stepper" aria-label="Hot deals count">
                <button type="button" onClick={() => setDealCount((count) => Math.max(3, count - 1))}>-</button>
                <output>{dealCount}</output>
                <button type="button" onClick={() => setDealCount((count) => Math.min(10, count + 1))}>+</button>
              </div>
            </div>

            <SourceToggle
              checked={showSteamEvents}
              title="Steam Sales & Fests"
              description="Official Steam sale events, Next Fest, themed fests, and public sale pages."
              onChange={setShowSteamEvents}
            />

            <div className="eventTypeGrid" aria-label="Steam event types">
              {STEAM_EVENT_CATEGORIES.map((category) => (
                <label className="eventTypeOption" key={category}>
                  <input
                    checked={steamEventCategories.includes(category)}
                    disabled={!showSteamEvents}
                    onChange={(event) => handleSteamEventCategoryChange(category, event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{STEAM_EVENT_CATEGORY_LABELS[category].title}</strong>
                    <small>{STEAM_EVENT_CATEGORY_LABELS[category].description}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className="rangeGrid" aria-label="Steam event range">
              <label>
                <span>Past days</span>
                <input
                  type="number"
                  min="0"
                  max="730"
                  value={eventPastDays}
                  onChange={(event) => setEventPastDays(clampInteger(event.target.value, 0, 730, DEFAULT_CALENDAR_CONFIG.eventPastDays))}
                />
              </label>
              <label>
                <span>Next days</span>
                <input
                  type="number"
                  min="1"
                  max="1095"
                  value={eventFutureDays}
                  onChange={(event) => setEventFutureDays(clampInteger(event.target.value, 1, 1095, DEFAULT_CALENDAR_CONFIG.eventFutureDays))}
                />
              </label>
            </div>

            <div className="panelDivider" />

            <div className="myGamesBlock">
              <div className="sourceTitleRow">
                <div>
                  <h3>My Games</h3>
                  <p>Watch specific games, then connect a public Steam wishlist when you want it to replace manual picks.</p>
                </div>
                <label className="switch">
                  <input
                    checked={showMyGames}
                    onChange={(event) => setShowMyGames(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
              </div>

              <form className="gameSearchForm" onSubmit={handleGameSearchSubmit}>
                <label className="searchBox" htmlFor="game-search">
                  <span className="srOnly">Search Steam games</span>
                  <SearchIcon />
                  <input
                    disabled={!showMyGames || hasConnectedWishlist}
                    id="game-search"
                    placeholder="Search Steam games"
                    type="search"
                    value={gameSearch}
                    onChange={(event) => setGameSearch(event.target.value)}
                  />
                </label>
                <button disabled={!showMyGames || hasConnectedWishlist || isSearchingGames || !gameSearch.trim()} type="submit">
                  {isSearchingGames ? 'Searching...' : 'Search'}
                </button>
              </form>

              {hasConnectedWishlist ? (
                <div className="notice wishlistNotice">
                  Wishlist connected. Manual game picks are ignored while this calendar uses your Steam wishlist.
                </div>
              ) : null}

              {isPreviewLoading && !hasConnectedWishlist ? (
                <div className="notice loadingNotice" role="status">
                  Syncing your calendar preview with Steam data...
                </div>
              ) : null}

              {trendingGames.length ? (
                <div className="trendingGames" aria-label="Trending games">
                  <span className="miniSectionTitle">Trending now</span>
                  {trendingGames.map((game) => {
                    const isSelected = selectedGames.some((selectedGame) => selectedGame.appId === game.appId);

                    return (
                      <div className="selectedGameRow" key={game.appId}>
                        {game.imageUrl ? <img src={game.imageUrl} alt="" /> : <span className="gameThumbFallback" />}
                        <span>{game.name}</span>
                        <button
                          disabled={hasConnectedWishlist || isSelected}
                          type="button"
                          onClick={() => handleAddManualGame(game)}
                        >
                          {isSelected ? 'Added' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {selectedGames.length ? (
                <div className="selectedGames" aria-label="Games added to calendar">
                  <span className="miniSectionTitle">Added to calendar</span>
                  {selectedGames.map((game) => (
                    <div
                      className={game.appId === recentlyAddedAppId ? 'selectedGameRow isNewlyAdded' : 'selectedGameRow'}
                      key={game.appId}
                    >
                      {game.imageUrl ? <img src={game.imageUrl} alt="" /> : <span className="gameThumbFallback" />}
                      <span>{game.name}</span>
                      <button type="button" onClick={() => handleRemoveSelectedGame(game.appId)}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : null}

              {gameSearchError ? <div className="notice error">{gameSearchError}</div> : null}

              {isSearchingGames ? (
                <div className="gameSearchResults" aria-label="Steam game search loading results" role="status">
                  {[0, 1, 2].map((index) => (
                    <div className="gameSearchResult skeletonResult" key={index}>
                      <span className="skeletonThumb" />
                      <div>
                        <span className="skeletonLine wide" />
                        <span className="skeletonLine narrow" />
                      </div>
                      <span className="skeletonButton" />
                    </div>
                  ))}
                </div>
              ) : null}

              {!isSearchingGames && gameSearchResults.length ? (
                <div className="gameSearchResults" aria-label="Steam game search results">
                  {gameSearchResults.map((game) => {
                    const isSelected = selectedGames.some((selectedGame) => selectedGame.appId === game.appId);

                    return (
                      <div className="gameSearchResult" key={game.appId}>
                        {game.imageUrl ? <img src={game.imageUrl} alt="" /> : <span className="gameThumbFallback" />}
                        <div>
                          <strong>{game.name}</strong>
                          <small>{gameSearchMeta(game)}</small>
                        </div>
                        <button
                          disabled={hasConnectedWishlist || isSelected}
                          type="button"
                          onClick={() => handleAddSelectedGame(game)}
                        >
                          {isSelected ? 'Added' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <form
                className="wishlistImport"
                id="steam-connect"
                onSubmit={handleSubmit}
                aria-label="Import Steam wishlist releases to the calendar"
              >
                <label className="srOnly" htmlFor="steam-id">Paste your Steam Profile URL</label>
                <div className="steamInputWrap">
                  <LinkIcon />
                  <input
                    id="steam-id"
                    inputMode="text"
                    placeholder="Paste Steam Profile URL"
                    value={steamId64}
                    onChange={(event) => setSteamId64(event.target.value)}
                  />
                </div>
                <button disabled={isLoading} type="submit">
                  {isLoading ? 'Importing...' : 'Import Steam Wishlist'}
                </button>
              </form>
              {isLoading ? (
                <div className="notice loadingNotice" role="status">
                  Reading your public Steam wishlist and preparing calendar events. This can take a moment for larger wishlists.
                </div>
              ) : null}
              <p className="wishlistHint">Connecting a public wishlist replaces manual picks and keeps future releases synced in this calendar.</p>

              {error ? <div className="notice error">{error}</div> : null}
            </div>
          </aside>

          <div className="calendarExperience" id="calendar-preview">
            <CalendarPreview
              events={visibleEvents}
              initialMonth={initialMonth}
              isLoading={isPreviewLoading}
              onSelectEvent={setSelectedEventId}
              recentlyAddedAppId={recentlyAddedAppId}
              selectedEventId={selectedEvent?.id ?? null}
              todayIso={todayIso}
            />
          </div>

          <EventDetails
            event={selectedEvent}
            onRemove={(eventId) => setHiddenEventIds((ids) => new Set(ids).add(eventId))}
            webcalUrl={webcalUrl}
          />
        </section>

        <footer className="siteFooter">
          <span>Steam Sale Calendar is not affiliated with Valve Corp.</span>
          <nav aria-label="Footer links">
            <a href="#calendar-preview">How it works</a>
            <a href="#steam-connect">Privacy</a>
            <a href="#calendar-preview">Changelog</a>
            <a href="https://github.com" rel="noreferrer" target="_blank">GitHub</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}

function CalendarPreview({
  events,
  initialMonth,
  isLoading,
  onSelectEvent,
  recentlyAddedAppId,
  selectedEventId,
  todayIso,
}: {
  events: PreviewEvent[];
  initialMonth: string;
  isLoading: boolean;
  onSelectEvent: (eventId: string) => void;
  recentlyAddedAppId: string | null;
  selectedEventId: string | null;
  todayIso: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const weekRefs = useRef(new Map<string, HTMLElement>());
  const initialWeekStart = useMemo(() => calendarGridStartForMonth(initialMonth), [initialMonth]);
  const [weekRange, setWeekRange] = useState(() => buildInitialWeekRange(initialWeekStart));
  const weeks = useMemo(() => buildContinuousCalendarWeeks(events, weekRange.startIso, weekRange.endIso), [events, weekRange]);
  const shouldAlignInitialWeek = useRef(true);
  const hasUserScrollIntent = useRef(false);
  const pendingMonthScroll = useRef<string | null>(null);
  const pendingPrepend = useRef<null | {
    previousFirstWeek: string;
    previousScrollTop: number;
  }>(null);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);

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

  function markCalendarScrollIntent() {
    hasUserScrollIntent.current = true;
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

  return (
    <section className="calendarApp" aria-label="Calendar preview">
      <div className="calendarHeader">
        <div className="calendarNav">
          <button type="button" aria-label="Previous month" onClick={() => scrollToCalendarMonth(shiftMonth(visibleMonth, -1))}>
            <ChevronLeftIcon />
          </button>
          <button type="button" aria-label="Next month" onClick={() => scrollToCalendarMonth(shiftMonth(visibleMonth, 1))}>
            <ChevronRightIcon />
          </button>
          <button className="todayButton" type="button" onClick={() => scrollToCalendarMonth(initialMonth)}>Today</button>
        </div>

        <h2>{formatCalendarMonthTitle(visibleMonth)} <span aria-hidden="true">⌄</span></h2>

        <div className="calendarControls">
          <div className="viewTabs" aria-label="Calendar view">
            <button className="isActive" type="button">Month</button>
            <button type="button">Week</button>
            <button type="button">List</button>
          </div>
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
        tabIndex={0}
      >
        {isLoading ? (
          <div className="calendarLoadingOverlay" role="status">
            <span className="loadingSpinner" />
            <span>Syncing Steam calendar data...</span>
          </div>
        ) : null}
        <div className="calendarTimeline" role="grid" aria-label="Continuous calendar grid">
          {weeks.map((week) => {
            const weekLanes = Math.max(3, week.segments.reduce((highestLane, segment) => (
              Math.max(highestLane, segment.lane + 1)
            ), 0));

            return (
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
                style={{ '--week-lanes': weekLanes } as CSSProperties}
              >
                {week.cells.map((cell, index) => (
                  <div
                    className={cell.date.startsWith(`${visibleMonth}-`) ? 'dayCell' : 'dayCell outsideMonth'}
                    key={cell.date}
                    role="gridcell"
                    aria-label={`${formatDate(cell.date)}${cell.events.length ? `, ${cell.events.length} events` : ''}`}
                    style={{ gridColumn: index + 1 } as CSSProperties}
                  >
                    <span className={cell.date === todayIso ? 'dayNumber isToday' : 'dayNumber'}>{cell.day}</span>
                  </div>
                ))}
                {week.segments.map((segment) => (
                  <button
                    aria-label={segment.event.title}
                    className={[
                      'calendarSegment',
                      segment.event.type,
                      eventVisualClass(segment.event),
                      segment.event.id === selectedEventId ? 'isSelected' : '',
                      segment.event.appId && segment.event.appId === recentlyAddedAppId ? 'isNewCalendarItem' : '',
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
                    onClick={() => onSelectEvent(segment.event.id)}
                    title={segment.event.title}
                    type="button"
                  >
                    <span className="segmentTitle">{compactEventTitle(segment.event.title)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="calendarLegend" aria-label="Calendar legend">
        <span><i className="legendDot dealEvent" />Deals</span>
        <span><i className="legendDot preorderEvent" />Preorders</span>
        <span><i className="legendDot nextFestEvent" />Fests / Events</span>
        <span><i className="legendDot saleEvent" />Sales</span>
      </div>
    </section>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" className="toolbarSvg" viewBox="0 0 20 20">
      <path d="m12.5 4.5-5 5.5 5 5.5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="toolbarSvg" viewBox="0 0 20 20">
      <path d="m7.5 4.5 5 5.5-5 5.5" />
    </svg>
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

function SourceToggle({
  checked,
  description,
  onChange,
  title,
}: {
  checked: boolean;
  description: string;
  onChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <div className="sourceCard">
      <div className="sourceTitleRow">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <label className="switch">
          <input
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            type="checkbox"
          />
          <span />
        </label>
      </div>
    </div>
  );
}

function EventDetails({
  event,
  onRemove,
  webcalUrl,
}: {
  event: PreviewEvent | null;
  onRemove: (eventId: string) => void;
  webcalUrl: string;
}) {
  if (!event) {
    return (
      <aside className="detailPanel" aria-label="Selected event details">
        <div className="emptyDetail">
          <h2>No events visible</h2>
          <p>Turn on a calendar source to preview the Steam Sale Calendar.</p>
        </div>
      </aside>
    );
  }

  const isGameEvent = event.type === 'steam_deal' || event.type === 'steam_preorder' || event.type === 'wishlist_release';
  const hasSteamCliImage = Boolean(event.imageUrl);
  const heroStyle = event.imageUrl ? {
    backgroundImage: `linear-gradient(180deg, rgba(5, 9, 15, 0.02), rgba(5, 9, 15, 0.18)), url("${event.imageUrl}")`,
  } as CSSProperties : undefined;

  return (
    <aside className="detailPanel" aria-label="Selected event details">
      <button className="closeDetail" type="button" aria-label="Close details">×</button>
      <div className="detailTitleBlock">
        <span>{detailKind(event)}</span>
        <h2>{detailTitle(event)}</h2>
      </div>
      <div
        className={[
          'detailHero',
          isGameEvent ? 'gameHero' : 'steamHero',
          hasSteamCliImage ? 'hasSteamCliImage' : 'noSteamCliImage',
        ].join(' ')}
        style={heroStyle}
      >
        {!hasSteamCliImage ? <span>Steam CLI event data</span> : null}
      </div>

      <div className="detailBody">
        <div className="detailMeta">
          <span>{formatDate(event.startDate)}</span>
          {event.endDate ? <span>Until {formatDate(event.endDate)}</span> : null}
        </div>

        {event.discount || event.finalPrice ? (
          <div className="commerceLine">
            {event.discount ? <div className="discountBadge">{event.discount}</div> : null}

            {event.finalPrice ? (
              <div className="priceLine">
                <strong>{event.finalPrice}</strong>
                {event.originalPrice ? <span>{event.originalPrice}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="detailDescription">{detailDescription(event)}</p>

        {event.type === 'steam_deal' ? (
          <p className="detailNote">This deal is shown from now until Steam reports it ends.</p>
        ) : null}

        <div className="detailActions">
          {event.sourceUrl ? (
            <a className="secondaryAction" href={event.sourceUrl} rel="noreferrer" target="_blank">
              <SteamButtonIcon />
              View on Steam
            </a>
          ) : null}
          <button className="ghostAction" onClick={() => onRemove(event.id)} type="button">Remove from calendar</button>
        </div>

        <div className="subscribeBox">
          <p>Works with</p>
          <div className="calendarAppGrid" aria-label="Supported calendar apps">
            <span><i className="appIcon appleIcon" />Apple Calendar</span>
            <span><i className="appIcon googleIcon" />Google Calendar</span>
            <span><i className="appIcon outlookIcon" />Outlook</span>
            <span><i className="appIcon multiIcon" />Fantastical</span>
          </div>
          <div className="calendarApps">Subscribe once. See events in your calendar apps.</div>
        </div>
      </div>
    </aside>
  );
}

function SteamButtonIcon() {
  return (
    <svg aria-hidden="true" className="toolbarSvg" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7" />
      <circle cx="12.8" cy="7.2" r="2.1" />
      <path d="M4.3 11.8 8.1 13a2.1 2.1 0 0 0 2.2 1.2 2.2 2.2 0 0 0 1.7-2.6 2.1 2.1 0 0 0-2.7-1.6L6.4 8.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="miniIcon" viewBox="0 0 20 20">
      <circle cx="8.7" cy="8.7" r="5.2" />
      <path d="m12.4 12.4 4 4" />
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

function LinkIcon() {
  return (
    <svg aria-hidden="true" className="linkIcon" viewBox="0 0 20 20">
      <path d="M8.2 11.8a3 3 0 0 1 0-4.2l2-2a3 3 0 1 1 4.2 4.2l-1.1 1.1" />
      <path d="M11.8 8.2a3 3 0 0 1 0 4.2l-2 2a3 3 0 1 1-4.2-4.2l1.1-1.1" />
    </svg>
  );
}

function buildDemoEvents(todayIso: string): PreviewEvent[] {
  const monthStart = `${monthKeyFromIsoDate(todayIso)}-01`;

  return [
    {
      id: 'demo-next-fest-start',
      title: '🎮 Steam Next Fest',
      description: 'Official Steam festival event. Subscribe to keep it in your calendar.',
      startDate: addDays(monthStart, 0),
      endDate: addDays(monthStart, 4),
      sourceUrl: 'https://store.steampowered.com/',
      type: 'steam_major_event',
    },
    {
      id: 'demo-subnautica',
      title: '-75% Subnautica',
      description: 'Top seller deal shown from now until Steam reports it ends.',
      startDate: addDays(monthStart, 2),
      endDate: addDays(monthStart, 9),
      sourceUrl: 'https://store.steampowered.com/app/264710/Subnautica/',
      type: 'steam_deal',
      appId: '264710',
      discount: '-75%',
      originalPrice: '$29.99',
      finalPrice: '$7.49',
    },
    {
      id: 'demo-hollow-knight',
      title: 'Hollow Knight: Silksong preorder',
      description: 'Preorder tracked as a Steam calendar item.',
      startDate: addDays(monthStart, 6),
      sourceUrl: 'https://store.steampowered.com/',
      type: 'steam_preorder',
    },
    {
      id: 'demo-elden-ring',
      title: '-50% Elden Ring',
      description: 'Popular discount included in the default Steam Sale Calendar preview.',
      startDate: addDays(monthStart, 8),
      endDate: addDays(monthStart, 15),
      sourceUrl: 'https://store.steampowered.com/',
      type: 'steam_deal',
      discount: '-50%',
      originalPrice: '$59.99',
      finalPrice: '$29.99',
    },
    {
      id: 'demo-spring-sale',
      title: '🎮 Steam Spring Sale',
      description: 'Official Steam sale period displayed as a multi-day calendar event.',
      startDate: addDays(monthStart, 13),
      endDate: addDays(monthStart, 22),
      sourceUrl: 'https://store.steampowered.com/',
      type: 'steam_major_event',
    },
    {
      id: 'demo-red-dead',
      title: '-70% Red Dead Redemption 2',
      description: 'Top seller deal shown from now until Steam reports it ends.',
      startDate: addDays(monthStart, 17),
      endDate: addDays(monthStart, 24),
      sourceUrl: 'https://store.steampowered.com/',
      type: 'steam_deal',
      discount: '-70%',
      originalPrice: '$59.99',
      finalPrice: '$17.99',
    },
    {
      id: 'demo-ocean-fest',
      title: '🎮 Ocean Fest Begins',
      description: 'Themed Steam fest displayed from the official event feed.',
      startDate: addDays(monthStart, 24),
      endDate: addDays(monthStart, 28),
      sourceUrl: 'https://store.steampowered.com/',
      type: 'steam_major_event',
    },
    {
      id: 'demo-no-mans-sky',
      title: "-35% No Man's Sky",
      description: 'A discount item that will appear in your OS calendar while the deal is active.',
      startDate: addDays(monthStart, 28),
      endDate: addDays(monthStart, 33),
      sourceUrl: 'https://store.steampowered.com/',
      type: 'steam_deal',
      discount: '-35%',
      originalPrice: '$59.99',
      finalPrice: '$38.99',
    },
  ];
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

function localIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function clampInteger(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function compareSteamEventCategories(first: SteamEventCategory, second: SteamEventCategory): number {
  return STEAM_EVENT_CATEGORIES.indexOf(first) - STEAM_EVENT_CATEGORIES.indexOf(second);
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

function eventVisualClass(event: PreviewEvent): string {
  if (event.type === 'steam_deal') {
    return 'dealEvent';
  }

  if (event.type === 'steam_preorder') {
    return 'preorderEvent';
  }

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
    .replace(/^🎮\s*Steam\s*/, '')
    .replace(/^🎮\s*/, '');
}

function detailKind(event: PreviewEvent): string {
  switch (event.type) {
    case 'steam_deal':
      return 'Hot deal';
    case 'steam_preorder':
      return 'Preorder';
    case 'wishlist_release':
      return 'Watched game';
    case 'steam_major_event':
      return 'Steam Sales & Fests';
  }
}

function detailTitle(event: PreviewEvent): string {
  if (event.type === 'steam_deal' && event.discount) {
    return event.title.replace(`${event.discount} `, '');
  }

  return event.title.replace(/^🎮\s*/, '');
}

function detailDescription(event: PreviewEvent): string {
  return event.description.split('\n')[0] || event.title;
}

function gameSearchMeta(game: GameSearchResult): string {
  if (!game.price) {
    return `Steam app ${game.appId}`;
  }

  if (game.price.discountPercent > 0) {
    const price = game.price.finalFormatted || 'discounted';
    return `-${game.price.discountPercent}% ${price}`;
  }

  return game.price.finalFormatted || `Steam app ${game.appId}`;
}
