'use client';

import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  calendarConfigToSearchParams,
  DEFAULT_CALENDAR_CONFIG,
  STEAM_EVENT_CATEGORIES,
  type CalendarConfig,
  type SteamEventCategory,
} from '@/lib/calendar-config';
import { STEAM_EVENTS_CALENDAR_ID } from '@/lib/calendar-constants';
import { countryFlag, STEAM_STORE_REGION_CODES, STEAM_STORE_REGIONS, steamStoreRegionName } from '@/lib/steam/regions';

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
  genres?: string[];
  reviewSummary?: string;
  reviewPercentage?: number;
  reviewCount?: number;
  developers?: string[];
  publishers?: string[];
  releaseDateText?: string | null;
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
  genres?: string[];
  price?: {
    discountPercent: number;
    finalFormatted?: string;
    initialFormatted?: string;
  };
  reviewCount?: number;
  reviewPercentage?: number;
  reviewSummary?: string;
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
const AUTO_TRACKED_GAME_COUNT = 3;
const MAX_EVENT_LANES = 12;
const EVENT_PAST_DAYS_MAX = 180;
const EVENT_FUTURE_DAYS_MAX = 365;
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
      title: 'Publisher & franchise sales',
      description: 'Limited-time sales organized around a publisher, franchise, or partner.',
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
      title: '发行商与系列促销',
      description: '围绕发行商、系列作品或合作伙伴组织的限时促销。',
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
    calendarSources: 'Calendar sources',
    hotDealsTitle: 'Tracked Game Deals',
    hotDealsDescription: 'Top sellers that are currently discounted or available to preorder.',
    itemsLabel: 'Items',
    steamEventsTitle: 'Steam Fests & Events',
    steamEventsDescription: 'Official Steam sale events, Next Fest, themed fests, and public sale pages.',
    eventTypesTitle: 'Event types',
    eventTypesNone: 'No event types selected',
    pastDays: 'Past days',
    nextDays: 'Next days',
    myGamesTitle: 'My Games',
    myGamesDescription: 'Watch specific games, then connect a public Steam wishlist when you want it to replace manual picks.',
    languageLabel: 'Language',
    settingsLabel: 'Settings',
    storeRegionLabel: 'Store region',
    storeNote: 'Store region affects prices, not language.',
    searchPlaceholder: 'Search Steam games, appID, or store URL',
    searchButton: 'Search',
    searchingButton: 'Searching...',
    searchResultsTitle: 'Steam search results',
    searchResultsCount: 'results',
    noSearchResults: 'No Steam games found',
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
    importWishlistShort: 'Import wishlist',
    importingWishlist: 'Reading your public Steam wishlist and preparing calendar events. This can take a moment for larger wishlists.',
    wishlistHint: 'Connecting a public wishlist replaces manual picks and keeps future releases synced in this calendar.',
    today: 'Today',
    month: 'Month',
    list: 'List',
    syncingCalendar: 'Syncing Steam calendar data...',
    noCalendarEvents: 'No calendar events',
    noCalendarEventsDescription: 'Add or enable calendar items from the left panel to preview them here.',
    watchedGamePending: 'We will keep watching this game. If Steam returns a discount or release event, it will appear on the calendar.',
    dealsLegend: 'Deals',
    preordersLegend: 'Preorders',
    eventsLegend: 'Fests / Events',
    salesLegend: 'Sales',
    noEventsVisible: 'No events visible',
    noEventsVisibleDescription: 'Add or enable items from the left panel to see event details.',
    steamCliEventData: 'Steam CLI event data',
    until: 'Until',
    dealEndsAt: 'Deal ends',
    developerLabel: 'Developer',
    genreLabel: 'Type',
    publisherLabel: 'Publisher',
    ratingLabel: 'Reviews',
    releaseDateLabel: 'Release',
    viewOnSteam: 'View on Steam',
    footerNotice: 'Steam Sale Calendar is not affiliated with Valve Corp.',
    footerHowItWorks: 'How it works',
    footerPrivacy: 'Privacy',
    footerChangelog: 'Changelog',
  },
  zh: {
    addApple: '添加到 Apple 日历',
    addToCalendar: '添加到系统日历',
    calendarSources: '日历来源',
    hotDealsTitle: '关注游戏折扣',
    hotDealsDescription: '当前正在打折或可预购的热门 Steam 游戏。',
    itemsLabel: '数量',
    steamEventsTitle: 'Steam 节日与活动',
    steamEventsDescription: 'Steam 官方促销、新品节、主题游戏节和发行商/系列促销。',
    eventTypesTitle: '活动类型',
    eventTypesNone: '未选择活动类型',
    pastDays: '过去天数',
    nextDays: '未来天数',
    myGamesTitle: '我的游戏',
    myGamesDescription: '关注指定游戏；之后也可以关联公开 Steam 愿望单来替代手动选择。',
    languageLabel: '语言',
    settingsLabel: '设置',
    storeRegionLabel: '商店地区',
    storeNote: '商店地区影响价格，不影响界面语言。',
    searchPlaceholder: '关键字或粘贴链接',
    searchButton: '搜索',
    searchingButton: '搜索中...',
    searchResultsTitle: 'Steam 搜索结果',
    searchResultsCount: '个结果',
    noSearchResults: '没有找到 Steam 游戏',
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
    importWishlistShort: '导入愿望单',
    importingWishlist: '正在读取你的公开 Steam 愿望单并准备日历事件。愿望单较大时可能需要一点时间。',
    wishlistHint: '关联公开愿望单后会替代手动选择，并让未来发售事件持续同步到这个日历。',
    today: '今天',
    month: '月',
    list: '列表',
    syncingCalendar: '正在同步 Steam 日历数据...',
    noCalendarEvents: '暂无日历事件',
    noCalendarEventsDescription: '从左侧添加或开启要显示的内容后，就可以在这里预览。',
    watchedGamePending: '我们会持续追踪这个游戏；如果 Steam 返回促销或发售活动，就会显示在日历里。',
    dealsLegend: '折扣',
    preordersLegend: '预购',
    eventsLegend: '活动',
    salesLegend: '促销',
    noEventsVisible: '暂无可见事件',
    noEventsVisibleDescription: '从左侧添加或开启内容后，就会在这里显示详情。',
    steamCliEventData: 'Steam CLI 活动数据',
    until: '至',
    dealEndsAt: '优惠至',
    developerLabel: '开发商',
    genreLabel: '类型',
    publisherLabel: '发行商',
    ratingLabel: '好评率',
    releaseDateLabel: '发售日',
    viewOnSteam: '在 Steam 查看',
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
  const [showSteamEvents, setShowSteamEvents] = useState(true);
  const [showMyGames, setShowMyGames] = useState(true);
  const [steamEventCategories, setSteamEventCategories] = useState<SteamEventCategory[]>(DEFAULT_CALENDAR_CONFIG.steamEventCategories);
  const [isSteamEventOptionsOpen, setIsSteamEventOptionsOpen] = useState(false);
  const [eventPastDays, setEventPastDays] = useState(DEFAULT_CALENDAR_CONFIG.eventPastDays);
  const [eventFutureDays, setEventFutureDays] = useState(DEFAULT_CALENDAR_CONFIG.eventFutureDays);
  const [gameSearch, setGameSearch] = useState('');
  const [gameSearchResults, setGameSearchResults] = useState<GameSearchResult[]>([]);
  const [gameSearchError, setGameSearchError] = useState<string | null>(null);
  const [lastGameSearchQuery, setLastGameSearchQuery] = useState('');
  const [isSearchingGames, setIsSearchingGames] = useState(false);
  const [selectedGames, setSelectedGames] = useState<SelectedGame[]>([]);
  const [recentlyAddedAppId, setRecentlyAddedAppId] = useState<string | null>(null);
  const [selectedGameNoticeAppId, setSelectedGameNoticeAppId] = useState<string | null>(null);
  const [storeRegion, setStoreRegion] = useState<string | null>(null);
  const [detectedStoreRegion, setDetectedStoreRegion] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [searchPreview, setSearchPreview] = useState<{
    game: GameSearchResult;
    left: number;
    top: number;
  } | null>(null);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('en');
  const [selectedLanguageCode, setSelectedLanguageCode] = useState('en');
  const [hasInitializedClientLocale, setHasInitializedClientLocale] = useState(false);
  const [shouldSendDetectedStoreRegion, setShouldSendDetectedStoreRegion] = useState(false);
  const [todayIso, setTodayIso] = useState(() => localIsoDate());
  const [origin, setOrigin] = useState('');
  const userSelectedRegionRef = useRef(false);
  const hasSeededDefaultGamesRef = useRef(false);
  const selectedLanguage = languageOptionByCode(selectedLanguageCode);
  const copy = UI_COPY[uiLanguage];
  const effectiveStoreRegion = storeRegion ?? preview.locale?.cc ?? detectedStoreRegion ?? 'US';
  const effectiveStoreRegionLabel = `${countryFlag(effectiveStoreRegion)} ${steamStoreRegionName(effectiveStoreRegion)}`;
  const shouldShowResolvedStoreRegion = hasInitializedClientLocale || Boolean(storeRegion ?? preview.locale?.cc ?? detectedStoreRegion);
  const effectiveSteamLang = selectedLanguage.steamLang;
  const effectiveUiLang = selectedLanguage.uiLang;
  const hasConnectedWishlist = preview.steamId64 !== STEAM_EVENTS_CALENDAR_ID;
  const watchedAppIds = useMemo(() => (
    showMyGames && !hasConnectedWishlist ? selectedGames.map((game) => game.appId) : []
  ), [hasConnectedWishlist, selectedGames, showMyGames]);
  const shouldLoadDefaultDeals = showMyGames && !hasConnectedWishlist && !selectedGames.length && !hasSeededDefaultGamesRef.current;
  const calendarConfig = useMemo<CalendarConfig>(() => ({
    includeDeals: shouldLoadDefaultDeals,
    includeSteamEvents: showSteamEvents,
    includeWishlist: showMyGames,
    watchedAppIds,
    steamEventCategories,
    dealCount: AUTO_TRACKED_GAME_COUNT,
    eventPastDays,
    eventFutureDays,
  }), [eventFutureDays, eventPastDays, shouldLoadDefaultDeals, showMyGames, showSteamEvents, steamEventCategories, watchedAppIds]);

  const publicPreviewQuery = useMemo(() => {
    const params = calendarConfigToSearchParams(calendarConfig);

    if (storeRegion || shouldSendDetectedStoreRegion) {
      params.set('cc', effectiveStoreRegion);
    }
    params.set('lang', effectiveSteamLang);
    params.set('uiLang', effectiveUiLang);

    return params.toString();
  }, [calendarConfig, effectiveSteamLang, effectiveStoreRegion, effectiveUiLang, shouldSendDetectedStoreRegion, storeRegion]);

  const calendarQuery = useMemo(() => {
    const params = calendarConfigToSearchParams(calendarConfig);

    params.set('cc', effectiveStoreRegion);
    params.set('lang', effectiveSteamLang);
    params.set('uiLang', effectiveUiLang);

    return params.toString();
  }, [calendarConfig, effectiveSteamLang, effectiveStoreRegion, effectiveUiLang]);

  const webcalUrl = useMemo(() => {
    const calendarUrl = origin
      ? `${origin}${preview.calendarPath}?${calendarQuery}`
      : `${preview.calendarPath}?${calendarQuery}`;

    return calendarUrl.replace(/^https?:\/\//, 'webcal://');
  }, [calendarQuery, origin, preview]);

  const calendarEvents = preview.events;

  const sortedEvents = useMemo(() => {
    return [...calendarEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [calendarEvents]);
  const visibleEvents = useMemo(() => {
    return sortedEvents.filter((event) => {
      if (event.type === 'steam_deal' || event.type === 'steam_preorder') {
        return showMyGames;
      }

      if (event.type === 'steam_major_event') {
        return showSteamEvents && (!event.eventCategory || steamEventCategories.includes(event.eventCategory));
      }

      return showMyGames;
    });
  }, [showMyGames, showSteamEvents, sortedEvents, steamEventCategories]);

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
    setShouldSendDetectedStoreRegion(shouldSendClientStoreRegion(window.location.hostname));
    const browserLanguage = languageCodeFromBrowser(navigator.language);
    const browserStoreRegion = storeRegionFromBrowser();

    if (browserStoreRegion) {
      setDetectedStoreRegion(browserStoreRegion);
    }
    setSelectedLanguageCode(browserLanguage.code);
    setUiLanguage(browserLanguage.uiLanguage);
    const browserTodayIso = localIsoDate();

    setTodayIso(browserTodayIso);
    setHasInitializedClientLocale(true);
  }, []);

  useEffect(() => {
    if (
      hasSeededDefaultGamesRef.current ||
      hasConnectedWishlist ||
      !showMyGames ||
      selectedGames.length ||
      preview.steamId64 !== STEAM_EVENTS_CALENDAR_ID ||
      !preview.events.length
    ) {
      return;
    }

    const defaultGames = preview.events
      .filter((event) => (event.type === 'steam_deal' || event.type === 'steam_preorder') && event.appId)
      .slice(0, AUTO_TRACKED_GAME_COUNT)
      .map((event) => ({
        appId: event.appId as string,
        name: detailTitle(event),
        ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
        storeUrl: event.sourceUrl ?? `https://store.steampowered.com/app/${event.appId}/`,
      }));

    if (!defaultGames.length) {
      return;
    }

    hasSeededDefaultGamesRef.current = true;
    setSelectedGames(defaultGames);
  }, [hasConnectedWishlist, preview, selectedGames.length, showMyGames]);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicPreview() {
      if (!hasInitializedClientLocale) {
        return;
      }

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

          if (!userSelectedRegionRef.current && payload.locale?.cc) {
            setDetectedStoreRegion(payload.locale.cc);
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
  }, [hasInitializedClientLocale, publicPreviewQuery]);

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

  function handleSearchResultPreview(game: GameSearchResult, element: HTMLElement) {
    if (window.matchMedia('(max-width: 700px)').matches) {
      setSearchPreview(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const cardWidth = 280;
    const cardHeight = 246;
    const left = Math.min(rect.right + 10, window.innerWidth - cardWidth - 12);
    const top = Math.min(Math.max(rect.top, 12), window.innerHeight - cardHeight - 12);

    setSearchPreview({ game, left, top });
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
    setSelectedGameNoticeAppId((currentAppId) => (currentAppId === appId ? null : currentAppId));
  }

  function handleSelectedGameClick(appId: string) {
    setShowMyGames(true);
    const matchingEvent = sortedEvents.find((event) => event.appId === appId);

    if (matchingEvent) {
      setSelectedGameNoticeAppId(null);
      handleCalendarEventSelect(matchingEvent.id);
      return;
    }

    setSelectedGameNoticeAppId(appId);
    setIsMobileSettingsOpen(false);
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
            <div className="localeControls">
              <div className="storeRegionControl" data-tooltip={copy.storeNote}>
                <span className="storeRegionIcon" aria-hidden="true">🛒</span>
                <label className="regionSelect">
                  <span className="selectDisplay">
                    <span className="selectDisplayText">
                      {shouldShowResolvedStoreRegion ? effectiveStoreRegionLabel : '...'}
                    </span>
                  </span>
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
              </div>
              <label className="languageSelect" title={selectedLanguage.label}>
                <span className="languageIconOnly" aria-hidden="true">
                  <LanguageIcon />
                </span>
                <select
                  aria-label={copy.languageLabel}
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
            </div>
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
          <aside
            className={[
              'configPanel',
              isMobileSettingsOpen ? 'isMobileOpen' : '',
            ].filter(Boolean).join(' ')}
            aria-label="Calendar configuration"
          >
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

            </div>

            <div className="panelHeader">
              <h2>{copy.calendarSources}</h2>
            </div>

            {publicPreviewError ? (
              <div className="notice error">{copy.wishlistGenericHint}</div>
            ) : null}

            <SourceToggle
              checked={showSteamEvents}
              title={copy.steamEventsTitle}
              controlsId="steam-event-options"
              isExpanded={isSteamEventOptionsOpen}
              onChange={setShowSteamEvents}
              onToggleOptions={() => setIsSteamEventOptionsOpen((isOpen) => !isOpen)}
            >
              {isSteamEventOptionsOpen ? (
                <div className="eventOptionsPanel" id="steam-event-options">
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
                    <label className="rangeControl">
                      <span className="rangeControlHeader">
                        <span>{copy.pastDays}</span>
                        <output>{eventPastDays}</output>
                      </span>
                      <input
                        aria-label={copy.pastDays}
                        type="range"
                        min="0"
                        max={EVENT_PAST_DAYS_MAX}
                        step="1"
                        value={eventPastDays}
                        onChange={(event) => setEventPastDays(clampInteger(event.target.value, 0, EVENT_PAST_DAYS_MAX, DEFAULT_CALENDAR_CONFIG.eventPastDays))}
                      />
                    </label>
                    <label className="rangeControl">
                      <span className="rangeControlHeader">
                        <span>{copy.nextDays}</span>
                        <output>{eventFutureDays}</output>
                      </span>
                      <input
                        aria-label={copy.nextDays}
                        type="range"
                        min="1"
                        max={EVENT_FUTURE_DAYS_MAX}
                        step="1"
                        value={eventFutureDays}
                        onChange={(event) => setEventFutureDays(clampInteger(event.target.value, 1, EVENT_FUTURE_DAYS_MAX, DEFAULT_CALENDAR_CONFIG.eventFutureDays))}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </SourceToggle>

            <div className="panelDivider" />

            <div className="myGamesBlock">
              <div className="sourceTitleRow">
                <div>
                  <h3>{copy.myGamesTitle}</h3>
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
                      <button
                        aria-label={isSelected ? `${game.name}, ${copy.added}` : game.name}
                        className={isSelected ? 'gameSearchResult isSelected' : 'gameSearchResult'}
                        disabled={hasConnectedWishlist || isSelected}
                        key={game.appId}
                        type="button"
                        onBlur={() => setSearchPreview(null)}
                        onFocus={(event) => handleSearchResultPreview(game, event.currentTarget)}
                        onMouseEnter={(event) => handleSearchResultPreview(game, event.currentTarget)}
                        onMouseLeave={() => setSearchPreview(null)}
                        onClick={() => handleAddSelectedGame(game)}
                      >
                        <SteamCliImage fallbackClassName="gameThumbFallback" src={game.imageUrl} />
                        <div className="gameSearchResultInfo">
                          <strong>{game.name}</strong>
                          <SearchResultPrice game={game} copy={copy} />
                        </div>
                      </button>
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

              {selectedGames.length ? (
                <div className="selectedGames" aria-label="Games added to calendar">
                  <div className="selectedGamesHeader">
                    <span className="miniSectionTitle">{copy.addedToCalendar}</span>
                    <span>{selectedGames.length}</span>
                  </div>
                  {selectedGames.map((game) => (
                    <div
                      className={game.appId === recentlyAddedAppId ? 'selectedGameRow isNewlyAdded' : 'selectedGameRow'}
                      key={game.appId}
                    >
                      <button
                        className="selectedGameSelect"
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectedGameClick(game.appId)}
                      >
                        <SteamCliImage fallbackClassName="gameThumbFallback" src={game.imageUrl} />
                        <span>{game.name}</span>
                      </button>
                      <button
                        aria-label={`${copy.remove} ${game.name}`}
                        className="selectedGameRemove"
                        type="button"
                        onClick={() => handleRemoveSelectedGame(game.appId)}
                      >
                        {copy.remove}
                      </button>
                      {selectedGameNoticeAppId === game.appId ? (
                        <div className="selectedGameNotice" role="status">
                          {copy.watchedGamePending}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <details className="wishlistImportDetails" id="steam-connect" open={Boolean(error) || isLoading}>
                <summary>
                  <LinkIcon />
                  <span>{copy.importWishlistShort}</span>
                </summary>

                <form
                  className="wishlistImport"
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
              </details>
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
              webcalUrl={webcalUrl}
            />
          </div>

          <EventDetails
            event={selectedEvent}
            copy={copy}
            isMobileOpen={isMobileDetailOpen}
            onCloseMobile={() => setIsMobileDetailOpen(false)}
            uiLanguage={uiLanguage}
          />
          <GameSearchPreviewCard
            copy={copy}
            preview={searchPreview}
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
  webcalUrl,
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
  webcalUrl: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const weekRefs = useRef(new Map<string, HTMLElement>());
  const initialMonth = monthKeyFromIsoDate(initialFocusDate);
  const initialWeekStart = useMemo(() => weekStartForDate(initialFocusDate), [initialFocusDate]);
  const todayWeekStart = useMemo(() => weekStartForDate(todayIso), [todayIso]);
  const weekRange = useMemo(() => buildEventWeekRange(events, todayIso), [events, todayIso]);
  const weeks = useMemo(() => buildContinuousCalendarWeeks(events, weekRange.startIso, weekRange.endIso), [events, weekRange]);
  const listEvents = useMemo(() => [...events].sort(compareEventsForList), [events]);
  const legendItems = useMemo(() => calendarLegendItems(events, uiCopy), [events, uiCopy]);
  const shouldAlignInitialWeek = useRef(true);
  const pendingWeekScroll = useRef<string | null>(null);
  const lastAlignedFocusDate = useRef<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const canScrollToToday = todayWeekStart >= weekRange.startIso && todayWeekStart < weekRange.endIso;
  const calendarAppClassName = [
    'calendarApp',
    calendarView === 'list' ? 'isListView' : '',
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (window.matchMedia('(max-width: 700px)').matches) {
      setCalendarView('list');
    }
  }, []);

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
    <section className={calendarAppClassName} aria-label="Calendar preview">
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
            {events.length ? (
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
            ) : !isLoading ? (
              <div className="emptyEventList emptyCalendarState">
                <h3>{uiCopy.noCalendarEvents}</h3>
                <p>{uiCopy.noCalendarEventsDescription}</p>
              </div>
            ) : null}
          </div>

          <CalendarFooter addToCalendarLabel={uiCopy.addToCalendar} legendItems={legendItems} webcalUrl={webcalUrl} />
        </>
      ) : (
        <>
          <div className="eventListScroll" aria-label="Calendar event list">
            {isLoading ? (
              <div className="calendarLoadingOverlay" role="status">
                <span className="loadingSpinner" />
                <span>{uiCopy.syncingCalendar}</span>
              </div>
            ) : null}
            {listEvents.length ? (
              <div className="eventList">
                {listEvents.map((event) => {
                  const shouldShowEventImage = hasGameEventImage(event);

                  return (
                    <button
                      className={[
                        'eventListItem',
                        eventVisualClass(event),
                        shouldShowEventImage ? '' : 'noEventImage',
                        event.id === selectedEventId ? 'isSelected' : '',
                        event.appId && event.appId === recentlyAddedAppId ? 'isNewCalendarItem' : '',
                      ].filter(Boolean).join(' ')}
                      data-testid="calendar-event-list-item"
                      key={event.id}
                      onClick={() => onSelectEvent(event.id)}
                      type="button"
                    >
                      <span className="eventListMarker" aria-hidden="true" />
                      {shouldShowEventImage ? (
                        <SteamCliImage fallbackClassName="eventListThumbFallback" src={event.imageUrl} />
                      ) : null}
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
                  );
                })}
              </div>
            ) : (
              <div className="emptyEventList">
                <h3>{uiCopy.noCalendarEvents}</h3>
                <p>{uiCopy.noCalendarEventsDescription}</p>
              </div>
            )}
          </div>
          <CalendarFooter addToCalendarLabel={uiCopy.addToCalendar} legendItems={legendItems} webcalUrl={webcalUrl} />
        </>
      )}
    </section>
  );
}

function CalendarFooter({
  addToCalendarLabel,
  legendItems,
  webcalUrl,
}: {
  addToCalendarLabel: string;
  legendItems: ReturnType<typeof calendarLegendItems>;
  webcalUrl: string;
}) {
  return (
    <div className="calendarFooter">
      <div className="calendarLegend" aria-label="Calendar legend">
        {legendItems.map((item) => (
          <span key={item.className}>
            <i className={`legendDot ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>
      <a className="calendarFooterCta" href={webcalUrl}>
        <CalendarListIcon />
        {addToCalendarLabel}
      </a>
    </div>
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

function isGameCalendarEvent(event: PreviewEvent) {
  return event.type === 'steam_deal' || event.type === 'steam_preorder' || event.type === 'wishlist_release';
}

function hasGameEventImage(event: PreviewEvent) {
  return Boolean(isGameCalendarEvent(event) && event.imageUrl);
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
  children,
  checked,
  controlsId,
  description,
  isExpanded,
  onChange,
  onToggleOptions,
  title,
}: {
  children?: ReactNode;
  controlsId?: string;
  checked: boolean;
  description?: string;
  isExpanded?: boolean;
  onChange: (checked: boolean) => void;
  onToggleOptions?: () => void;
  title: string;
}) {
  return (
    <div className="sourceCard">
      <div className="sourceTitleRow">
        {onToggleOptions ? (
          <button
            aria-controls={controlsId}
            aria-expanded={isExpanded}
            className="sourceDisclosureButton"
            type="button"
            onClick={onToggleOptions}
          >
            <h3>{title}</h3>
            <i aria-hidden="true" className="disclosureArrow" />
          </button>
        ) : (
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
        )}
        <label className="switch">
          <input
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            type="checkbox"
          />
          <span />
        </label>
      </div>
      {children}
    </div>
  );
}

function EventDetails({
  copy,
  event,
  isMobileOpen,
  onCloseMobile,
  uiLanguage,
}: {
  copy: typeof UI_COPY[UiLanguage];
  event: PreviewEvent | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
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

  const shouldShowDetailHero = hasGameEventImage(event);
  const heroStyle = shouldShowDetailHero ? {
    backgroundImage: `linear-gradient(180deg, rgba(5, 9, 15, 0.02), rgba(5, 9, 15, 0.18)), url("${event.imageUrl}")`,
  } as CSSProperties : undefined;
  const steamStoreUrl = steamStoreUrlForEvent(event);

  return (
    <aside
      className={[
        'detailPanel',
        shouldShowDetailHero ? '' : 'noDetailHero',
        isMobileOpen ? 'isMobileOpen' : '',
      ].filter(Boolean).join(' ')}
      aria-label="Selected event details"
    >
      <div className="mobileDetailHeader">
        <h2>{copy.steamEventsTitle}</h2>
        <button aria-label="Close details" type="button" onClick={onCloseMobile}>×</button>
      </div>
      <div className="detailTitleBlock">
        <span>{detailKind(event, copy)}</span>
        <h2>{detailTitle(event)}</h2>
      </div>
      {shouldShowDetailHero ? (
        <div className="detailHero gameHero hasSteamCliImage" style={heroStyle} />
      ) : null}

      <div className="detailBody">
        <div className={event.type === 'steam_deal' ? 'detailMeta detailMetaCallout' : 'detailMeta'}>
          <span>{formatDetailDateSentence(event, copy, uiLanguage)}</span>
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

        <DetailFacts copy={copy} event={event} />

        {steamStoreUrl ? (
          <div className="detailActions">
            <a className="secondaryAction" href={steamStoreUrl} rel="noreferrer" target="_blank">
              <ExternalLinkIcon />
              {copy.viewOnSteam}
            </a>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function DetailFacts({
  copy,
  event,
}: {
  copy: typeof UI_COPY[UiLanguage];
  event: PreviewEvent;
}) {
  const facts = detailFacts(event, copy);

  if (!facts.length) {
    return null;
  }

  return (
    <dl className="detailFacts">
      {facts.map((fact) => (
        <div className="detailFact" key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GameSearchPreviewCard({
  copy,
  preview,
}: {
  copy: typeof UI_COPY[UiLanguage];
  preview: { game: GameSearchResult; left: number; top: number } | null;
}) {
  if (!preview) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="gameSearchPreview"
      style={{ left: preview.left, top: preview.top }}
    >
      <span className="gameSearchPreviewMedia">
        <SteamCliImage fallbackClassName="gameSearchPreviewFallback" src={preview.game.imageUrl} />
      </span>
      <span className="gameSearchPreviewBody">
        <strong>{preview.game.name}</strong>
        <SearchResultPrice game={preview.game} copy={copy} />
        <SearchPreviewFacts copy={copy} game={preview.game} />
      </span>
    </div>
  );
}

function SearchPreviewFacts({
  copy,
  game,
}: {
  copy: typeof UI_COPY[UiLanguage];
  game: GameSearchResult;
}) {
  const facts: Array<{ label: string; value: string }> = [];
  const genres = (game.genres ?? []).filter(Boolean).slice(0, 2);
  if (genres.length) {
    facts.push({ label: copy.genreLabel, value: genres.join(' / ') });
  }

  const rating = formatSearchReviewFact(game);
  if (rating) {
    facts.push({ label: copy.ratingLabel, value: rating });
  }

  if (!facts.length) {
    return null;
  }

  return (
    <span className="gameSearchPreviewFacts">
      {facts.map((fact) => (
        <span className="gameSearchPreviewFact" key={fact.label}>
          <span>{fact.label}</span>
          <strong>{fact.value}</strong>
        </span>
      ))}
    </span>
  );
}

function steamStoreUrlForEvent(event: PreviewEvent): string | null {
  if (!isGameCalendarEvent(event)) {
    return null;
  }

  if (event.appId && /^\d{1,10}$/.test(event.appId)) {
    return `https://store.steampowered.com/app/${event.appId}/`;
  }

  if (event.sourceUrl?.startsWith('https://store.steampowered.com/app/')) {
    return event.sourceUrl;
  }

  return null;
}

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" className="toolbarSvg" viewBox="0 0 20 20">
      <path d="M8.2 5.2H5.4a2.2 2.2 0 0 0-2.2 2.2v7.2a2.2 2.2 0 0 0 2.2 2.2h7.2a2.2 2.2 0 0 0 2.2-2.2v-2.8" />
      <path d="M11.2 3.2h5.6v5.6" />
      <path d="m9.6 10.4 7-7" />
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

function LanguageIcon() {
  return (
    <svg aria-hidden="true" className="miniIcon" viewBox="0 0 20 20">
      <path d="M3 4.5h8.2" />
      <path d="M7.1 3v1.5" />
      <path d="M5 7.1c.8 2.1 2.5 3.8 5.1 5" />
      <path d="M10.5 4.5c-.5 3.6-2.5 6.1-6.2 7.8" />
      <path d="M12.7 16.8 16 7.6l3.2 9.2" />
      <path d="M13.7 14h4.5" />
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

function storeRegionFromBrowser(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const timeZoneRegion = storeRegionFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

  if (timeZoneRegion) {
    return timeZoneRegion;
  }

  return storeRegionFromLanguages(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

function storeRegionFromTimeZone(timeZone?: string): string | null {
  if (!timeZone) {
    return null;
  }

  const timeZoneToRegion: Record<string, string> = {
    'Asia/Shanghai': 'CN',
    'Asia/Hong_Kong': 'HK',
    'Asia/Taipei': 'TW',
    'Asia/Tokyo': 'JP',
    'Asia/Seoul': 'KR',
    'Asia/Singapore': 'SG',
    'Asia/Bangkok': 'TH',
    'Asia/Ho_Chi_Minh': 'VN',
    'Asia/Jakarta': 'ID',
    'Asia/Kuala_Lumpur': 'MY',
    'Asia/Manila': 'PH',
    'Asia/Kolkata': 'IN',
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Brisbane': 'AU',
    'Australia/Perth': 'AU',
    'Pacific/Auckland': 'NZ',
    'Europe/London': 'GB',
    'Europe/Berlin': 'DE',
    'Europe/Paris': 'FR',
    'Europe/Rome': 'IT',
    'Europe/Madrid': 'ES',
    'Europe/Amsterdam': 'NL',
    'Europe/Brussels': 'BE',
    'Europe/Vienna': 'AT',
    'Europe/Zurich': 'CH',
    'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO',
    'Europe/Copenhagen': 'DK',
    'Europe/Helsinki': 'FI',
    'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ',
    'Europe/Budapest': 'HU',
    'Europe/Bucharest': 'RO',
    'Europe/Istanbul': 'TR',
    'Europe/Kyiv': 'UA',
    'America/Sao_Paulo': 'BR',
    'America/Mexico_City': 'MX',
    'America/Argentina/Buenos_Aires': 'AR',
    'America/Santiago': 'CL',
    'America/Bogota': 'CO',
    'America/Lima': 'PE',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Montreal': 'CA',
    'Africa/Johannesburg': 'ZA',
    'Asia/Riyadh': 'SA',
    'Asia/Dubai': 'AE',
  };

  if (timeZoneToRegion[timeZone]) {
    return normalizeBrowserStoreRegion(timeZoneToRegion[timeZone]);
  }

  if (timeZone.startsWith('America/')) {
    return 'US';
  }

  return null;
}

function storeRegionFromLanguages(languages: readonly string[]): string | null {
  for (const language of languages) {
    const regionMatch = language.match(/[-_]([a-z]{2})\b/i);
    const explicitRegion = normalizeBrowserStoreRegion(regionMatch?.[1]);

    if (explicitRegion) {
      return explicitRegion;
    }

    const lower = language.toLowerCase();

    if (lower.startsWith('zh-hk')) {
      return 'HK';
    }

    if (lower.startsWith('zh-tw') || lower.startsWith('zh-hant')) {
      return 'TW';
    }

    if (lower.startsWith('zh')) {
      return 'CN';
    }

    if (lower.startsWith('ja')) {
      return 'JP';
    }

    if (lower.startsWith('ko')) {
      return 'KR';
    }
  }

  return null;
}

function normalizeBrowserStoreRegion(region?: string): string | null {
  if (!region) {
    return null;
  }

  const upperRegion = region.toUpperCase();

  return STEAM_STORE_REGION_CODES.has(upperRegion) ? upperRegion : null;
}

function shouldSendClientStoreRegion(hostname: string): boolean {
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.startsWith('192.168.');
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

function formatDetailDateSentence(
  event: PreviewEvent,
  copy: typeof UI_COPY[UiLanguage],
  uiLanguage: UiLanguage,
): string {
  if (event.type === 'steam_deal' && event.discountEnd) {
    return `${copy.dealEndsAt} ${formatUnixDateTime(event.discountEnd, uiLanguage)}`;
  }

  const startDate = formatDate(event.startDate, uiLanguage);

  if (!event.endDate || event.endDate === event.startDate) {
    return startDate;
  }

  return `${startDate} ${copy.until} ${formatDate(event.endDate, uiLanguage)}`;
}

function formatUnixDateTime(unixSeconds: number, uiLanguage: UiLanguage): string {
  const date = new Date(unixSeconds * 1000);
  const locale = uiLocale(uiLanguage);
  const dateText = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const timeParts = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZoneName: 'short',
  }).formatToParts(date);
  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '00';
  const timeZone = timeParts.find((part) => part.type === 'timeZoneName')?.value;

  return `${dateText} ${hour}:${minute}${timeZone ? ` ${timeZone}` : ''}`;
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
    return 'preorderEvent';
  }

  if (event.type === 'steam_major_event') {
    return 'nextFestEvent';
  }

  return 'nextFestEvent';
}

function calendarLegendItems(
  events: PreviewEvent[],
  copy: typeof UI_COPY[UiLanguage],
): { className: string; label: string }[] {
  const visibleClasses = new Set(events.map(eventVisualClass));
  const hasPreorders = events.some((event) => event.type === 'steam_preorder');
  const hasWishlist = events.some((event) => event.type === 'wishlist_release');
  const preorderLabel = hasPreorders && hasWishlist
    ? `${copy.preordersLegend} / ${copy.myGamesTitle}`
    : hasWishlist
      ? copy.myGamesTitle
      : copy.preordersLegend;
  const items = [
    { className: 'dealEvent', label: copy.dealsLegend },
    { className: 'preorderEvent', label: preorderLabel },
    { className: 'nextFestEvent', label: copy.eventsLegend },
  ];

  return items.filter((item) => visibleClasses.has(item.className));
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
  const description = event.description
    .split('\n')
    .map((line) => line.trim())
    .find((line) => (
      line &&
      !line.startsWith('Price:') &&
      !line.startsWith('Release date:') &&
      !line.startsWith('Steam release date:') &&
      !/^https?:\/\//.test(line)
    ));

  return description || detailTitle(event);
}

function detailFacts(event: PreviewEvent, copy: typeof UI_COPY[UiLanguage]): Array<{ label: string; value: string }> {
  if (!isGameCalendarEvent(event)) {
    return [];
  }

  const facts: Array<{ label: string; value: string }> = [];
  const genres = (event.genres ?? []).filter(Boolean).slice(0, 3);
  if (genres.length) {
    facts.push({ label: copy.genreLabel, value: genres.join(' / ') });
  }

  const rating = formatReviewFact(event);
  if (rating) {
    facts.push({ label: copy.ratingLabel, value: rating });
  }

  const developers = (event.developers ?? []).filter(Boolean).slice(0, 2);
  if (developers.length) {
    facts.push({ label: copy.developerLabel, value: developers.join(' / ') });
  }

  const publishers = (event.publishers ?? []).filter(Boolean).slice(0, 2);
  if (publishers.length) {
    facts.push({ label: copy.publisherLabel, value: publishers.join(' / ') });
  }

  if (event.releaseDateText) {
    facts.push({ label: copy.releaseDateLabel, value: event.releaseDateText });
  }

  return facts.slice(0, 5);
}

function formatReviewFact(event: PreviewEvent): string | null {
  const parts: string[] = [];
  if (event.reviewSummary) {
    parts.push(event.reviewSummary);
  }

  if (typeof event.reviewPercentage === 'number') {
    parts.push(`${event.reviewPercentage}%`);
  }

  if (typeof event.reviewCount === 'number' && event.reviewCount > 0) {
    parts.push(formatCompactCount(event.reviewCount));
  }

  return parts.length ? parts.join(' · ') : null;
}

function formatSearchReviewFact(game: GameSearchResult): string | null {
  const parts: string[] = [];
  if (game.reviewSummary) {
    parts.push(game.reviewSummary);
  }

  if (typeof game.reviewPercentage === 'number') {
    parts.push(`${game.reviewPercentage}%`);
  }

  if (typeof game.reviewCount === 'number' && game.reviewCount > 0) {
    parts.push(formatCompactCount(game.reviewCount));
  }

  return parts.length ? parts.join(' · ') : null;
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
    notation: 'compact',
  }).format(value);
}

function SearchResultPrice({
  copy,
  game,
}: {
  copy: Record<string, string>;
  game: GameSearchResult;
}) {
  if (!game.price) {
    return <span className="searchResultPrice mutedPrice">{copy.priceUnavailable}</span>;
  }

  return (
    <span className="searchResultPrice">
      {game.price.discountPercent > 0 ? <strong>-{game.price.discountPercent}%</strong> : null}
      <span>{game.price.finalFormatted || copy.priceUnavailable}</span>
      {game.price.initialFormatted && game.price.discountPercent > 0 ? <del>{game.price.initialFormatted}</del> : null}
    </span>
  );
}
