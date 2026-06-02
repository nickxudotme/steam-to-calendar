"use client";

import NextLink from "next/link";
import { Coffee, Info, Languages, Settings } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_CALENDAR_CONFIG, STEAM_EVENT_CATEGORIES } from "@/domain/calendar/config";
import { STEAM_EVENTS_CALENDAR_ID } from "@/domain/calendar/constants";
import { countryFlag, STEAM_STORE_REGIONS, steamStoreRegionName } from "@/shared/steam-regions";
import { languageOptionByCode } from "./browser-locale";
import {
  calendarLegendItems,
  clampInteger,
  formatCountLabel,
  isGameCalendarEvent,
  localIsoDate,
  storeRegionCurrencySymbol,
} from "./calendar-utils";
import {
  CalendarLegend,
  CalendarListIcon,
  CalendarPreview,
  ManualSubscribeFallback,
} from "./calendar-preview";
import { EventDetails } from "./event-details";
import { GameSearchPreviewCard } from "./game-search-preview-card";
import {
  useBrowserDefaults,
  useCalendarConfig,
  useCalendarSelection,
  useCalendarSourceState,
  useGameSearch,
  usePublicPreviewLoader,
  useResizableWorkbench,
  useSelectedGames,
  useSubscriptionUrls,
} from "./hooks";
import { ManualGamePicker } from "./manual-game-picker";
import { LANGUAGE_OPTIONS, STEAM_EVENT_CATEGORY_LABELS, UI_COPY, type UiLanguage } from "./ui-copy";
import {
  EVENT_FUTURE_DAYS_MAX,
  EVENT_PAST_DAYS_MAX,
  INTRO_STORAGE_KEY,
  PUBLIC_PREVIEW,
  type GameSearchResult,
  type PreviewResponse,
  type SelectedGame,
} from "./model";
import { useSearchPreview } from "./search-preview-hooks";
import { IntroPanel, UndoAddToast } from "./session-notices";
import { SourceToggle } from "./source-toggle";
import { WishlistConnector } from "./wishlist-connector";
import { useWishlistPreview } from "./wishlist-preview-hooks";

const TOOLTIP_VIEWPORT_PADDING = 16;
const MOBILE_WORKBENCH_MEDIA_QUERY = "(max-width: 900px)";
const GITHUB_REPOSITORY_URL = "https://github.com/nickxudotme/steam-to-calendar";
const DONATE_URL = "https://buymeacoffee.com/nickxu.me";

export function CalendarBuilderPage({
  initialLanguageCode = "en",
}: {
  initialLanguageCode?: string;
}) {
  // This component is intentionally the feature composition root: it owns app-wide UI state
  // and delegates rendering/details to smaller components and hooks.
  const [preview, setPreview] = useState<PreviewResponse>(PUBLIC_PREVIEW);
  const [publicPreviewError, setPublicPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [shouldShowPreviewLoading, setShouldShowPreviewLoading] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const [storeRegion, setStoreRegion] = useState<string | null>(null);
  const [detectedStoreRegion, setDetectedStoreRegion] = useState<string | null>(null);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const initialLanguage = languageOptionByCode(initialLanguageCode);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(initialLanguage.uiLanguage);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(initialLanguage.code);
  const [hasInitializedClientLocale, setHasInitializedClientLocale] = useState(false);
  const [shouldSendDetectedStoreRegion, setShouldSendDetectedStoreRegion] = useState(false);
  const [todayIso, setTodayIso] = useState(() => localIsoDate());
  const [origin, setOrigin] = useState("");
  const [isStoreTooltipOpen, setIsStoreTooltipOpen] = useState(false);
  const [storeTooltipShiftX, setStoreTooltipShiftX] = useState(0);
  const [projectTooltip, setProjectTooltip] = useState<{
    id: string;
    label: string;
    left: number;
    top: number;
  } | null>(null);
  const userSelectedRegionRef = useRef(false);
  const publicPreviewRef = useRef<PreviewResponse>(PUBLIC_PREVIEW);
  const storeRegionControlRef = useRef<HTMLDivElement | null>(null);
  const storeTooltipRef = useRef<HTMLSpanElement | null>(null);
  const {
    activeResizeHandle,
    configResizeHandleProps,
    detailResizeHandleProps,
    hasRestoredWorkbenchLayout,
    hasUserResizedWorkbench,
    workbenchRef,
    workbenchStyle,
  } = useResizableWorkbench();
  const selectedLanguage = languageOptionByCode(selectedLanguageCode);
  const copy = UI_COPY[uiLanguage];
  const selectedOrDetectedStoreRegion =
    storeRegion ?? detectedStoreRegion ?? preview.locale?.cc ?? "US";
  const effectiveStoreRegion = selectedOrDetectedStoreRegion;
  const effectiveStoreRegionCurrency = storeRegionCurrencySymbol(
    effectiveStoreRegion,
    preview.locale?.cc === effectiveStoreRegion ? preview.events : [],
  );
  const shouldShowResolvedStoreRegion =
    hasInitializedClientLocale || Boolean(storeRegion ?? preview.locale?.cc ?? detectedStoreRegion);
  const isStoreRegionCurrencyLoading =
    !shouldShowResolvedStoreRegion || preview.locale?.cc !== effectiveStoreRegion;
  const effectiveStoreRegionCurrencyLabel = isStoreRegionCurrencyLoading
    ? copy.storeCurrencyLoading
    : effectiveStoreRegionCurrency;
  const effectiveStoreRegionLabel = `${countryFlag(effectiveStoreRegion)} ${steamStoreRegionName(effectiveStoreRegion)} (${effectiveStoreRegionCurrencyLabel})`;
  const effectiveSteamLang = selectedLanguage.steamLang;
  const effectiveUiLang = selectedLanguage.uiLang;
  const hasConnectedWishlist = preview.steamId64 !== STEAM_EVENTS_CALENDAR_ID;
  const {
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
  } = useCalendarSourceState();
  const gameSearch = useGameSearch({
    hasConnectedWishlist,
    locale: {
      cc: effectiveStoreRegion,
      lang: effectiveSteamLang,
      uiLang: effectiveUiLang,
    },
  });
  const selectedGamesState = useSelectedGames({
    hasConnectedWishlist,
    preview,
    showMyGames,
  });
  const { calendarConfig } = useCalendarConfig({
    eventFutureDays,
    eventPastDays,
    hasConnectedWishlist,
    hasEditedSelectedGames: selectedGamesState.hasEditedSelectedGames,
    selectedGames: selectedGamesState.selectedGames,
    showMyGames,
    showSteamEvents,
    steamEventCategories,
  });

  const { calendarUrl, webcalUrl } = useSubscriptionUrls({
    calendarConfig,
    effectiveSteamLang,
    effectiveStoreRegion,
    effectiveUiLang,
    origin,
    preview,
  });

  const calendarEvents = preview.events;

  const sortedEvents = useMemo(() => {
    return [...calendarEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [calendarEvents]);
  const selectedGameAppIds = useMemo(
    () => new Set(selectedGamesState.selectedGames.map((game) => game.appId)),
    [selectedGamesState.selectedGames],
  );
  const visibleEvents = useMemo(() => {
    // Filters hide events in the UI without mutating the preview payload. Keeping the raw
    // preview intact makes it cheap to toggle sources back on.
    return sortedEvents.filter((event) => {
      if (event.type === "steam_deal" || event.type === "steam_preorder") {
        return (
          showMyGames &&
          (hasConnectedWishlist || Boolean(event.appId && selectedGameAppIds.has(event.appId)))
        );
      }

      if (event.type === "steam_major_event") {
        return (
          showSteamEvents &&
          (!event.eventCategory || steamEventCategories.includes(event.eventCategory))
        );
      }

      return (
        showMyGames &&
        (hasConnectedWishlist ||
          !isGameCalendarEvent(event) ||
          Boolean(event.appId && selectedGameAppIds.has(event.appId)))
      );
    });
  }, [
    hasConnectedWishlist,
    selectedGameAppIds,
    showMyGames,
    showSteamEvents,
    sortedEvents,
    steamEventCategories,
  ]);
  const wishlistEventAppIds = useMemo(
    () =>
      new Set(
        visibleEvents
          .filter((event) => isGameCalendarEvent(event) && event.appId)
          .map((event) => event.appId as string),
      ),
    [visibleEvents],
  );
  const connectedWishlistGames = useMemo(() => {
    const games = preview.wishlistGames ?? [];

    // Put games with calendar events first so the imported wishlist immediately explains
    // why some games appear in the preview and others do not.
    return [...games].sort((a, b) => {
      const aHasEvent = wishlistEventAppIds.has(a.appId);
      const bHasEvent = wishlistEventAppIds.has(b.appId);

      if (aHasEvent !== bHasEvent) {
        return aHasEvent ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
  }, [preview.wishlistGames, wishlistEventAppIds]);
  const trackedGameCount = hasConnectedWishlist
    ? preview.stats.wishlistGames
    : selectedGamesState.selectedGames.length;
  const calendarSummaryItems = [
    formatCountLabel(visibleEvents.length, copy.calendarSummaryEvents, uiLanguage),
    hasConnectedWishlist
      ? copy.calendarSummaryWishlist
      : formatCountLabel(trackedGameCount, copy.calendarSummaryGames, uiLanguage),
  ]
    .filter(Boolean)
    .join(" · ");
  const shouldShowManualPreviewLoading =
    shouldShowPreviewLoading && !selectedGamesState.hasEditedSelectedGames;

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setShouldShowPreviewLoading(isPreviewLoading),
      isPreviewLoading ? 450 : 0,
    );

    return () => window.clearTimeout(timeoutId);
  }, [isPreviewLoading]);

  useEffect(() => {
    document.documentElement.lang = effectiveUiLang;
  }, [effectiveUiLang]);

  const openIntroPanel = useCallback(() => {
    setIsIntroOpen(true);

    if (!window.matchMedia(MOBILE_WORKBENCH_MEDIA_QUERY).matches) {
      return;
    }

    setIsMobileDetailOpen(false);
    setIsMobileSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (!isStoreTooltipOpen) {
      return;
    }

    function updateStoreTooltipPosition() {
      const controlRect = storeRegionControlRef.current?.getBoundingClientRect();
      const tooltipRect = storeTooltipRef.current?.getBoundingClientRect();

      if (!controlRect || !tooltipRect) {
        return;
      }

      const centeredLeft = controlRect.width / 2 - tooltipRect.width / 2;
      const minLeft = TOOLTIP_VIEWPORT_PADDING - controlRect.left;
      const maxLeft =
        window.innerWidth - TOOLTIP_VIEWPORT_PADDING - controlRect.left - tooltipRect.width;
      const clampedLeft = Math.min(Math.max(centeredLeft, minLeft), maxLeft);

      setStoreTooltipShiftX(clampedLeft - centeredLeft);
    }

    const animationFrameId = window.requestAnimationFrame(updateStoreTooltipPosition);
    window.addEventListener("resize", updateStoreTooltipPosition);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateStoreTooltipPosition);
    };
  }, [isStoreTooltipOpen, copy.storeNote, effectiveStoreRegionLabel]);

  const calendarSelection = useCalendarSelection({
    onOpenMobileDetails: () => {
      setIsMobileSettingsOpen(false);
      setIsMobileDetailOpen(true);
    },
    todayIso,
    visibleEvents,
  });

  useBrowserDefaults({
    openIntro: openIntroPanel,
    setDetectedStoreRegion,
    setHasInitializedClientLocale,
    setOrigin,
    setSelectedLanguageCode,
    setShouldSendDetectedStoreRegion,
    setTodayIso,
    setUiLanguage,
  });

  usePublicPreviewLoader({
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
  });

  const searchPreviewState = useSearchPreview({
    gameSearchResults: gameSearch.results,
    previewEvents: preview.events,
  });
  const wishlistPreview = useWishlistPreview({
    calendarConfig,
    connectedSteamId64: hasConnectedWishlist ? preview.steamId64 : null,
    effectiveSteamLang,
    effectiveStoreRegion,
    effectiveUiLang,
    onConnected: gameSearch.clearResults,
    onDisconnected: () => {
      selectedGamesState.resetNotices();
      searchPreviewState.clear();
    },
    publicPreviewRef,
    setPreview,
    setShowMyGames,
    webcalUrl,
  });

  function handleAddSelectedGame(game: GameSearchResult) {
    handleAddManualGame({
      appId: game.appId,
      ...(game.genres?.length ? { genres: game.genres } : {}),
      name: game.name,
      ...(game.imageUrl ? { imageUrl: game.imageUrl } : {}),
      ...(game.price ? { price: game.price } : {}),
      ...(typeof game.reviewCount === "number" ? { reviewCount: game.reviewCount } : {}),
      ...(typeof game.reviewPercentage === "number"
        ? { reviewPercentage: game.reviewPercentage }
        : {}),
      ...(game.reviewSummary ? { reviewSummary: game.reviewSummary } : {}),
      ...(game.releaseDateText !== undefined ? { releaseDateText: game.releaseDateText } : {}),
      storeUrl: game.storeUrl,
    });
  }

  function handleAddManualGame(game: SelectedGame) {
    setShowMyGames(true);
    selectedGamesState.addGame(game);
  }

  function handleSelectedGameClick(appId: string) {
    setShowMyGames(true);
    const didSelectGameEvent = selectedGamesState.selectGame(
      appId,
      sortedEvents,
      todayIso,
      calendarSelection.selectEventFromGame,
    );

    if (didSelectGameEvent && isMobileSettingsOpen) {
      setIsMobileDetailOpen(true);
    }
  }

  function handleStoreRegionChange(value: string) {
    // Once the user picks a region manually, later server/browser hints should not override it.
    userSelectedRegionRef.current = true;
    setStoreRegion(value);
    setDetectedStoreRegion(value);
  }

  function handleLanguageChange(value: string) {
    const language = languageOptionByCode(value);
    setSelectedLanguageCode(language.code);
    setUiLanguage(language.uiLanguage);
  }

  function handleCloseMobileOverlays() {
    setIsMobileSettingsOpen(false);
    setIsMobileDetailOpen(false);
  }

  function handleCloseIntro() {
    setIsIntroOpen(false);
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "1");
    } catch {
      // localStorage may be unavailable in private browsing; closing should still work.
    }
  }

  function showProjectTooltip(id: string, label: string, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const nextTooltip = {
      id,
      label,
      left: rect.left + rect.width / 2,
      top: rect.top - 10,
    };

    setProjectTooltip(nextTooltip);
  }

  return (
    <main className="appRoot">
      <div className="shell">
        <header className="siteHeader">
          <NextLink className="brandMark" href="/" aria-label={`${copy.productName} home`}>
            <span className="brandIcon">
              <img src="/assets/brand/steam-to-calendar-logo.png" alt="" />
            </span>
            <span className="brandText">
              <span className="brandName">{copy.productName}</span>
              <span className="brandTagline">{copy.positioningShort}</span>
            </span>
          </NextLink>
          <div className="headerControls" aria-hidden={isMobileSettingsOpen || undefined}>
            <div className="localeControls">
              <div
                className="storeRegionControl"
                data-open={isStoreTooltipOpen}
                ref={storeRegionControlRef}
                style={{ "--tooltip-shift-x": `${storeTooltipShiftX}px` } as CSSProperties}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsStoreTooltipOpen(false);
                  }
                }}
                onFocus={() => setIsStoreTooltipOpen(true)}
                onPointerEnter={() => setIsStoreTooltipOpen(true)}
                onPointerLeave={() => setIsStoreTooltipOpen(false)}
              >
                <span className="storeRegionIcon" aria-hidden="true">
                  {effectiveStoreRegionCurrency}
                </span>
                <label className="regionSelect">
                  <span className="selectDisplay">
                    <span className="selectDisplayText">
                      {shouldShowResolvedStoreRegion ? effectiveStoreRegionLabel : "..."}
                    </span>
                  </span>
                  <select
                    aria-label="Steam store region"
                    aria-describedby={isStoreTooltipOpen ? "store-region-tooltip" : undefined}
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
                <span
                  className="storeRegionTooltip"
                  id="store-region-tooltip"
                  ref={storeTooltipRef}
                  role="tooltip"
                >
                  {copy.storeNote}
                </span>
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

        <h1 className="srOnly">{copy.positioning}</h1>

        <button
          aria-label="Close overlay"
          className={
            isMobileSettingsOpen || isMobileDetailOpen
              ? "mobileSheetBackdrop isVisible"
              : "mobileSheetBackdrop"
          }
          onClick={handleCloseMobileOverlays}
          type="button"
        />

        <section
          className={[
            "calendarWorkbench",
            activeResizeHandle ? "isResizing" : "",
            hasRestoredWorkbenchLayout ? "hasRestoredLayout" : "",
            hasUserResizedWorkbench ? "hasUserResized" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`${copy.productName} workbench`}
          ref={workbenchRef}
          style={workbenchStyle}
        >
          <aside
            className={["configPanel", isMobileSettingsOpen ? "isMobileOpen" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-label="Calendar configuration"
          >
            <div className="mobileSheetHeader">
              <h2>{copy.calendarSetupTitle}</h2>
              <button
                aria-label="Close settings"
                type="button"
                onClick={() => setIsMobileSettingsOpen(false)}
              >
                ×
              </button>
            </div>

            {isIntroOpen ? (
              <IntroPanel copy={copy} onClose={handleCloseIntro} />
            ) : (
              <div className="settingsContentPanel">
                <div className="taskPanelHeader">
                  <div className="taskPanelTitle">
                    <h2>{copy.calendarSetupTitle}</h2>
                    <p>{copy.calendarSetupSubtitle}</p>
                  </div>
                  <button
                    aria-label={copy.infoLabel}
                    className="infoButton"
                    type="button"
                    onClick={openIntroPanel}
                  >
                    <Info aria-hidden="true" className="miniIcon" />
                  </button>
                </div>

                {publicPreviewError ? (
                  <div className="notice error">{copy.wishlistGenericHint}</div>
                ) : null}

                <div className="setupChecklist">
                  <section className="setupStep" aria-label={copy.steamEventsTitle}>
                    <div className="setupStepMarker" aria-hidden="true">
                      1
                    </div>
                    <div className="setupStepBody">
                      <SourceToggle
                        checked={showSteamEvents}
                        description={copy.steamEventsDescription}
                        title={copy.steamEventsTitle}
                        controlsId="steam-event-options"
                        isExpanded={isSteamEventOptionsOpen}
                        onChange={setShowSteamEvents}
                        onToggleOptions={() => setIsSteamEventOptionsOpen((isOpen) => !isOpen)}
                      >
                        <div
                          aria-hidden={!isSteamEventOptionsOpen}
                          className="eventOptionsCollapse"
                          data-expanded={isSteamEventOptionsOpen}
                          id="steam-event-options"
                        >
                          <div className="eventOptionsCollapseInner">
                            <div className="eventOptionsPanel">
                              <div className="eventTypeGrid" aria-label="Steam event types">
                                {STEAM_EVENT_CATEGORIES.map((category) => (
                                  <label className="eventTypeOption" key={category}>
                                    <input
                                      checked={steamEventCategories.includes(category)}
                                      disabled={!showSteamEvents || !isSteamEventOptionsOpen}
                                      onChange={(event) =>
                                        handleSteamEventCategoryChange(
                                          category,
                                          event.target.checked,
                                        )
                                      }
                                      type="checkbox"
                                    />
                                    <span>
                                      <strong>
                                        {STEAM_EVENT_CATEGORY_LABELS[uiLanguage][category].title}
                                      </strong>
                                      <small>
                                        {
                                          STEAM_EVENT_CATEGORY_LABELS[uiLanguage][category]
                                            .description
                                        }
                                      </small>
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
                                    disabled={!isSteamEventOptionsOpen}
                                    type="range"
                                    min="0"
                                    max={EVENT_PAST_DAYS_MAX}
                                    step="1"
                                    value={eventPastDays}
                                    onChange={(event) =>
                                      setEventPastDays(
                                        clampInteger(
                                          event.target.value,
                                          0,
                                          EVENT_PAST_DAYS_MAX,
                                          DEFAULT_CALENDAR_CONFIG.eventPastDays,
                                        ),
                                      )
                                    }
                                  />
                                </label>
                                <label className="rangeControl">
                                  <span className="rangeControlHeader">
                                    <span>{copy.nextDays}</span>
                                    <output>{eventFutureDays}</output>
                                  </span>
                                  <input
                                    aria-label={copy.nextDays}
                                    disabled={!isSteamEventOptionsOpen}
                                    type="range"
                                    min="1"
                                    max={EVENT_FUTURE_DAYS_MAX}
                                    step="1"
                                    value={eventFutureDays}
                                    onChange={(event) =>
                                      setEventFutureDays(
                                        clampInteger(
                                          event.target.value,
                                          1,
                                          EVENT_FUTURE_DAYS_MAX,
                                          DEFAULT_CALENDAR_CONFIG.eventFutureDays,
                                        ),
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </SourceToggle>
                    </div>
                  </section>

                  <section className="setupStep setupGamesStep" aria-label={copy.myGamesTitle}>
                    <div className="setupStepMarker" aria-hidden="true">
                      2
                    </div>
                    <div className="setupStepBody trackedGamesStepCard">
                      <div className="trackedGamesStepHeader">
                        <h3>{copy.myGamesTitle}</h3>
                        <p>{copy.trackedGamesSetupDescription}</p>
                      </div>

                      <WishlistConnector
                        connectedWishlistGames={connectedWishlistGames}
                        copy={copy}
                        error={wishlistPreview.error}
                        errorCode={wishlistPreview.errorCode}
                        hasConnectedWishlist={hasConnectedWishlist}
                        isLoading={wishlistPreview.isLoading}
                        isWishlistImportOpen={wishlistPreview.isImportOpen}
                        onDisconnect={wishlistPreview.disconnect}
                        onGameClick={handleSelectedGameClick}
                        onGamePreview={searchPreviewState.showSelectedGame}
                        onImportOpen={wishlistPreview.openImport}
                        onSearchPreviewClear={searchPreviewState.clear}
                        onSteamIdChange={wishlistPreview.setSteamId64}
                        onSubmit={wishlistPreview.submit}
                        previewProfileName={preview.profileName}
                        selectedGameNoticeAppId={selectedGamesState.selectedGameNoticeAppId}
                        sortedEvents={sortedEvents}
                        steamId64={wishlistPreview.steamId64}
                        todayIso={todayIso}
                        uiLanguage={uiLanguage}
                        wishlistEventCount={wishlistEventAppIds.size}
                        wishlistGameCount={preview.stats.wishlistGames}
                      />

                      <div className="setupChoiceDivider" aria-hidden="true">
                        <span>{copy.orLabel}</span>
                      </div>

                      <ManualGamePicker
                        copy={copy}
                        gameSearch={gameSearch.query}
                        gameSearchError={gameSearch.error}
                        gameSearchResults={gameSearch.results}
                        hasConnectedWishlist={hasConnectedWishlist}
                        isPreviewLoading={shouldShowManualPreviewLoading}
                        isSearchingGames={gameSearch.isSearching}
                        lastGameSearchQuery={gameSearch.lastQuery}
                        onAddGame={handleAddSelectedGame}
                        onGameClick={handleSelectedGameClick}
                        onGamePreview={searchPreviewState.show}
                        onGameSearchChange={gameSearch.handleQueryChange}
                        onRemoveGame={selectedGamesState.removeGame}
                        onSearchPreviewClear={searchPreviewState.clear}
                        onSubmit={gameSearch.handleSubmit}
                        recentlyAddedAppId={selectedGamesState.recentlyAddedAppId}
                        selectedGameNoticeAppId={selectedGamesState.selectedGameNoticeAppId}
                        selectedGames={selectedGamesState.selectedGames}
                        showMyGames={showMyGames}
                        todayIso={todayIso}
                      />
                    </div>
                  </section>

                  <section
                    className="setupStep setupReadyStep"
                    aria-label={copy.calendarReadyTitle}
                  >
                    <div className="setupStepMarker" aria-hidden="true">
                      3
                    </div>
                    <div className="setupReadyCard">
                      <div>
                        <strong>{copy.calendarReadyTitle}</strong>
                        <span aria-hidden="true">✓</span>
                      </div>
                      <p>{calendarSummaryItems}</p>
                      <a className="primaryCalendarCta setupReadyCta" href={webcalUrl}>
                        <CalendarListIcon />
                        <span>
                          <strong>{copy.addToCalendar}</strong>
                          <small>{copy.calendarCtaHint}</small>
                        </span>
                      </a>
                      <ManualSubscribeFallback
                        calendarUrl={calendarUrl}
                        className="setupManualSubscribeHint"
                        copiedLabel={copy.copiedSubscriptionUrl}
                        copyLabel={copy.copySubscriptionUrl}
                        hint={copy.calendarManualSubscribeShortHint}
                        variant="compact"
                      />
                    </div>
                  </section>
                </div>
              </div>
            )}

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
          </aside>

          <div {...configResizeHandleProps} />

          <div className="calendarExperience" id="calendar-preview">
            <CalendarPreview
              events={visibleEvents}
              initialFocusDate={calendarSelection.initialFocusDate}
              isLoading={shouldShowPreviewLoading}
              onSelectEvent={calendarSelection.selectEvent}
              recentlyAddedAppId={selectedGamesState.recentlyAddedAppId}
              selectedEventId={calendarSelection.selectedEvent?.id ?? null}
              todayIso={todayIso}
              uiCopy={copy}
              uiLanguage={uiLanguage}
              calendarUrl={calendarUrl}
              webcalUrl={webcalUrl}
            />
            <div className="calendarActionBar">
              <CalendarLegend legendItems={calendarLegendItems(visibleEvents, copy)} />
              <nav className="calendarIconLinks" aria-label="Project links">
                <a
                  aria-describedby="github-link-tooltip"
                  aria-label={copy.githubLinkLabel}
                  href={GITHUB_REPOSITORY_URL}
                  rel="noreferrer"
                  target="_blank"
                  onBlur={() => setProjectTooltip(null)}
                  onFocus={(event) =>
                    showProjectTooltip(
                      "github-link-tooltip",
                      copy.githubLinkLabel,
                      event.currentTarget,
                    )
                  }
                  onPointerEnter={(event) =>
                    showProjectTooltip(
                      "github-link-tooltip",
                      copy.githubLinkLabel,
                      event.currentTarget,
                    )
                  }
                  onPointerLeave={() => setProjectTooltip(null)}
                >
                  <GitHubMark />
                </a>
                <a
                  aria-describedby="donate-link-tooltip"
                  aria-label={copy.donateLinkLabel}
                  href={DONATE_URL}
                  rel="noreferrer"
                  target="_blank"
                  onBlur={() => setProjectTooltip(null)}
                  onFocus={(event) =>
                    showProjectTooltip(
                      "donate-link-tooltip",
                      copy.donateLinkLabel,
                      event.currentTarget,
                    )
                  }
                  onPointerEnter={(event) =>
                    showProjectTooltip(
                      "donate-link-tooltip",
                      copy.donateLinkLabel,
                      event.currentTarget,
                    )
                  }
                  onPointerLeave={() => setProjectTooltip(null)}
                >
                  <Coffee aria-hidden="true" />
                </a>
              </nav>
            </div>
          </div>

          <div {...detailResizeHandleProps} />

          <EventDetails
            event={calendarSelection.selectedEvent}
            copy={copy}
            isMobileOpen={isMobileDetailOpen}
            onCloseMobile={() => setIsMobileDetailOpen(false)}
            uiLanguage={uiLanguage}
          />
          <GameSearchPreviewCard
            copy={copy}
            preview={searchPreviewState.preview}
            uiLanguage={uiLanguage}
          />
          <UndoAddToast
            copy={copy}
            game={selectedGamesState.undoableGame}
            onUndo={selectedGamesState.undoAddGame}
            uiLanguage={uiLanguage}
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
      </div>
      {projectTooltip
        ? createPortal(
            <span
              className="calendarIconTooltip"
              id={projectTooltip.id}
              role="tooltip"
              style={
                {
                  "--tooltip-left": `${projectTooltip.left}px`,
                  "--tooltip-top": `${projectTooltip.top}px`,
                } as CSSProperties
              }
            >
              {projectTooltip.label}
            </span>,
            document.body,
          )
        : null}
    </main>
  );
}

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path
        clipRule="evenodd"
        d="M8 0.4C3.78 0.4 0.36 3.82 0.36 8.04c0 3.38 2.19 6.24 5.23 7.26 0.38 0.07 0.52-0.17 0.52-0.37 0-0.18-0.01-0.79-0.01-1.43-2.13 0.46-2.58-0.91-2.58-0.91-0.35-0.89-0.85-1.12-0.85-1.12-0.7-0.48 0.05-0.47 0.05-0.47 0.77 0.05 1.18 0.79 1.18 0.79 0.68 1.17 1.79 0.83 2.23 0.64 0.07-0.49 0.27-0.83 0.49-1.02-1.7-0.19-3.49-0.85-3.49-3.79 0-0.84 0.3-1.52 0.79-2.06-0.08-0.19-0.34-0.97 0.08-2.03 0 0 0.64-0.2 2.1 0.79 0.61-0.17 1.26-0.25 1.91-0.25s1.3 0.09 1.91 0.25c1.45-0.99 2.1-0.79 2.1-0.79 0.42 1.06 0.16 1.84 0.08 2.03 0.49 0.54 0.79 1.22 0.79 2.06 0 2.95-1.79 3.6-3.5 3.79 0.28 0.24 0.52 0.71 0.52 1.43 0 1.03-0.01 1.86-0.01 2.11 0 0.21 0.14 0.45 0.53 0.37 3.03-1.02 5.22-3.88 5.22-7.26C15.64 3.82 12.22 0.4 8 0.4Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

function SettingsIcon() {
  return <Settings aria-hidden="true" className="miniIcon" />;
}

function LanguageIcon() {
  return <Languages aria-hidden="true" className="miniIcon" />;
}
