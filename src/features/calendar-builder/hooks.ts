"use client";

import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  calendarConfigToSearchParams,
  DEFAULT_CALENDAR_CONFIG,
  type CalendarConfig,
  type SteamEventCategory,
} from "@/domain/calendar/config";
import { STEAM_EVENTS_CALENDAR_ID } from "@/domain/calendar/constants";
import type { PreviewEvent, PreviewResponse } from "@/shared/calendar-preview";
import {
  GAME_SEARCH_COMPLETED_EVENT,
  GAME_SEARCH_FAILED_EVENT,
  GAME_SEARCH_SUBMITTED_EVENT,
  MANUAL_GAME_ADDED_EVENT,
  MANUAL_GAME_REMOVED_EVENT,
  PREVIEW_LOAD_COMPLETED_EVENT,
  PREVIEW_LOAD_FAILED_EVENT,
  PREVIEW_LOAD_STARTED_EVENT,
  SOURCE_MODE_CHANGED_EVENT,
  type GameSearchAnalyticsProperties,
  type GameSearchFailedAnalyticsProperties,
  type GameSearchSubmittedAnalyticsProperties,
  type ManualGameAnalyticsProperties,
  type PreviewLoadAnalyticsProperties,
  type PreviewLoadCompletedAnalyticsProperties,
  type PreviewLoadFailedAnalyticsProperties,
  type SourceModeChangedAnalyticsProperties,
} from "@/shared/observability";
import { fetchPublicPreview, searchCalendarGames } from "./api";
import { analyticsRawInput, trackAnalyticsEvent } from "./analytics";
import {
  languageCodeFromBrowser,
  shouldSendClientStoreRegion,
  storeRegionFromBrowser,
} from "./browser-locale";
import {
  chooseCalendarFocusDate,
  chooseCurrentGameEvent,
  compareSteamEventCategories,
  localIsoDate,
  selectedGameFromEvent,
  selectedGameFromWishlistGame,
  shouldLoadDefaultDealPreview,
} from "./calendar-utils";
import { AUTO_TRACKED_GAME_COUNT, INTRO_STORAGE_KEY } from "./model";
import type { GameSearchResult, SelectedGame } from "./model";
import type { UiLanguage } from "./ui-copy";

const WORKBENCH_LAYOUT_STORAGE_KEY = "steam-to-calendar-workbench-layout";
const WORKBENCH_HANDLE_SPACE = 40;
const WORKBENCH_COLUMN_LIMITS = {
  config: { min: 240, max: 460, step: 24 },
  detail: { min: 260, max: 480, step: 24 },
  calendar: { min: 420 },
} as const;
const WORKBENCH_DEFAULT_RATIOS = {
  config: 0.22,
  detail: 0.24,
} as const;
const WORKBENCH_DEFAULT_COLUMN_LIMITS = {
  config: { min: 280, max: 380 },
  detail: { min: 300, max: 420 },
} as const;

type WorkbenchColumn = "config" | "detail";
type WorkbenchLayout = Record<WorkbenchColumn, number>;
type WorkbenchResizeHandleProps = {
  "aria-label": string;
  "aria-orientation": "vertical";
  "aria-valuemax": number;
  "aria-valuemin": number;
  "aria-valuenow": number;
  className: string;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  role: "separator";
  tabIndex: number;
};

const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayout = {
  config: 320,
  detail: 360,
};

function clampWorkbenchColumn(value: number, column: WorkbenchColumn) {
  const limits = WORKBENCH_COLUMN_LIMITS[column];

  return Math.round(Math.min(Math.max(value, limits.min), limits.max));
}

function clampDefaultWorkbenchColumn(value: number, column: WorkbenchColumn) {
  const limits = WORKBENCH_DEFAULT_COLUMN_LIMITS[column];

  return Math.round(Math.min(Math.max(value, limits.min), limits.max));
}

function readStoredWorkbenchLayout(): WorkbenchLayout | null {
  try {
    const storedValue = window.localStorage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<WorkbenchLayout>;

    if (typeof parsedValue.config !== "number" || typeof parsedValue.detail !== "number") {
      return null;
    }

    return {
      config: clampWorkbenchColumn(parsedValue.config, "config"),
      detail: clampWorkbenchColumn(parsedValue.detail, "detail"),
    };
  } catch {
    return null;
  }
}

function writeStoredWorkbenchLayout(layout: WorkbenchLayout) {
  try {
    window.localStorage.setItem(WORKBENCH_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Persisting the layout is a convenience, so private browsing or quota failures can be ignored.
  }
}

function fitWorkbenchLayoutToWidth(layout: WorkbenchLayout, totalWidth: number): WorkbenchLayout {
  const availableSideWidth =
    totalWidth - WORKBENCH_COLUMN_LIMITS.calendar.min - WORKBENCH_HANDLE_SPACE;

  if (
    availableSideWidth <=
    WORKBENCH_COLUMN_LIMITS.config.min + WORKBENCH_COLUMN_LIMITS.detail.min
  ) {
    return {
      config: WORKBENCH_COLUMN_LIMITS.config.min,
      detail: WORKBENCH_COLUMN_LIMITS.detail.min,
    };
  }

  const config = clampWorkbenchColumn(layout.config, "config");
  const detailMax = Math.min(
    WORKBENCH_COLUMN_LIMITS.detail.max,
    availableSideWidth - WORKBENCH_COLUMN_LIMITS.config.min,
  );
  const detail = Math.round(
    Math.min(Math.max(layout.detail, WORKBENCH_COLUMN_LIMITS.detail.min), detailMax),
  );

  return { config, detail };
}

function computeDefaultWorkbenchLayout(totalWidth: number): WorkbenchLayout {
  if (!totalWidth) {
    return DEFAULT_WORKBENCH_LAYOUT;
  }

  const availableSideWidth =
    totalWidth - WORKBENCH_COLUMN_LIMITS.calendar.min - WORKBENCH_HANDLE_SPACE;

  if (
    availableSideWidth <=
    WORKBENCH_COLUMN_LIMITS.config.min + WORKBENCH_COLUMN_LIMITS.detail.min
  ) {
    return {
      config: WORKBENCH_COLUMN_LIMITS.config.min,
      detail: WORKBENCH_COLUMN_LIMITS.detail.min,
    };
  }

  let config = clampDefaultWorkbenchColumn(totalWidth * WORKBENCH_DEFAULT_RATIOS.config, "config");
  let detail = clampDefaultWorkbenchColumn(totalWidth * WORKBENCH_DEFAULT_RATIOS.detail, "detail");
  let excessSideWidth = config + detail - availableSideWidth;

  if (excessSideWidth <= 0) {
    return { config, detail };
  }

  const detailShrink = Math.min(excessSideWidth, detail - WORKBENCH_COLUMN_LIMITS.detail.min);
  detail -= detailShrink;
  excessSideWidth -= detailShrink;

  if (excessSideWidth > 0) {
    config -= Math.min(excessSideWidth, config - WORKBENCH_COLUMN_LIMITS.config.min);
  }

  return {
    config: Math.round(config),
    detail: Math.round(detail),
  };
}

export function useBrowserDefaults({
  setDetectedStoreRegion,
  setHasInitializedClientLocale,
  openIntro,
  setOrigin,
  setSelectedLanguageCode,
  setShouldSendDetectedStoreRegion,
  setTodayIso,
  setUiLanguage,
}: {
  setDetectedStoreRegion: Dispatch<SetStateAction<string | null>>;
  setHasInitializedClientLocale: Dispatch<SetStateAction<boolean>>;
  openIntro: () => void;
  setOrigin: Dispatch<SetStateAction<string>>;
  setSelectedLanguageCode: Dispatch<SetStateAction<string>>;
  setShouldSendDetectedStoreRegion: Dispatch<SetStateAction<boolean>>;
  setTodayIso: Dispatch<SetStateAction<string>>;
  setUiLanguage: Dispatch<SetStateAction<UiLanguage>>;
}) {
  useEffect(() => {
    // Browser-derived values live in an effect because this file is rendered by Next.js after
    // hydration; accessing window/navigator during render would break server rendering.
    setOrigin(window.location.origin);
    setShouldSendDetectedStoreRegion(shouldSendClientStoreRegion(window.location.hostname));
    try {
      if (window.localStorage.getItem(INTRO_STORAGE_KEY) !== "1") {
        openIntro();
      }
    } catch {
      openIntro();
    }

    const browserLanguage = languageCodeFromBrowser(navigator.language);
    const browserStoreRegion = storeRegionFromBrowser();

    if (browserStoreRegion) {
      setDetectedStoreRegion(browserStoreRegion);
    }

    setSelectedLanguageCode(browserLanguage.code);
    setUiLanguage(browserLanguage.uiLanguage);
    setTodayIso(localIsoDate());
    setHasInitializedClientLocale(true);
  }, [
    setDetectedStoreRegion,
    setHasInitializedClientLocale,
    openIntro,
    setOrigin,
    setSelectedLanguageCode,
    setShouldSendDetectedStoreRegion,
    setTodayIso,
    setUiLanguage,
  ]);
}

export function useSubscriptionUrls({
  calendarConfig,
  effectiveSteamLang,
  effectiveStoreRegion,
  effectiveUiLang,
  origin,
  preview,
}: {
  calendarConfig: CalendarConfig;
  effectiveSteamLang: string;
  effectiveStoreRegion: string;
  effectiveUiLang: string;
  origin: string;
  preview: PreviewResponse;
}): { calendarUrl: string; webcalUrl: string } {
  const calendarQuery = useMemo(() => {
    const params = calendarConfigToSearchParams(calendarConfig);

    params.set("cc", effectiveStoreRegion);
    params.set("lang", effectiveSteamLang);
    params.set("uiLang", effectiveUiLang);

    return params.toString();
  }, [calendarConfig, effectiveSteamLang, effectiveStoreRegion, effectiveUiLang]);

  const calendarUrl = useMemo(() => {
    return origin
      ? `${origin}${preview.calendarPath}?${calendarQuery}`
      : `${preview.calendarPath}?${calendarQuery}`;
  }, [calendarQuery, origin, preview.calendarPath]);

  const webcalUrl = useMemo(() => {
    return calendarUrl.replace(/^https?:\/\//, "webcal://");
  }, [calendarUrl]);

  return { calendarUrl, webcalUrl };
}

export function useCalendarSourceState(): {
  eventFutureDays: number;
  eventPastDays: number;
  handleSteamEventCategoryChange: (category: SteamEventCategory, checked: boolean) => void;
  isSteamEventOptionsOpen: boolean;
  setEventFutureDays: Dispatch<SetStateAction<number>>;
  setEventPastDays: Dispatch<SetStateAction<number>>;
  setIsSteamEventOptionsOpen: Dispatch<SetStateAction<boolean>>;
  setShowMyGames: Dispatch<SetStateAction<boolean>>;
  setShowSteamEvents: Dispatch<SetStateAction<boolean>>;
  showMyGames: boolean;
  showSteamEvents: boolean;
  steamEventCategories: SteamEventCategory[];
} {
  const [showSteamEvents, setShowSteamEvents] = useState(true);
  const [showMyGames, setShowMyGames] = useState(true);
  const [steamEventCategories, setSteamEventCategories] = useState<SteamEventCategory[]>(
    DEFAULT_CALENDAR_CONFIG.steamEventCategories,
  );
  const [isSteamEventOptionsOpen, setIsSteamEventOptionsOpen] = useState(false);
  const [eventPastDays, setEventPastDays] = useState(DEFAULT_CALENDAR_CONFIG.eventPastDays);
  const [eventFutureDays, setEventFutureDays] = useState(DEFAULT_CALENDAR_CONFIG.eventFutureDays);
  const handleSteamEventCategoryChange = useCallback(
    (category: SteamEventCategory, checked: boolean) => {
      setSteamEventCategories((categories) =>
        checked
          ? [...categories, category].sort(compareSteamEventCategories)
          : categories.filter((currentCategory) => currentCategory !== category),
      );
    },
    [],
  );

  return {
    eventFutureDays,
    eventPastDays,
    handleSteamEventCategoryChange,
    isSteamEventOptionsOpen,
    setEventFutureDays,
    setEventPastDays,
    setIsSteamEventOptionsOpen,
    setShowMyGames,
    setShowSteamEvents,
    showMyGames,
    showSteamEvents,
    steamEventCategories,
  };
}

export function useCalendarConfig({
  eventFutureDays,
  eventPastDays,
  hasConnectedWishlist,
  hasEditedSelectedGames,
  selectedGames,
  showMyGames,
  showSteamEvents,
  steamEventCategories,
}: {
  eventFutureDays: number;
  eventPastDays: number;
  hasConnectedWishlist: boolean;
  hasEditedSelectedGames: boolean;
  selectedGames: SelectedGame[];
  showMyGames: boolean;
  showSteamEvents: boolean;
  steamEventCategories: SteamEventCategory[];
}): {
  calendarConfig: CalendarConfig;
  shouldLoadDefaultDeals: boolean;
  watchedAppIds: string[];
} {
  const watchedAppIds = useMemo(
    () => (showMyGames && !hasConnectedWishlist ? selectedGames.map((game) => game.appId) : []),
    [hasConnectedWishlist, selectedGames, showMyGames],
  );
  const shouldLoadDefaultDeals = shouldLoadDefaultDealPreview({
    hasConnectedWishlist,
    hasEditedSelectedGames,
    selectedGameCount: selectedGames.length,
    showMyGames,
  });
  const calendarConfig = useMemo<CalendarConfig>(
    () => ({
      includeDeals: shouldLoadDefaultDeals,
      includePriceHistory: DEFAULT_CALENDAR_CONFIG.includePriceHistory,
      includeSteamEvents: showSteamEvents,
      includeWishlist: showMyGames,
      watchedAppIds,
      steamEventCategories,
      dealCount: AUTO_TRACKED_GAME_COUNT,
      eventPastDays,
      eventFutureDays,
    }),
    [
      eventFutureDays,
      eventPastDays,
      shouldLoadDefaultDeals,
      showMyGames,
      showSteamEvents,
      steamEventCategories,
      watchedAppIds,
    ],
  );

  return {
    calendarConfig,
    shouldLoadDefaultDeals,
    watchedAppIds,
  };
}

export function useResizableWorkbench(): {
  activeResizeHandle: WorkbenchColumn | null;
  configResizeHandleProps: WorkbenchResizeHandleProps;
  detailResizeHandleProps: WorkbenchResizeHandleProps;
  hasRestoredWorkbenchLayout: boolean;
  hasUserResizedWorkbench: boolean;
  workbenchRef: RefObject<HTMLElement | null>;
  workbenchStyle: CSSProperties;
} {
  const workbenchRef = useRef<HTMLElement | null>(null);
  const [layout, setLayout] = useState<WorkbenchLayout>(DEFAULT_WORKBENCH_LAYOUT);
  const [activeResizeHandle, setActiveResizeHandle] = useState<WorkbenchColumn | null>(null);
  const [hasRestoredWorkbenchLayout, setHasRestoredWorkbenchLayout] = useState(false);
  const [hasUserResizedWorkbench, setHasUserResizedWorkbench] = useState(false);

  useLayoutEffect(() => {
    const storedLayout = readStoredWorkbenchLayout();
    const totalWidth = workbenchRef.current?.getBoundingClientRect().width ?? 0;
    const initialLayout = storedLayout
      ? totalWidth
        ? fitWorkbenchLayoutToWidth(storedLayout, totalWidth)
        : storedLayout
      : computeDefaultWorkbenchLayout(totalWidth);

    setLayout(initialLayout);
    setHasRestoredWorkbenchLayout(true);
  }, []);

  const updateLayout = useCallback(
    (updater: (currentLayout: WorkbenchLayout) => WorkbenchLayout) => {
      setHasUserResizedWorkbench(true);
      setLayout((currentLayout) => {
        const totalWidth = workbenchRef.current?.getBoundingClientRect().width ?? 0;
        const nextLayout = totalWidth
          ? fitWorkbenchLayoutToWidth(updater(currentLayout), totalWidth)
          : updater(currentLayout);

        writeStoredWorkbenchLayout(nextLayout);

        return nextLayout;
      });
    },
    [],
  );

  const resizeColumn = useCallback(
    (column: WorkbenchColumn, nextValue: number) => {
      updateLayout((currentLayout) => {
        const totalWidth = workbenchRef.current?.getBoundingClientRect().width ?? 0;
        const otherColumn = column === "config" ? "detail" : "config";
        const availableForColumn = totalWidth
          ? totalWidth -
            currentLayout[otherColumn] -
            WORKBENCH_COLUMN_LIMITS.calendar.min -
            WORKBENCH_HANDLE_SPACE
          : WORKBENCH_COLUMN_LIMITS[column].max;
        const columnMax = Math.min(WORKBENCH_COLUMN_LIMITS[column].max, availableForColumn);

        return {
          ...currentLayout,
          [column]: Math.round(
            Math.min(
              Math.max(nextValue, WORKBENCH_COLUMN_LIMITS[column].min),
              Math.max(WORKBENCH_COLUMN_LIMITS[column].min, columnMax),
            ),
          ),
        };
      });
    },
    [updateLayout],
  );

  const createResizeHandleProps = useCallback(
    (column: WorkbenchColumn) => {
      const limits = WORKBENCH_COLUMN_LIMITS[column];
      const label = column === "config" ? "Resize build panel" : "Resize details panel";

      return {
        "aria-label": label,
        "aria-orientation": "vertical" as const,
        "aria-valuemax": limits.max,
        "aria-valuemin": limits.min,
        "aria-valuenow": layout[column],
        className: [
          "workbenchResizeHandle",
          `workbenchResizeHandle-${column}`,
          activeResizeHandle === column ? "isDragging" : "",
        ]
          .filter(Boolean)
          .join(" "),
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
          }

          event.preventDefault();

          const direction = event.key === "ArrowRight" ? 1 : -1;
          const detailDirection = column === "detail" ? -direction : direction;

          resizeColumn(
            column,
            layout[column] + detailDirection * WORKBENCH_COLUMN_LIMITS[column].step,
          );
        },
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
          if (event.button !== 0) {
            return;
          }

          const workbench = workbenchRef.current;

          if (!workbench) {
            return;
          }

          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setActiveResizeHandle(column);

          const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
            const bounds = workbench.getBoundingClientRect();
            const pointerX = moveEvent.clientX - bounds.left;
            const nextValue = column === "config" ? pointerX : bounds.width - pointerX;

            resizeColumn(column, nextValue);
          };
          const handlePointerUp = () => {
            setActiveResizeHandle(null);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
          };

          window.addEventListener("pointermove", handlePointerMove);
          window.addEventListener("pointerup", handlePointerUp);
          window.addEventListener("pointercancel", handlePointerUp);
        },
        role: "separator" as const,
        tabIndex: 0,
      };
    },
    [activeResizeHandle, layout, resizeColumn],
  );

  const configResizeHandleProps = useMemo(
    () => createResizeHandleProps("config"),
    [createResizeHandleProps],
  );
  const detailResizeHandleProps = useMemo(
    () => createResizeHandleProps("detail"),
    [createResizeHandleProps],
  );

  return {
    activeResizeHandle,
    configResizeHandleProps,
    detailResizeHandleProps,
    hasRestoredWorkbenchLayout,
    workbenchRef,
    workbenchStyle: hasRestoredWorkbenchLayout
      ? ({
          "--config-panel-width": `${layout.config}px`,
          "--detail-panel-width": `${layout.detail}px`,
        } as CSSProperties)
      : {},
    hasUserResizedWorkbench,
  };
}

export function usePublicPreviewLoader({
  calendarConfig,
  effectiveSteamLang,
  effectiveStoreRegion,
  effectiveUiLang,
  hasInitializedClientLocale,
  publicPreviewRef,
  setDetectedStoreRegion,
  setIsPreviewLoading,
  setPreview,
  setPublicPreviewError,
  shouldSendDetectedStoreRegion,
  storeRegion,
  userSelectedRegionRef,
}: {
  calendarConfig: CalendarConfig;
  effectiveSteamLang: string;
  effectiveStoreRegion: string;
  effectiveUiLang: string;
  hasInitializedClientLocale: boolean;
  publicPreviewRef: MutableRefObject<PreviewResponse>;
  setDetectedStoreRegion: Dispatch<SetStateAction<string | null>>;
  setIsPreviewLoading: Dispatch<SetStateAction<boolean>>;
  setPreview: Dispatch<SetStateAction<PreviewResponse>>;
  setPublicPreviewError: Dispatch<SetStateAction<string | null>>;
  shouldSendDetectedStoreRegion: boolean;
  storeRegion: string | null;
  userSelectedRegionRef: MutableRefObject<boolean>;
}) {
  useEffect(() => {
    let isMounted = true;

    async function loadPublicPreview() {
      if (!hasInitializedClientLocale) {
        return;
      }

      setIsPreviewLoading(true);
      const startedAt = performance.now();
      const previewAnalyticsProperties = {
        includeDeals: calendarConfig.includeDeals,
        includePriceHistory: calendarConfig.includePriceHistory,
        includeSteamEvents: calendarConfig.includeSteamEvents,
        locale: effectiveSteamLang,
        region: effectiveStoreRegion,
        route: "/api/public-preview",
        selectedGameCount: calendarConfig.watchedAppIds.length,
      } satisfies PreviewLoadAnalyticsProperties;

      trackAnalyticsEvent(PREVIEW_LOAD_STARTED_EVENT, previewAnalyticsProperties);

      try {
        const payload = await fetchPublicPreview({
          config: calendarConfig,
          locale: {
            cc: effectiveStoreRegion,
            lang: effectiveSteamLang,
            uiLang: effectiveUiLang,
          },
          sendStoreRegion: Boolean(storeRegion || shouldSendDetectedStoreRegion),
        });

        if (isMounted) {
          trackAnalyticsEvent(PREVIEW_LOAD_COMPLETED_EVENT, {
            ...previewAnalyticsProperties,
            durationMs: Math.round(performance.now() - startedAt),
            eventCount: payload.events.length,
            steamMajorEvents: payload.stats.steamMajorEvents,
            watchedGameCount: payload.watchedGames?.length ?? 0,
          } satisfies PreviewLoadCompletedAnalyticsProperties);

          // publicPreviewRef is the clean fallback we restore when a user disconnects a wishlist.
          publicPreviewRef.current = payload;
          setPublicPreviewError(null);
          setPreview((currentPreview) =>
            currentPreview.steamId64 === STEAM_EVENTS_CALENDAR_ID ? payload : currentPreview,
          );

          if (!userSelectedRegionRef.current && payload.locale?.cc) {
            setDetectedStoreRegion(payload.locale.cc);
          }
        }
      } catch (caught) {
        console.error(caught);
        if (isMounted) {
          trackAnalyticsEvent(PREVIEW_LOAD_FAILED_EVENT, {
            ...previewAnalyticsProperties,
            durationMs: Math.round(performance.now() - startedAt),
            errorName: analyticsErrorName(caught),
          } satisfies PreviewLoadFailedAnalyticsProperties);
          setPublicPreviewError(
            caught instanceof Error ? caught.message : "Could not load Steam events.",
          );
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
  }, [
    calendarConfig,
    effectiveSteamLang,
    effectiveStoreRegion,
    effectiveUiLang,
    hasInitializedClientLocale,
    publicPreviewRef,
    setDetectedStoreRegion,
    setIsPreviewLoading,
    setPreview,
    setPublicPreviewError,
    shouldSendDetectedStoreRegion,
    storeRegion,
    userSelectedRegionRef,
  ]);
}

export function useTimedReset<T>(value: T | null, reset: () => void, delayMs: number) {
  useEffect(() => {
    if (!value) {
      return;
    }

    const timeoutId = window.setTimeout(reset, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, reset, value]);
}

export function useGameSearch({
  hasConnectedWishlist,
  locale,
}: {
  hasConnectedWishlist: boolean;
  locale: { cc: string; lang: string; uiLang: string };
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery || hasConnectedWishlist) {
      // Manual picks and wishlist import are mutually exclusive product modes.
      return;
    }

    setIsSearching(true);
    setError(null);
    trackAnalyticsEvent(GAME_SEARCH_SUBMITTED_EVENT, {
      queryLength: trimmedQuery.length,
      ...analyticsRawInput({ rawQuery: trimmedQuery }),
      region: locale.cc,
    } satisfies GameSearchSubmittedAnalyticsProperties);

    try {
      const nextResults = await searchCalendarGames({ locale, query: trimmedQuery });

      setLastQuery(trimmedQuery);
      setResults(nextResults);
      trackAnalyticsEvent(GAME_SEARCH_COMPLETED_EVENT, {
        queryLength: trimmedQuery.length,
        ...analyticsRawInput({ rawQuery: trimmedQuery }),
        region: locale.cc,
        resultCount: nextResults.length,
      } satisfies GameSearchAnalyticsProperties);
    } catch (caught) {
      setLastQuery(trimmedQuery);
      trackAnalyticsEvent(GAME_SEARCH_FAILED_EVENT, {
        errorName: analyticsErrorName(caught),
        queryLength: trimmedQuery.length,
        ...analyticsRawInput({ rawQuery: trimmedQuery }),
        region: locale.cc,
      } satisfies GameSearchFailedAnalyticsProperties);
      setError(caught instanceof Error ? caught.message : "Could not search Steam games.");
    } finally {
      setIsSearching(false);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);

    if (!value.trim()) {
      clearResults();
    }
  }

  function clearResults() {
    setResults([]);
    setError(null);
    setLastQuery("");
  }

  return {
    clearResults,
    error,
    handleQueryChange,
    handleSubmit,
    isSearching,
    lastQuery,
    query,
    results,
  };
}

export function useCalendarSelection({
  onOpenMobileDetails,
  onSelectFromGames,
  todayIso,
  visibleEvents,
}: {
  onOpenMobileDetails: () => void;
  onSelectFromGames?: () => void;
  todayIso: string;
  visibleEvents: PreviewEvent[];
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const preferredEventId =
    visibleEvents.find((event) => event.type === "steam_deal")?.id ?? visibleEvents[0]?.id ?? null;
  const selectedEvent =
    visibleEvents.find((event) => event.id === selectedEventId) ??
    visibleEvents.find((event) => event.id === preferredEventId) ??
    null;
  const initialFocusDate = chooseCalendarFocusDate(
    selectedEvent ? [selectedEvent] : visibleEvents,
    todayIso,
  );

  useEffect(() => {
    if (!selectedEventId || !visibleEvents.some((event) => event.id === selectedEventId)) {
      // Keep the detail selection valid when filters hide the previous event.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedEventId(preferredEventId);
    }
  }, [preferredEventId, selectedEventId, visibleEvents]);

  function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
    onOpenMobileDetails();
  }

  function selectEventFromGame(eventId: string) {
    setSelectedEventId(eventId);
    onSelectFromGames?.();
  }

  return {
    initialFocusDate,
    selectedEvent,
    selectedEventId,
    selectEvent,
    selectEventFromGame,
  };
}

export function useSelectedGames({
  hasConnectedWishlist,
  preview,
  showMyGames,
}: {
  hasConnectedWishlist: boolean;
  preview: PreviewResponse;
  showMyGames: boolean;
}) {
  const [selectedGames, setSelectedGames] = useState<SelectedGame[]>([]);
  const [hasEditedSelectedGames, setHasEditedSelectedGames] = useState(false);
  const [recentlyAddedAppId, setRecentlyAddedAppId] = useState<string | null>(null);
  const [selectedGameNoticeAppId, setSelectedGameNoticeAppId] = useState<string | null>(null);
  const [undoableGame, setUndoableGame] = useState<SelectedGame | null>(null);
  const hasSeededDefaultGamesRef = useRef(false);

  const clearRecentlyAddedAppId = useCallback(() => setRecentlyAddedAppId(null), []);
  const clearUndoableGame = useCallback(() => setUndoableGame(null), []);

  useTimedReset(recentlyAddedAppId, clearRecentlyAddedAppId, 5200);
  useTimedReset(undoableGame, clearUndoableGame, 6000);

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
      .filter(
        (event) => (event.type === "steam_deal" || event.type === "steam_preorder") && event.appId,
      )
      .slice(0, AUTO_TRACKED_GAME_COUNT)
      .map(selectedGameFromEvent);

    if (!defaultGames.length) {
      return;
    }

    hasSeededDefaultGamesRef.current = true;
    // Sync default tracked games after the public preview arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGames(defaultGames);
  }, [hasConnectedWishlist, preview, selectedGames.length, showMyGames]);

  useEffect(() => {
    if (!selectedGames.length || !preview.watchedGames?.length) {
      return;
    }

    const gamesByAppId = new Map(
      preview.watchedGames.map((game) => [game.appId, selectedGameFromWishlistGame(game)]),
    );
    let didChange = false;
    const nextSelectedGames = selectedGames.map((game) => {
      const localizedGame = gamesByAppId.get(game.appId);

      if (!localizedGame) {
        return game;
      }

      if (selectedGamesEqual(game, localizedGame)) {
        return game;
      }

      didChange = true;
      return localizedGame;
    });

    if (didChange) {
      // Sync selected-game display metadata when localized preview data changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedGames(nextSelectedGames);
    }
  }, [preview.watchedGames, selectedGames]);

  function addGame(game: SelectedGame) {
    if (
      hasConnectedWishlist ||
      selectedGames.some((selectedGame) => selectedGame.appId === game.appId)
    ) {
      return;
    }

    setHasEditedSelectedGames(true);
    setRecentlyAddedAppId(game.appId);
    setUndoableGame(game);
    // Keep manual tracking compact; the preview is meant for a curated watch list, not a full
    // wishlist replacement.
    setSelectedGames((games) => [...games, game].slice(-10));
    trackAnalyticsEvent(SOURCE_MODE_CHANGED_EVENT, {
      sourceMode: "manual",
    } satisfies SourceModeChangedAnalyticsProperties);
    trackAnalyticsEvent(MANUAL_GAME_ADDED_EVENT, {
      selectedGameCount: Math.min(selectedGames.length + 1, 10),
    } satisfies ManualGameAnalyticsProperties);
  }

  function removeGame(appId: string) {
    setHasEditedSelectedGames(true);
    setSelectedGames((games) => games.filter((game) => game.appId !== appId));
    setRecentlyAddedAppId((currentAppId) => (currentAppId === appId ? null : currentAppId));
    setSelectedGameNoticeAppId((currentAppId) => (currentAppId === appId ? null : currentAppId));
    setUndoableGame((currentGame) => (currentGame?.appId === appId ? null : currentGame));
    trackAnalyticsEvent(MANUAL_GAME_REMOVED_EVENT, {
      selectedGameCount: Math.max(selectedGames.length - 1, 0),
    } satisfies ManualGameAnalyticsProperties);
  }

  function undoAddGame(appId: string) {
    setHasEditedSelectedGames(true);
    setSelectedGames((games) => games.filter((game) => game.appId !== appId));
    setRecentlyAddedAppId((currentAppId) => (currentAppId === appId ? null : currentAppId));
    setSelectedGameNoticeAppId((currentAppId) => (currentAppId === appId ? null : currentAppId));
    setUndoableGame(null);
  }

  function selectGame(
    appId: string,
    events: PreviewEvent[],
    todayIso: string,
    onGameMatched: (eventId: string) => void,
  ) {
    const matchingEvent = chooseCurrentGameEvent(events, appId, todayIso);

    if (matchingEvent) {
      // Clicking a tracked game should jump to its event when we have one; otherwise a notice
      // explains that the game has no visible calendar event in the current filters.
      setSelectedGameNoticeAppId(null);
      onGameMatched(matchingEvent.id);
      return true;
    }

    setSelectedGameNoticeAppId(appId);
    return false;
  }

  function resetNotices() {
    setSelectedGameNoticeAppId(null);
    setUndoableGame(null);
  }

  return {
    addGame,
    hasEditedSelectedGames,
    recentlyAddedAppId,
    removeGame,
    resetNotices,
    selectGame,
    selectedGameNoticeAppId,
    selectedGames,
    undoableGame,
    undoAddGame,
  };
}

function selectedGamesEqual(first: SelectedGame, second: SelectedGame): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function analyticsErrorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "Error";
}
