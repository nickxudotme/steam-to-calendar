import { STEAM_EVENT_CATEGORIES, type SteamEventCategory } from "@/domain/calendar/config";
import {
  MAX_EVENT_LANES,
  type CalendarEventSegment,
  type CalendarWeek,
  type GameSearchResult,
  type PreviewEvent,
  type SelectedGame,
  type WishlistGame,
} from "./model";
import { UI_COPY, type UiLanguage } from "./ui-copy";

export function isGameCalendarEvent(event: PreviewEvent) {
  return (
    event.type === "steam_deal" ||
    event.type === "steam_preorder" ||
    event.type === "wishlist_release"
  );
}

export function shouldLoadDefaultDealPreview({
  hasConnectedWishlist,
  hasEditedSelectedGames,
  selectedGameCount,
  showMyGames,
}: {
  hasConnectedWishlist: boolean;
  hasEditedSelectedGames: boolean;
  selectedGameCount: number;
  showMyGames: boolean;
}) {
  return showMyGames && !hasConnectedWishlist && !hasEditedSelectedGames && selectedGameCount === 0;
}

export function selectedGameFromEvent(event: PreviewEvent): SelectedGame {
  const discountPercent = event.discount?.match(/(\d+)/)?.[1];

  return {
    appId: event.appId as string,
    ...(event.developers?.length ? { developers: event.developers } : {}),
    ...(event.genres?.length ? { genres: event.genres } : {}),
    name: selectedGameTitle(event),
    ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
    ...(event.finalPrice || event.originalPrice || discountPercent
      ? {
          price: {
            discountPercent: discountPercent ? Number(discountPercent) : 0,
            ...(event.finalPrice ? { finalFormatted: event.finalPrice } : {}),
            ...(event.originalPrice ? { initialFormatted: event.originalPrice } : {}),
          },
        }
      : {}),
    ...(event.publishers?.length ? { publishers: event.publishers } : {}),
    ...(typeof event.reviewCount === "number" ? { reviewCount: event.reviewCount } : {}),
    ...(typeof event.reviewPercentage === "number"
      ? { reviewPercentage: event.reviewPercentage }
      : {}),
    ...(event.reviewSummary ? { reviewSummary: event.reviewSummary } : {}),
    ...(event.releaseDateText !== undefined ? { releaseDateText: event.releaseDateText } : {}),
    storeUrl: event.sourceUrl ?? `https://store.steampowered.com/app/${event.appId}/`,
  };
}

export function selectedGameFromWishlistGame(
  game: WishlistGame,
  event?: PreviewEvent,
): SelectedGame {
  return {
    appId: game.appId,
    name: game.name,
    ...((event?.imageUrl ?? game.imageUrl) ? { imageUrl: event?.imageUrl ?? game.imageUrl } : {}),
    ...((event?.genres ?? game.genres) ? { genres: event?.genres ?? game.genres } : {}),
    ...(game.developers ? { developers: game.developers } : {}),
    ...(game.price ? { price: game.price } : {}),
    ...(game.publishers ? { publishers: game.publishers } : {}),
    ...((event?.reviewCount ?? game.reviewCount)
      ? { reviewCount: event?.reviewCount ?? game.reviewCount }
      : {}),
    ...((event?.reviewPercentage ?? game.reviewPercentage)
      ? { reviewPercentage: event?.reviewPercentage ?? game.reviewPercentage }
      : {}),
    ...((event?.reviewSummary ?? game.reviewSummary)
      ? { reviewSummary: event?.reviewSummary ?? game.reviewSummary }
      : {}),
    releaseDateText: event?.releaseDateText ?? game.releaseDateText ?? null,
    storeUrl: event?.sourceUrl ?? game.storeUrl,
  };
}

export function watchedGamePendingMessage(
  game: Pick<SelectedGame, "releaseDateText">,
  copy: (typeof UI_COPY)[UiLanguage],
  todayIso: string,
): string {
  const releaseStatus = gameReleaseStatus(game.releaseDateText, todayIso);

  if (releaseStatus === "released") {
    return copy.watchedReleasedGamePending;
  }

  if (releaseStatus === "unreleased") {
    return copy.watchedUnreleasedGamePending;
  }

  return copy.watchedGamePending;
}

function gameReleaseStatus(
  releaseDateText: string | null | undefined,
  todayIso: string,
): "released" | "unreleased" | "unknown" {
  if (!releaseDateText) {
    return "unknown";
  }

  const exactReleaseDate = parseExactSteamReleaseDateText(releaseDateText);
  if (exactReleaseDate) {
    return exactReleaseDate <= todayIso ? "released" : "unreleased";
  }

  return "unreleased";
}

function parseExactSteamReleaseDateText(releaseDateText: string): string | null {
  const zhMatch = releaseDateText.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/);
  if (zhMatch) {
    return `${zhMatch[1]}-${zhMatch[2].padStart(2, "0")}-${zhMatch[3].padStart(2, "0")}`;
  }

  const match = releaseDateText.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);
  if (!match) {
    return null;
  }

  const month = steamReleaseMonthNumber(match[1]);
  if (!month) {
    return null;
  }

  return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
}

function steamReleaseMonthNumber(month: string): string | null {
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  return months[month] ?? null;
}

export function selectedGameTitle(event: PreviewEvent) {
  return detailTitle(event)
    .replace(/\s+releases?$/i, "")
    .replace(/\s+发售$/i, "");
}

export function hasGameEventImage(event: PreviewEvent) {
  return Boolean(isGameCalendarEvent(event) && event.imageUrl);
}

export function steamStoreUrlForEvent(event: PreviewEvent): string | null {
  if (!isGameCalendarEvent(event)) {
    return null;
  }

  if (event.appId && /^\d{1,10}$/.test(event.appId)) {
    return `https://store.steampowered.com/app/${event.appId}/`;
  }

  if (event.sourceUrl?.startsWith("https://store.steampowered.com/app/")) {
    return event.sourceUrl;
  }

  return null;
}

export function buildEventWeekRange(
  events: PreviewEvent[],
  todayIso: string,
): { startIso: string; endIso: string } {
  if (!events.length) {
    const todayWeekStart = weekStartForDate(todayIso);

    return {
      startIso: todayWeekStart,
      endIso: addDays(todayWeekStart, 7),
    };
  }

  const earliestDate = events.reduce(
    (earliest, event) => (event.startDate < earliest ? event.startDate : earliest),
    events[0].startDate,
  );
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

export function chooseCalendarFocusDate(events: PreviewEvent[], todayIso: string): string {
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

export function chooseEventFocusDate(event: PreviewEvent, todayIso: string): string {
  return eventOccursOn(event, todayIso) ? todayIso : event.startDate;
}

export function chooseCurrentGameEvent(
  events: PreviewEvent[],
  appId: string,
  todayIso: string,
): PreviewEvent | null {
  const matchingEvents = events.filter((event) => event.appId === appId);

  if (!matchingEvents.length) {
    return null;
  }

  const activeToday = matchingEvents.find((event) => eventOccursOn(event, todayIso));

  if (activeToday) {
    return activeToday;
  }

  const upcoming = matchingEvents
    .filter((event) => event.startDate >= todayIso)
    .sort(compareEventsForList)[0];

  if (upcoming) {
    return upcoming;
  }

  return [...matchingEvents].sort((a, b) => compareEventsForList(b, a))[0];
}

export function buildContinuousCalendarWeeks(
  events: PreviewEvent[],
  gridStartIso: string,
  gridEndIso: string,
): CalendarWeek[] {
  const weeks = [];

  for (
    let weekStartIso = gridStartIso;
    weekStartIso < gridEndIso;
    weekStartIso = addDays(weekStartIso, 7)
  ) {
    const cells = Array.from({ length: 7 }, (_, index) => {
      const isoDate = addDays(weekStartIso, index);
      const [, , day] = isoDate.split("-").map(Number);

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

export function weekStartForDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

export function inferVisibleMonthFromWeek(weekStartIso: string): string {
  for (let index = 0; index < 7; index += 1) {
    const isoDate = addDays(weekStartIso, index);

    if (isoDate.endsWith("-01")) {
      return monthKeyFromIsoDate(isoDate);
    }
  }

  return monthKeyFromIsoDate(addDays(weekStartIso, 3));
}

export function buildWeekEventSegments(
  events: PreviewEvent[],
  weekStartIso: string,
): CalendarEventSegment[] {
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
    const endColumn =
      daysBetween(weekStartIso, minIsoDate(eventEndExclusive, weekEndExclusive)) - 1;
    const lane = reserveWeekSegmentLane(occupied, startColumn, endColumn);

    if (lane === null) {
      return [];
    }

    return [
      {
        event,
        weekIndex: 0,
        lane,
        startColumn,
        endColumn,
        startsAtEvent: addDays(weekStartIso, startColumn) === eventStart,
        endsAtEvent: addDays(weekStartIso, endColumn + 1) === eventEndExclusive,
      },
    ];
  });
}

export function eventOccursOn(event: PreviewEvent, isoDate: string): boolean {
  if (!event.endDate) {
    return event.startDate === isoDate;
  }

  return event.startDate <= isoDate && isoDate < event.endDate;
}

function reserveWeekSegmentLane(
  occupied: Array<Array<{ startColumn: number; endColumn: number }>>,
  startColumn: number,
  endColumn: number,
): number | null {
  for (let lane = 0; lane < MAX_EVENT_LANES; lane += 1) {
    const hasCollision = occupied[lane].some(
      (range) => startColumn <= range.endColumn && range.startColumn <= endColumn,
    );

    if (!hasCollision) {
      occupied[lane].push({ startColumn, endColumn });
      return lane;
    }
  }

  return null;
}

export function daysBetween(startIso: string, endIso: string): number {
  return Math.round(
    (Date.parse(`${endIso}T00:00:00.000Z`) - Date.parse(`${startIso}T00:00:00.000Z`)) / 86_400_000,
  );
}

export function addDays(isoDate: string, days: number): string {
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

export function monthKeyFromIsoDate(value: string): string {
  return value.slice(0, 7);
}

export function localIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function clampInteger(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function formatCountLabel(count: number, label: string, uiLanguage: UiLanguage): string {
  return uiLanguage === "zh" ? `${count}${label}` : `${count} ${label}`;
}

export function formatWishlistCalendarSummary(
  wishlistGameCount: number,
  calendarGameCount: number,
  copy: (typeof UI_COPY)[UiLanguage],
  uiLanguage: UiLanguage,
): string {
  if (uiLanguage === "zh") {
    return `${copy.wishlistGamesPrefix}${wishlistGameCount}${copy.wishlistGamesSuffix}，其中 ${calendarGameCount} 款在日历里`;
  }

  return `${wishlistGameCount} wishlist games, ${calendarGameCount} in calendar`;
}

export function compareSteamEventCategories(
  first: SteamEventCategory,
  second: SteamEventCategory,
): number {
  return STEAM_EVENT_CATEGORIES.indexOf(first) - STEAM_EVENT_CATEGORIES.indexOf(second);
}

function uiLocale(uiLanguage: UiLanguage): string {
  return uiLanguage === "zh" ? "zh-CN" : "en";
}

function formatMonth(value: string, uiLanguage: UiLanguage): string {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(uiLocale(uiLanguage), {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatCalendarMonthTitle(value: string, uiLanguage: UiLanguage): string {
  return formatMonth(value, uiLanguage);
}

export function formatDisplayPrice(
  value: string | undefined,
  uiLanguage: UiLanguage = "en",
): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return formatCurrencyCodePrice(trimmed, uiLocale(uiLanguage)) ?? trimmed;
}

function formatCurrencyCodePrice(value: string, locale: string): string | null {
  const parsedPrice = parseCurrencyCodePrice(value);

  if (!parsedPrice) {
    return null;
  }

  try {
    return new Intl.NumberFormat(locale, {
      currency: parsedPrice.currency,
      style: "currency",
    }).format(parsedPrice.amount);
  } catch {
    return null;
  }
}

function parseCurrencyCodePrice(value: string): { amount: number; currency: string } | null {
  const codeFirst = value.match(/^([A-Z]{3})\s*([\d.,]+)$/);
  const amountFirst = value.match(/^([\d.,]+)\s*([A-Z]{3})$/);
  const currency = codeFirst?.[1] ?? amountFirst?.[2];
  const amountText = codeFirst?.[2] ?? amountFirst?.[1];

  if (!currency || !amountText) {
    return null;
  }

  const amount = Number(amountText.replace(/,/g, ""));

  if (!Number.isFinite(amount)) {
    return null;
  }

  return { amount, currency };
}

type CurrencySource = {
  price?: {
    currency?: string;
    finalFormatted?: string;
    initialFormatted?: string;
  };
};

export function storeRegionCurrencySymbol(
  events: PreviewEvent[] = [],
  priceSources: CurrencySource[] = [],
): string {
  const currentPriceSymbol = inferCurrencySymbolFromPriceSources(priceSources);

  if (currentPriceSymbol) {
    return currentPriceSymbol;
  }

  const actualPriceSymbol = inferCurrencySymbolFromEvents(events);

  if (actualPriceSymbol) {
    return actualPriceSymbol;
  }

  return "";
}

function inferCurrencySymbolFromPriceSources(games: CurrencySource[]): string | null {
  for (const game of games) {
    const symbol =
      inferCurrencySymbol(game.price?.finalFormatted) ??
      inferCurrencySymbol(game.price?.initialFormatted);

    if (symbol) {
      return symbol;
    }
  }

  return games.find((game) => game.price?.currency)?.price?.currency ?? null;
}

function inferCurrencySymbolFromEvents(events: PreviewEvent[]): string | null {
  for (const event of events) {
    const symbol =
      inferCurrencySymbol(event.finalPrice) ?? inferCurrencySymbol(event.originalPrice);

    if (symbol) {
      return symbol;
    }
  }

  return null;
}

function inferCurrencySymbol(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const prefix = trimmed.match(/^([^\d\s.,]+)/)?.[1];

  if (prefix) {
    return prefix;
  }

  return trimmed.match(/([^\d\s.,]+)$/)?.[1] ?? null;
}

export function formatDate(value: string, uiLanguage: UiLanguage = "en"): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(uiLocale(uiLanguage), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatEventDateRange(event: PreviewEvent, uiLanguage: UiLanguage): string {
  if (!event.endDate || event.endDate === event.startDate) {
    return formatDate(event.startDate, uiLanguage);
  }

  return `${formatDate(event.startDate, uiLanguage)} - ${formatDate(event.endDate, uiLanguage)}`;
}

export function formatDetailDateSentence(
  event: PreviewEvent,
  copy: (typeof UI_COPY)[UiLanguage],
  uiLanguage: UiLanguage,
): string {
  if (event.type === "steam_deal" && event.discountStart && event.discountEnd) {
    return `${formatUnixDateTime(event.discountStart, uiLanguage)} ${copy.until} ${formatUnixDateTime(event.discountEnd, uiLanguage)}`;
  }

  if (event.type === "steam_deal" && event.discountEnd) {
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
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  const timeParts = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(date);
  const hour = timeParts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = timeParts.find((part) => part.type === "minute")?.value ?? "00";
  const timeZone = timeParts.find((part) => part.type === "timeZoneName")?.value;

  return `${dateText} ${hour}:${minute}${timeZone ? ` ${timeZone}` : ""}`;
}

export function compareEventsForList(firstEvent: PreviewEvent, secondEvent: PreviewEvent): number {
  const dateComparison = firstEvent.startDate.localeCompare(secondEvent.startDate);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return detailTitle(firstEvent).localeCompare(detailTitle(secondEvent));
}

export function eventVisualClass(event: PreviewEvent): string {
  if (event.type === "steam_deal") {
    return "dealEvent";
  }

  if (event.type === "steam_preorder") {
    return "preorderEvent";
  }

  if (event.type === "wishlist_release") {
    return "preorderEvent";
  }

  if (event.type === "steam_major_event") {
    return "nextFestEvent";
  }

  return "nextFestEvent";
}

export function calendarLegendItems(
  events: PreviewEvent[],
  copy: (typeof UI_COPY)[UiLanguage],
): { className: string; label: string }[] {
  const visibleClasses = new Set(events.map(eventVisualClass));
  const hasPreorders = events.some((event) => event.type === "steam_preorder");
  const hasWishlist = events.some((event) => event.type === "wishlist_release");
  const preorderLabel =
    hasPreorders && hasWishlist
      ? `${copy.preordersLegend} / ${copy.releasesLegend}`
      : hasWishlist
        ? copy.releasesLegend
        : copy.preordersLegend;
  const items = [
    { className: "dealEvent", label: copy.dealsLegend },
    { className: "preorderEvent", label: preorderLabel },
    { className: "nextFestEvent", label: copy.eventsLegend },
  ];

  return items.filter((item) => visibleClasses.has(item.className));
}

export function compactEventTitle(title: string): string {
  return title.replace(/^🎮\s*Steam\s*/, "").replace(/^🎮\s*/, "");
}

export function detailKind(event: PreviewEvent, copy: (typeof UI_COPY)[UiLanguage]): string {
  switch (event.type) {
    case "steam_deal":
    case "steam_preorder":
    case "wishlist_release":
      return copy.trackedGameEventsTitle;
    case "steam_major_event":
      return copy.steamEventsTitle;
  }
}

export function detailTitle(event: PreviewEvent): string {
  if (event.type === "steam_deal" && event.discount) {
    return event.title.replace(`${event.discount} `, "");
  }

  return event.title.replace(/^🎮\s*/, "");
}

export function detailDescription(event: PreviewEvent): string {
  const description = event.description
    .split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line &&
        !line.startsWith("Price:") &&
        !line.startsWith("Release date:") &&
        !line.startsWith("Steam release date:") &&
        !line.startsWith("Status:") &&
        !line.startsWith("Store:") &&
        !/^https?:\/\//.test(line),
    );

  return description || detailTitle(event);
}

export function detailFacts(
  event: PreviewEvent,
  copy: (typeof UI_COPY)[UiLanguage],
  uiLanguage: UiLanguage,
): Array<{ label: string; value: string }> {
  if (!isGameCalendarEvent(event)) {
    return [];
  }

  const facts: Array<{ label: string; value: string }> = [];
  const genres = (event.genres ?? []).filter(Boolean).slice(0, 3);
  if (genres.length) {
    facts.push({ label: copy.genreLabel, value: genres.join(" / ") });
  }

  const rating = formatReviewFact(event, uiLanguage);
  if (rating) {
    facts.push({ label: copy.ratingLabel, value: rating });
  }

  const developers = (event.developers ?? []).filter(Boolean).slice(0, 2);
  if (developers.length) {
    facts.push({ label: copy.developerLabel, value: developers.join(" / ") });
  }

  const publishers = (event.publishers ?? []).filter(Boolean).slice(0, 2);
  if (publishers.length) {
    facts.push({ label: copy.publisherLabel, value: publishers.join(" / ") });
  }

  if (event.releaseDateText) {
    facts.push({ label: copy.releaseDateLabel, value: event.releaseDateText });
  }

  if (event.type === "steam_deal" && event.historicalLowPrice && event.historicalLowDate) {
    facts.push({
      label: copy.historicalLowLabel,
      value: formatHistoricalLowFact(event, uiLanguage),
    });
  } else if (event.type === "steam_deal" && event.discountStart) {
    facts.push({
      label: copy.saleStartedLabel,
      value: formatUnixDateTime(event.discountStart, uiLanguage),
    });
  }

  if (event.type === "steam_deal" && event.saleStore) {
    facts.push({ label: copy.saleStoreLabel, value: event.saleStore });
  }

  if (event.type === "steam_deal" && event.saleStatus) {
    facts.push({
      label: copy.saleStatusLabel,
      value: localizedSaleStatus(event.saleStatus, uiLanguage),
    });
  }

  return facts.slice(0, 6);
}

function formatHistoricalLowFact(event: PreviewEvent, uiLanguage: UiLanguage): string {
  const parts = [
    formatDisplayPrice(event.historicalLowPrice, uiLanguage),
    event.historicalLowDate ? formatDate(event.historicalLowDate, uiLanguage) : null,
    event.historicalLowStore,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" · ");
}

function localizedSaleStatus(status: string, uiLanguage: UiLanguage): string {
  const normalized = status.toLowerCase();

  if (uiLanguage === "zh") {
    if (normalized === "active") {
      return "进行中";
    }

    if (normalized === "finished") {
      return "已结束";
    }
  }

  return status;
}

function formatReviewFact(event: PreviewEvent, uiLanguage: UiLanguage): string | null {
  const parts: string[] = [];
  if (event.reviewSummary) {
    parts.push(event.reviewSummary);
  }

  if (typeof event.reviewPercentage === "number") {
    parts.push(`${event.reviewPercentage}%`);
  }

  if (typeof event.reviewCount === "number" && event.reviewCount > 0) {
    parts.push(formatCompactCount(event.reviewCount, uiLanguage));
  }

  return parts.length ? parts.join(" · ") : null;
}

export function formatSearchReviewFact(
  game: GameSearchResult,
  uiLanguage: UiLanguage,
): string | null {
  const parts: string[] = [];
  if (game.reviewSummary) {
    parts.push(game.reviewSummary);
  }

  if (typeof game.reviewPercentage === "number") {
    parts.push(`${game.reviewPercentage}%`);
  }

  if (typeof game.reviewCount === "number" && game.reviewCount > 0) {
    parts.push(formatCompactCount(game.reviewCount, uiLanguage));
  }

  return parts.length ? parts.join(" · ") : null;
}

function formatCompactCount(value: number, uiLanguage: UiLanguage): string {
  return new Intl.NumberFormat(uiLanguage === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
    notation: "compact",
  }).format(value);
}
