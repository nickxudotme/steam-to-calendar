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

type CalendarView = 'month' | 'list';

type UiLanguage = 'en' | 'zh';

type LanguageOption = {
  code: string;
  label: string;
  steamLang: string;
  uiLang: string;
  uiLanguage: UiLanguage;
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

const WEEKDAY_LABELS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
} satisfies Record<UiLanguage, string[]>;
const MAX_EVENT_LANES = 12;
const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', steamLang: 'english', uiLang: 'en', uiLanguage: 'en' },
  { code: 'zh-CN', label: '简体中文', steamLang: 'schinese', uiLang: 'zh-CN', uiLanguage: 'zh' },
] as const satisfies readonly LanguageOption[];
const STEAM_EVENT_CATEGORY_LABELS = {
  en: {
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
  },
  zh: {
    seasonal: {
      title: '季节促销',
      description: '春促、夏促、秋促、冬促等官方促销窗口。',
    },
    next_fest: {
      title: '新品节',
      description: '面向即将推出游戏的官方试玩节。',
    },
    fest: {
      title: '主题游戏节',
      description: '按类型或主题组织的 Steam 活动，例如牌组构筑或弹幕天堂。',
    },
    store_sale: {
      title: '商店促销页',
      description: '发行商、系列作品和合作伙伴促销页。',
    },
  },
} satisfies Record<UiLanguage, Record<SteamEventCategory, { description: string; title: string }>>;
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

const UI_COPY = {
  en: {
    addApple: 'Add to Apple Calendar',
    addToCalendar: 'Add to your Calendar',
    copyFeed: 'Copy feed URL',
    copied: 'Copied',
    calendarSources: 'Calendar sources',
    hotDealsTitle: 'Hot Deals & Preorders',
    hotDealsDescription: 'Top sellers that are currently discounted or available to preorder.',
    itemsLabel: 'Items',
    steamEventsTitle: 'Steam Sales & Fests',
    steamEventsDescription: 'Official Steam sale events, Next Fest, themed fests, and public sale pages.',
    pastDays: 'Past days',
    nextDays: 'Next days',
    myGamesTitle: 'My Games',
    myGamesDescription: 'Watch specific games, then connect a public Steam wishlist when you want it to replace manual picks.',
    languageLabel: 'Language',
    storeSuffix: 'Store',
    settingsLabel: 'Settings',
    storeRegionLabel: 'Store region',
    storeNote: 'Store region affects prices, not language.',
    searchPlaceholder: 'Search Steam games, appID, or store URL',
    searchButton: 'Search',
    searchingButton: 'Searching...',
    searchResultsTitle: 'Steam search results',
    searchResultsCount: 'results',
    noSearchResults: 'No Steam games found',
    steamAppLabel: 'Steam app',
    priceUnavailable: 'Price unavailable',
    wishlistPrivateHint: 'Wishlist unavailable. Search or paste a game above, or keep the Steam sale calendar without a wishlist.',
    wishlistGenericHint: 'Steam did not respond. You can keep the Steam sale calendar and add games manually.',
    wishlistConnected: 'Wishlist connected. Manual game picks are ignored while this calendar uses your Steam wishlist.',
    syncingPreview: 'Syncing your calendar preview with Steam data...',
    trendingNow: 'Trending now',
    addedToCalendar: 'Added to calendar',
    added: 'Added',
    add: 'Add',
    remove: 'Remove',
    steamProfilePlaceholder: 'Paste Steam Profile URL',
    importing: 'Importing...',
    importWishlist: 'Import Steam Wishlist',
    importingWishlist: 'Reading your public Steam wishlist and preparing calendar events. This can take a moment for larger wishlists.',
    wishlistHint: 'Connecting a public wishlist replaces manual picks and keeps future releases synced in this calendar.',
    today: 'Today',
    month: 'Month',
    list: 'List',
    syncingCalendar: 'Syncing Steam calendar data...',
    noCalendarEvents: 'No calendar events',
    noCalendarEventsDescription: 'Enable Steam events, deals, or watched games to preview them here.',
    dealsLegend: 'Deals',
    preordersLegend: 'Preorders',
    eventsLegend: 'Fests / Events',
    salesLegend: 'Sales',
    noEventsVisible: 'No events visible',
    noEventsVisibleDescription: 'Turn on a calendar source to preview the Steam Sale Calendar.',
    steamCliEventData: 'Steam CLI event data',
    until: 'Until',
    dealNote: 'This deal is shown from now until Steam reports it ends.',
    viewOnSteam: 'View on Steam',
    hidePreview: 'Hide in preview',
    subscribeFromTop: 'Subscribe from the top bar. Updates follow your calendar app refresh schedule.',
    footerNotice: 'Steam Sale Calendar is not affiliated with Valve Corp.',
    footerHowItWorks: 'How it works',
    footerPrivacy: 'Privacy',
    footerChangelog: 'Changelog',
  },
  zh: {
    addApple: '添加到 Apple 日历',
    addToCalendar: '添加到系统日历',
    copyFeed: '复制订阅链接',
    copied: '已复制',
    calendarSources: '日历来源',
    hotDealsTitle: '热门折扣与预购',
    hotDealsDescription: '当前正在打折或可预购的热门 Steam 游戏。',
    itemsLabel: '数量',
    steamEventsTitle: 'Steam 促销与活动',
    steamEventsDescription: 'Steam 官方促销、新品节、主题游戏节和公开促销页面。',
    pastDays: '过去天数',
    nextDays: '未来天数',
    myGamesTitle: '我的游戏',
    myGamesDescription: '关注指定游戏；之后也可以关联公开 Steam 愿望单来替代手动选择。',
    languageLabel: '语言',
    storeSuffix: '商店',
    settingsLabel: '设置',
    storeRegionLabel: '商店地区',
    storeNote: '商店地区影响价格，不影响界面语言。',
    searchPlaceholder: '搜索游戏、AppID 或 Steam 商店链接',
    searchButton: '搜索',
    searchingButton: '搜索中...',
    searchResultsTitle: 'Steam 搜索结果',
    searchResultsCount: '个结果',
    noSearchResults: '没有找到 Steam 游戏',
    steamAppLabel: 'Steam 应用',
    priceUnavailable: '暂无价格',
    wishlistPrivateHint: '愿望单暂不可用。可以在上方搜索或粘贴游戏，也可以只订阅 Steam 促销日历。',
    wishlistGenericHint: 'Steam 暂时没有响应。你仍然可以保留 Steam 促销日历并手动添加游戏。',
    wishlistConnected: '愿望单已关联。当前日历使用你的 Steam 愿望单，手动添加的游戏会被忽略。',
    syncingPreview: '正在从 Steam 同步日历预览...',
    trendingNow: '近期热门',
    addedToCalendar: '已添加到日历',
    added: '已添加',
    add: '添加',
    remove: '移除',
    steamProfilePlaceholder: '粘贴 Steam 个人资料链接',
    importing: '导入中...',
    importWishlist: '导入 Steam 愿望单',
    importingWishlist: '正在读取你的公开 Steam 愿望单并准备日历事件。愿望单较大时可能需要一点时间。',
    wishlistHint: '关联公开愿望单后会替代手动选择，并让未来发售事件持续同步到这个日历。',
    today: '今天',
    month: '月',
    list: '列表',
    syncingCalendar: '正在同步 Steam 日历数据...',
    noCalendarEvents: '暂无日历事件',
    noCalendarEventsDescription: '开启 Steam 活动、折扣或关注游戏后，就可以在这里预览。',
    dealsLegend: '折扣',
    preordersLegend: '预购',
    eventsLegend: '活动',
    salesLegend: '促销',
    noEventsVisible: '暂无可见事件',
    noEventsVisibleDescription: '打开一个日历来源后即可预览 Steam 促销日历。',
    steamCliEventData: 'Steam CLI 活动数据',
    until: '至',
    dealNote: '这个折扣会从当前时间显示到 Steam 返回的结束时间。',
    viewOnSteam: '在 Steam 查看',
    hidePreview: '在预览中隐藏',
    subscribeFromTop: '从顶部栏订阅。更新频率由你的日历 App 决定。',
    footerNotice: 'Steam Sale Calendar 与 Valve Corp. 没有关联。',
    footerHowItWorks: '工作方式',
    footerPrivacy: '隐私',
    footerChangelog: '更新记录',
  },
} satisfies Record<UiLanguage, Record<string, string>>;

export default function Home() {
  const [steamId64, setSteamId64] = useState('');
  const [preview, setPreview] = useState<PreviewResponse>(PUBLIC_PREVIEW);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [publicPreviewError, setPublicPreviewError] = useState<string | null>(null);
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
  const [lastGameSearchQuery, setLastGameSearchQuery] = useState('');
  const [isSearchingGames, setIsSearchingGames] = useState(false);
  const [selectedGames, setSelectedGames] = useState<SelectedGame[]>([]);
  const [recentlyAddedAppId, setRecentlyAddedAppId] = useState<string | null>(null);
  const [storeRegion, setStoreRegion] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(() => new Set());
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('en');
  const [selectedLanguageCode, setSelectedLanguageCode] = useState('en');
  const [todayIso, setTodayIso] = useState(() => localIsoDate());
  const [origin, setOrigin] = useState('');
  const userSelectedRegionRef = useRef(false);
  const demoEvents = useMemo(() => buildDemoEvents(todayIso), [todayIso]);
  const selectedLanguage = languageOptionByCode(selectedLanguageCode);
  const copy = UI_COPY[uiLanguage];
  const effectiveStoreRegion = storeRegion ?? preview.locale?.cc ?? 'US';
  const effectiveStoreRegionLabel = `${countryFlag(effectiveStoreRegion)} ${steamStoreRegionName(effectiveStoreRegion)} ${copy.storeSuffix}`;
  const effectiveSteamLang = selectedLanguage.steamLang;
  const effectiveUiLang = selectedLanguage.uiLang;
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
    params.set('lang', effectiveSteamLang);
    params.set('uiLang', effectiveUiLang);

    return params.toString();
  }, [calendarConfig, effectiveSteamLang, effectiveUiLang, storeRegion]);

  const calendarQuery = useMemo(() => {
    const params = calendarConfigToSearchParams(calendarConfig);

    params.set('cc', effectiveStoreRegion);
    params.set('lang', effectiveSteamLang);
    params.set('uiLang', effectiveUiLang);

    return params.toString();
  }, [calendarConfig, effectiveSteamLang, effectiveStoreRegion, effectiveUiLang]);

  const feedUrl = useMemo(() => {
    return origin
      ? `${origin}${preview.feedPath}?${calendarQuery}`
      : `${preview.feedPath}?${calendarQuery}`;
  }, [calendarQuery, origin, preview.feedPath]);

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

  const initialFocusDate = useMemo(() => (
    chooseCalendarFocusDate(visibleEvents, todayIso)
  ), [todayIso, visibleEvents]);

  const preferredEventId = visibleEvents.find((event) => event.type === 'steam_deal')?.id ?? visibleEvents[0]?.id ?? null;
  const selectedEvent = useMemo(() => (
    visibleEvents.find((event) => event.id === selectedEventId) ??
    visibleEvents.find((event) => event.id === preferredEventId) ??
    null
  ), [preferredEventId, selectedEventId, visibleEvents]);

  useEffect(() => {
    setOrigin(window.location.origin);
    const browserLanguage = languageCodeFromBrowser(navigator.language);
    setSelectedLanguageCode(browserLanguage.code);
    setUiLanguage(browserLanguage.uiLanguage);
    const browserTodayIso = localIsoDate();

    setTodayIso(browserTodayIso);
  }, []);

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyStatus('idle'), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

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
          setPublicPreviewError(null);
          setPreview((currentPreview) => (
            currentPreview.steamId64 === STEAM_EVENTS_CALENDAR_ID ? payload : currentPreview
          ));

          if (!userSelectedRegionRef.current && !storeRegion && payload.locale?.cc) {
            setStoreRegion(payload.locale.cc);
          }
        }
    } catch (caught) {
      console.error(caught);
      if (isMounted) {
        setPublicPreviewError(caught instanceof Error ? caught.message : 'Could not load Steam events.');
      }
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
        lang: effectiveSteamLang,
        query,
        uiLang: effectiveUiLang,
      });
      const response = await fetch(`/api/search-games?${params.toString()}`);
      const payload = await response.json() as { message?: string; results?: GameSearchResult[] };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Could not search Steam games.');
      }

      setLastGameSearchQuery(query);
      setGameSearchResults(payload.results ?? []);
    } catch (caught) {
      setLastGameSearchQuery(query);
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
    setErrorCode(null);

    try {
      const previewParams = new URLSearchParams({
        lang: effectiveSteamLang,
        uiLang: effectiveUiLang,
      });
      const response = await fetch(`/api/preview?${previewParams.toString()}`, {
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
        setErrorCode(typeof payload.code === 'string' ? payload.code : null);
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

  async function handleCopyFeedUrl() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('idle');
    }
  }

  function handleStoreRegionChange(value: string) {
    userSelectedRegionRef.current = true;
    setStoreRegion(value);
  }

  function handleLanguageChange(value: string) {
    const language = languageOptionByCode(value);
    setSelectedLanguageCode(language.code);
    setUiLanguage(language.uiLanguage);
  }

  function handleSteamEventCategoryChange(category: SteamEventCategory, checked: boolean) {
    setSteamEventCategories((categories) => (
      checked
        ? [...categories, category].sort(compareSteamEventCategories)
        : categories.filter((currentCategory) => currentCategory !== category)
    ));
  }

  function handleCalendarEventSelect(eventId: string) {
    setSelectedEventId(eventId);
    setIsMobileSettingsOpen(false);
    setIsMobileDetailOpen(true);
  }

  function handleCloseMobileOverlays() {
    setIsMobileSettingsOpen(false);
    setIsMobileDetailOpen(false);
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
          <div className="headerControls" aria-hidden={isMobileSettingsOpen || undefined}>
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
            <label className="languageSelect">
              <span><span className="selectPrefix">{copy.languageLabel}: </span>{selectedLanguage.label}</span>
              <select
                aria-label="Language"
                value={selectedLanguage.code}
                onChange={(event) => handleLanguageChange(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="regionHint">{copy.storeNote}</span>
            <a className="calendarCta" href={webcalUrl}>
              <CalendarListIcon />
              {copy.addToCalendar}
            </a>
            <button className="copyFeedButton" type="button" onClick={handleCopyFeedUrl}>
              {copyStatus === 'copied' ? copy.copied : copy.copyFeed}
            </button>
          </div>
        </header>

        <h1 className="srOnly">Build your Steam Sale Calendar</h1>

        <button
          aria-label="Close overlay"
          className={isMobileSettingsOpen || isMobileDetailOpen ? 'mobileSheetBackdrop isVisible' : 'mobileSheetBackdrop'}
          onClick={handleCloseMobileOverlays}
          type="button"
        />

        <section className="calendarWorkbench" aria-label="Steam Sale Calendar workbench">
          <aside className={isMobileSettingsOpen ? 'configPanel isMobileOpen' : 'configPanel'} aria-label="Calendar configuration">
            <div className="mobileSheetHeader">
              <h2>{copy.settingsLabel}</h2>
              <button aria-label="Close settings" type="button" onClick={() => setIsMobileSettingsOpen(false)}>×</button>
            </div>

            <div className="mobileSheetControls" aria-hidden={!isMobileSettingsOpen}>
              <label className="sheetSelect">
                <span>{copy.storeRegionLabel}</span>
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

              <label className="sheetSelect">
                <span>{copy.languageLabel}</span>
                <select
                  aria-label="Language"
                  value={selectedLanguage.code}
                  onChange={(event) => handleLanguageChange(event.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>

              <button className="mobileCopyFeedButton" type="button" onClick={handleCopyFeedUrl}>
                {copyStatus === 'copied' ? copy.copied : copy.copyFeed}
              </button>
            </div>

            <div className="panelHeader">
              <h2>{copy.calendarSources}</h2>
            </div>

            {publicPreviewError ? (
              <div className="notice error">{copy.wishlistGenericHint}</div>
            ) : null}

            <SourceToggle
              checked={showDeals}
              title={copy.hotDealsTitle}
              description={copy.hotDealsDescription}
              onChange={setShowDeals}
            />

            <div className="controlRow">
              <span>{copy.itemsLabel}</span>
              <div className="stepper" aria-label="Hot deals count">
                <button type="button" onClick={() => setDealCount((count) => Math.max(3, count - 1))}>-</button>
                <output>{dealCount}</output>
                <button type="button" onClick={() => setDealCount((count) => Math.min(10, count + 1))}>+</button>
              </div>
            </div>

            <SourceToggle
              checked={showSteamEvents}
              title={copy.steamEventsTitle}
              description={copy.steamEventsDescription}
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
                    <strong>{STEAM_EVENT_CATEGORY_LABELS[uiLanguage][category].title}</strong>
                    <small>{STEAM_EVENT_CATEGORY_LABELS[uiLanguage][category].description}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className="rangeGrid" aria-label="Steam event range">
              <label>
                <span>{copy.pastDays}</span>
                <input
                  type="number"
                  min="0"
                  max="730"
                  value={eventPastDays}
                  onChange={(event) => setEventPastDays(clampInteger(event.target.value, 0, 730, DEFAULT_CALENDAR_CONFIG.eventPastDays))}
                />
              </label>
              <label>
                <span>{copy.nextDays}</span>
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
                  <h3>{copy.myGamesTitle}</h3>
                  <p>{copy.myGamesDescription}</p>
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
                    placeholder={copy.searchPlaceholder}
                    type="search"
                    value={gameSearch}
                    onChange={(event) => {
                      setGameSearch(event.target.value);

                      if (!event.target.value.trim()) {
                        setGameSearchResults([]);
                        setGameSearchError(null);
                        setLastGameSearchQuery('');
                      }
                    }}
                  />
                </label>
                <button disabled={!showMyGames || hasConnectedWishlist || isSearchingGames || !gameSearch.trim()} type="submit">
                  {isSearchingGames ? copy.searchingButton : copy.searchButton}
                </button>
              </form>

              {hasConnectedWishlist ? (
                <div className="notice wishlistNotice">
                  {copy.wishlistConnected}
                </div>
              ) : null}

              {isPreviewLoading && !hasConnectedWishlist ? (
                <div className="notice loadingNotice" role="status">
                  {copy.syncingPreview}
                </div>
              ) : null}

              {trendingGames.length ? (
                <div className="trendingGames" aria-label="Trending games">
                  <span className="miniSectionTitle">{copy.trendingNow}</span>
                  {trendingGames.map((game) => {
                    const isSelected = selectedGames.some((selectedGame) => selectedGame.appId === game.appId);

                    return (
                      <div className="selectedGameRow" key={game.appId}>
                        <SteamCliImage fallbackClassName="gameThumbFallback" src={game.imageUrl} />
                        <span>{game.name}</span>
                        <button
                          disabled={hasConnectedWishlist || isSelected}
                          type="button"
                          onClick={() => handleAddManualGame(game)}
                        >
                          {isSelected ? copy.added : copy.add}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {selectedGames.length ? (
                <div className="selectedGames" aria-label="Games added to calendar">
                  <span className="miniSectionTitle">{copy.addedToCalendar}</span>
                  {selectedGames.map((game) => (
                    <div
                      className={game.appId === recentlyAddedAppId ? 'selectedGameRow isNewlyAdded' : 'selectedGameRow'}
                      key={game.appId}
                    >
                      <SteamCliImage fallbackClassName="gameThumbFallback" src={game.imageUrl} />
                      <span>{game.name}</span>
                      <button type="button" onClick={() => handleRemoveSelectedGame(game.appId)}>{copy.remove}</button>
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
                  <div className="gameSearchResultsHeader">
                    <span className="miniSectionTitle">{copy.searchResultsTitle}</span>
                    <span>{gameSearchResults.length} {copy.searchResultsCount}</span>
                  </div>
                  {gameSearchResults.map((game) => {
                    const isSelected = selectedGames.some((selectedGame) => selectedGame.appId === game.appId);

                    return (
                      <div className="gameSearchResult" key={game.appId}>
                        <SteamCliImage fallbackClassName="gameThumbFallback" src={game.imageUrl} />
                        <div>
                          <strong>{game.name}</strong>
                          <small>{gameSearchMeta(game, copy)}</small>
                        </div>
                        <button
                          disabled={hasConnectedWishlist || isSelected}
                          type="button"
                          onClick={() => handleAddSelectedGame(game)}
                        >
                          {isSelected ? copy.added : copy.add}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {!isSearchingGames && lastGameSearchQuery && !gameSearchResults.length && !gameSearchError ? (
                <div className="notice gameSearchEmpty" role="status">
                  <strong>{copy.noSearchResults}</strong>
                  <span>{lastGameSearchQuery}</span>
                </div>
              ) : null}

              <form
                className="wishlistImport"
                id="steam-connect"
                onSubmit={handleSubmit}
                aria-label="Import Steam wishlist releases to the calendar"
              >
                <label className="srOnly" htmlFor="steam-id">{copy.steamProfilePlaceholder}</label>
                <div className="steamInputWrap">
                  <LinkIcon />
                  <input
                    id="steam-id"
                    inputMode="text"
                    placeholder={copy.steamProfilePlaceholder}
                    value={steamId64}
                    onChange={(event) => setSteamId64(event.target.value)}
                  />
                </div>
                <button disabled={isLoading} type="submit">
                  {isLoading ? copy.importing : copy.importWishlist}
                </button>
              </form>
              {isLoading ? (
                <div className="notice loadingNotice" role="status">
                  {copy.importingWishlist}
                </div>
              ) : null}
              <p className="wishlistHint">{copy.wishlistHint}</p>

              {error ? <div className="notice error">{error}</div> : null}
              {error ? (
                <div className="notice fallbackNotice">
                  {errorCode === 'wishlist_private_or_unavailable'
                    ? copy.wishlistPrivateHint
                    : copy.wishlistGenericHint}
                </div>
              ) : null}
            </div>
          </aside>

          <div className="calendarExperience" id="calendar-preview">
            <CalendarPreview
              events={visibleEvents}
              initialFocusDate={initialFocusDate}
              isLoading={isPreviewLoading}
              onSelectEvent={handleCalendarEventSelect}
              recentlyAddedAppId={recentlyAddedAppId}
              selectedEventId={selectedEvent?.id ?? null}
              todayIso={todayIso}
              uiCopy={copy}
              uiLanguage={uiLanguage}
            />
          </div>

          <EventDetails
            event={selectedEvent}
            copy={copy}
            isMobileOpen={isMobileDetailOpen}
            onCloseMobile={() => setIsMobileDetailOpen(false)}
            uiLanguage={uiLanguage}
            onRemove={(eventId) => {
              setHiddenEventIds((ids) => new Set(ids).add(eventId));
              setIsMobileDetailOpen(false);
            }}
          />
        </section>

        <nav className="mobileBottomBar" aria-label="Mobile calendar actions">
          <a className="mobileAddCalendar" href={webcalUrl}>
            <CalendarListIcon />
            <span>{copy.addToCalendar}</span>
          </a>
          <button
            aria-label="Open settings"
            className="mobileSettingsButton"
            type="button"
            onClick={() => {
              setIsMobileDetailOpen(false);
              setIsMobileSettingsOpen(true);
            }}
          >
            <SettingsIcon />
          </button>
        </nav>

        <footer className="siteFooter">
          <span>{copy.footerNotice}</span>
          <nav aria-label="Footer links">
            <a href="#calendar-preview">{copy.footerHowItWorks}</a>
            <a href="#steam-connect">{copy.footerPrivacy}</a>
            <a href="#calendar-preview">{copy.footerChangelog}</a>
            <a href="https://github.com" rel="noreferrer" target="_blank">GitHub</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}

function CalendarPreview({
  events,
  initialFocusDate,
  isLoading,
  onSelectEvent,
  recentlyAddedAppId,
  selectedEventId,
  todayIso,
  uiCopy,
  uiLanguage,
}: {
  events: PreviewEvent[];
  initialFocusDate: string;
  isLoading: boolean;
  onSelectEvent: (eventId: string) => void;
  recentlyAddedAppId: string | null;
  selectedEventId: string | null;
  todayIso: string;
  uiCopy: typeof UI_COPY[UiLanguage];
  uiLanguage: UiLanguage;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const weekRefs = useRef(new Map<string, HTMLElement>());
  const initialMonth = monthKeyFromIsoDate(initialFocusDate);
  const initialWeekStart = useMemo(() => weekStartForDate(initialFocusDate), [initialFocusDate]);
  const todayWeekStart = useMemo(() => weekStartForDate(todayIso), [todayIso]);
  const weekRange = useMemo(() => buildEventWeekRange(events, todayIso), [events, todayIso]);
  const weeks = useMemo(() => buildContinuousCalendarWeeks(events, weekRange.startIso, weekRange.endIso), [events, weekRange]);
  const listEvents = useMemo(() => [...events].sort(compareEventsForList), [events]);
  const shouldAlignInitialWeek = useRef(true);
  const pendingWeekScroll = useRef<string | null>(null);
  const lastAlignedFocusDate = useRef<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const canScrollToToday = todayWeekStart >= weekRange.startIso && todayWeekStart < weekRange.endIso;

  useLayoutEffect(() => {
    if (lastAlignedFocusDate.current !== initialFocusDate) {
      shouldAlignInitialWeek.current = true;
      lastAlignedFocusDate.current = initialFocusDate;
    }
  }, [initialFocusDate, initialWeekStart]);

  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    if (!shouldAlignInitialWeek.current && !pendingWeekScroll.current) {
      return;
    }

    const targetWeekIso = pendingWeekScroll.current ?? initialWeekStart;
    const targetWeek = weekRefs.current.get(targetWeekIso);

    if (scrollElement && targetWeek) {
      scrollElement.scrollTop = targetWeek.offsetTop - scrollElement.offsetTop;
      setVisibleMonth(inferVisibleMonthFromWeek(targetWeekIso));
      shouldAlignInitialWeek.current = false;
      pendingWeekScroll.current = null;
      return;
    }

    const fallbackWeek = weeks[0]?.weekStartIso;
    const fallbackWeekNode = fallbackWeek ? weekRefs.current.get(fallbackWeek) : null;

    if (scrollElement && fallbackWeek && fallbackWeekNode) {
      scrollElement.scrollTop = fallbackWeekNode.offsetTop - scrollElement.offsetTop;
      setVisibleMonth(inferVisibleMonthFromWeek(fallbackWeek));
      shouldAlignInitialWeek.current = false;
      pendingWeekScroll.current = null;
    }
  }, [calendarView, initialWeekStart, weeks]);

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
  }, [initialWeekStart, weeks]);

  function scrollToCalendarWeek(weekStartIso: string, behavior: ScrollBehavior = 'smooth') {
    const scrollElement = scrollRef.current;
    const targetWeek = weekRefs.current.get(weekStartIso);

    if (!scrollElement || !targetWeek) {
      pendingWeekScroll.current = weekStartIso;
      return;
    }

    scrollElement.scrollTo({
      top: targetWeek.offsetTop - scrollElement.offsetTop,
      behavior,
    });
    setVisibleMonth(inferVisibleMonthFromWeek(weekStartIso));
    pendingWeekScroll.current = null;
  }

  function handleTodayClick() {
    if (!canScrollToToday) {
      return;
    }

    pendingWeekScroll.current = todayWeekStart;
    setCalendarView('month');
    scrollToCalendarWeek(todayWeekStart);
  }

  return (
    <section className={calendarView === 'list' ? 'calendarApp isListView' : 'calendarApp'} aria-label="Calendar preview">
      <div className="calendarHeader">
        <h2>{formatCalendarMonthTitle(visibleMonth, uiLanguage)}</h2>

        <div className="calendarControls">
          <button className="todayButton" disabled={!canScrollToToday} type="button" onClick={handleTodayClick}>{uiCopy.today}</button>
          <div className="viewTabs" aria-label="Calendar view">
            <button
              aria-pressed={calendarView === 'month'}
              className={calendarView === 'month' ? 'isActive' : ''}
              type="button"
              onClick={() => setCalendarView('month')}
            >
              {uiCopy.month}
            </button>
            <button
              aria-pressed={calendarView === 'list'}
              className={calendarView === 'list' ? 'isActive' : ''}
              type="button"
              onClick={() => setCalendarView('list')}
            >
              {uiCopy.list}
            </button>
          </div>
        </div>
      </div>

      {calendarView === 'month' ? (
        <>
          <div
            className="calendarWeekdays"
            aria-hidden="true"
          >
            {WEEKDAY_LABELS[uiLanguage].map((weekday) => (
              <div className="weekday" key={weekday}>{weekday}</div>
            ))}
          </div>

          <div
            className="calendarScroll"
            ref={scrollRef}
            aria-label="Scrollable calendar weeks"
            tabIndex={0}
          >
            {isLoading ? (
              <div className="calendarLoadingOverlay" role="status">
                <span className="loadingSpinner" />
                <span>{uiCopy.syncingCalendar}</span>
              </div>
            ) : null}
            <div className="calendarTimeline" role="grid" aria-label="Continuous calendar grid">
              {weeks.map((week) => {
                const weekLanes = Math.max(3, week.segments.reduce((highestLane, segment) => (
                  Math.max(highestLane, segment.lane + 1)
                ), 0));

                return (
                  <div
                    aria-label={`Week of ${formatDate(week.weekStartIso, uiLanguage)}`}
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
                        aria-label={`${formatDate(cell.date, uiLanguage)}${cell.events.length ? `, ${cell.events.length} events` : ''}`}
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
            <span><i className="legendDot dealEvent" />{uiCopy.dealsLegend}</span>
            <span><i className="legendDot preorderEvent" />{uiCopy.preordersLegend}</span>
            <span><i className="legendDot nextFestEvent" />{uiCopy.eventsLegend}</span>
            <span><i className="legendDot saleEvent" />{uiCopy.salesLegend}</span>
          </div>
        </>
      ) : (
        <div className="eventListScroll" aria-label="Calendar event list">
          {isLoading ? (
            <div className="calendarLoadingOverlay" role="status">
              <span className="loadingSpinner" />
              <span>{uiCopy.syncingCalendar}</span>
            </div>
          ) : null}
          {listEvents.length ? (
            <div className="eventList">
              {listEvents.map((event) => (
                <button
                  className={[
                    'eventListItem',
                    eventVisualClass(event),
                    event.id === selectedEventId ? 'isSelected' : '',
                    event.appId && event.appId === recentlyAddedAppId ? 'isNewCalendarItem' : '',
                  ].filter(Boolean).join(' ')}
                  data-testid="calendar-event-list-item"
                  key={event.id}
                  onClick={() => onSelectEvent(event.id)}
                  type="button"
                >
                  <span className="eventListMarker" aria-hidden="true" />
                  <SteamCliImage fallbackClassName="eventListThumbFallback" src={event.imageUrl} />
                  <span className="eventListContent">
                    <span className="eventListMeta">
                      <span>{formatEventDateRange(event, uiLanguage)}</span>
                      <span>{detailKind(event, uiCopy)}</span>
                    </span>
                    <strong>{detailTitle(event)}</strong>
                    <span className="eventListDescription">{detailDescription(event)}</span>
                  </span>
                  {event.discount || event.finalPrice ? (
                    <span className="eventListPrice">
                      {event.discount ? <strong>{event.discount}</strong> : null}
                      {event.finalPrice ? <span>{event.finalPrice}</span> : null}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="emptyEventList">
              <h3>{uiCopy.noCalendarEvents}</h3>
              <p>{uiCopy.noCalendarEventsDescription}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SteamCliImage({
  fallbackClassName,
  src,
}: {
  fallbackClassName: string;
  src?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const shouldShowImage = Boolean(src && failedSrc !== src);

  if (!shouldShowImage) {
    return <span className={fallbackClassName} />;
  }

  return <img src={src} alt="" onError={() => setFailedSrc(src ?? null)} />;
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
  copy,
  event,
  isMobileOpen,
  onCloseMobile,
  onRemove,
  uiLanguage,
}: {
  copy: typeof UI_COPY[UiLanguage];
  event: PreviewEvent | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onRemove: (eventId: string) => void;
  uiLanguage: UiLanguage;
}) {
  if (!event) {
    return (
      <aside className={isMobileOpen ? 'detailPanel isMobileOpen' : 'detailPanel'} aria-label="Selected event details">
        <div className="mobileDetailHeader">
          <h2>{copy.noEventsVisible}</h2>
          <button aria-label="Close details" type="button" onClick={onCloseMobile}>×</button>
        </div>
        <div className="emptyDetail">
          <h2>{copy.noEventsVisible}</h2>
          <p>{copy.noEventsVisibleDescription}</p>
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
    <aside className={isMobileOpen ? 'detailPanel isMobileOpen' : 'detailPanel'} aria-label="Selected event details">
      <div className="mobileDetailHeader">
        <h2>{copy.steamEventsTitle}</h2>
        <button aria-label="Close details" type="button" onClick={onCloseMobile}>×</button>
      </div>
      <div className="detailTitleBlock">
        <span>{detailKind(event, copy)}</span>
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
        {!hasSteamCliImage ? <span>{copy.steamCliEventData}</span> : null}
      </div>

      <div className="detailBody">
        <div className="detailMeta">
          <span>{formatDate(event.startDate, uiLanguage)}</span>
          {event.endDate ? <span>{copy.until} {formatDate(event.endDate, uiLanguage)}</span> : null}
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
          <p className="detailNote">{copy.dealNote}</p>
        ) : null}

        <div className="detailActions">
          {event.sourceUrl ? (
            <a className="secondaryAction" href={event.sourceUrl} rel="noreferrer" target="_blank">
              <SteamButtonIcon />
              {copy.viewOnSteam}
            </a>
          ) : null}
          <button className="ghostAction" onClick={() => onRemove(event.id)} type="button">{copy.hidePreview}</button>
        </div>

        <div className="subscribeHint">{copy.subscribeFromTop}</div>
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

function buildEventWeekRange(events: PreviewEvent[], todayIso: string): { startIso: string; endIso: string } {
  if (!events.length) {
    const todayWeekStart = weekStartForDate(todayIso);

    return {
      startIso: todayWeekStart,
      endIso: addDays(todayWeekStart, 7),
    };
  }

  const earliestDate = events.reduce((earliest, event) => (
    event.startDate < earliest ? event.startDate : earliest
  ), events[0].startDate);
  const latestDate = events.reduce((latest, event) => {
    const eventEndDate = event.endDate ?? event.startDate;
    return eventEndDate > latest ? eventEndDate : latest;
  }, events[0].endDate ?? events[0].startDate);
  const startIso = weekStartForDate(earliestDate);
  const finalWeekStart = weekStartForDate(latestDate);

  return {
    startIso,
    endIso: addDays(finalWeekStart, 7),
  };
}

function languageOptionByCode(code: string): LanguageOption {
  return LANGUAGE_OPTIONS.find((language) => language.code === code) ?? LANGUAGE_OPTIONS[0];
}

function languageCodeFromBrowser(language: string): LanguageOption {
  const lower = language.toLowerCase();

  if (lower.startsWith('zh')) {
    return languageOptionByCode('zh-CN');
  }

  return languageOptionByCode('en');
}

function chooseCalendarFocusDate(events: PreviewEvent[], todayIso: string): string {
  const activeToday = events.find((event) => eventOccursOn(event, todayIso));

  if (activeToday) {
    return todayIso;
  }

  const upcoming = events
    .filter((event) => event.startDate >= todayIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  if (upcoming) {
    return upcoming.startDate;
  }

  return todayIso;
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

function weekStartForDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
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

function uiLocale(uiLanguage: UiLanguage): string {
  return uiLanguage === 'zh' ? 'zh-CN' : 'en';
}

function formatMonth(value: string, uiLanguage: UiLanguage): string {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(uiLocale(uiLanguage), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatCalendarMonthTitle(value: string, uiLanguage: UiLanguage): string {
  return formatMonth(value, uiLanguage);
}

function formatDate(value: string, uiLanguage: UiLanguage = 'en'): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(uiLocale(uiLanguage), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatEventDateRange(event: PreviewEvent, uiLanguage: UiLanguage): string {
  if (!event.endDate || event.endDate === event.startDate) {
    return formatDate(event.startDate, uiLanguage);
  }

  return `${formatDate(event.startDate, uiLanguage)} - ${formatDate(event.endDate, uiLanguage)}`;
}

function compareEventsForList(firstEvent: PreviewEvent, secondEvent: PreviewEvent): number {
  const dateComparison = firstEvent.startDate.localeCompare(secondEvent.startDate);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return detailTitle(firstEvent).localeCompare(detailTitle(secondEvent));
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

function detailKind(event: PreviewEvent, copy: typeof UI_COPY[UiLanguage]): string {
  switch (event.type) {
    case 'steam_deal':
      return copy.hotDealsTitle;
    case 'steam_preorder':
      return copy.preordersLegend;
    case 'wishlist_release':
      return copy.myGamesTitle;
    case 'steam_major_event':
      return copy.steamEventsTitle;
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

function gameSearchMeta(game: GameSearchResult, copy: Record<string, string>): string {
  const appLabel = `${copy.steamAppLabel} ${game.appId}`;

  if (!game.price) {
    return appLabel;
  }

  if (game.price.discountPercent > 0) {
    const price = game.price.finalFormatted || copy.priceUnavailable;
    return `${appLabel} · -${game.price.discountPercent}% ${price}`;
  }

  return `${appLabel} · ${game.price.finalFormatted || copy.priceUnavailable}`;
}
