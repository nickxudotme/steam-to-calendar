import { describe, expect, it } from "vitest";
import {
  buildContinuousCalendarWeeks,
  buildEventWeekRange,
  chooseCalendarFocusDate,
  chooseCurrentGameEvent,
  chooseEventFocusDate,
  detailFacts,
  detailTitle,
  selectedGameFromEvent,
  eventOccursOn,
  shouldLoadDefaultDealPreview,
  storeRegionCurrencySymbol,
  watchedGamePendingMessage,
} from "./calendar-utils";
import type { PreviewEvent } from "./model";
import { UI_COPY } from "./ui-copy";

function previewEvent(overrides: Partial<PreviewEvent> = {}): PreviewEvent {
  return {
    id: "event-1",
    title: "Steam Next Fest",
    description: "Playable demos.",
    startDate: "2026-06-08",
    type: "steam_major_event",
    ...overrides,
  };
}

describe("calendar builder utilities", () => {
  it("treats event end dates as exclusive", () => {
    const event = previewEvent({
      startDate: "2026-06-08",
      endDate: "2026-06-15",
    });

    expect(eventOccursOn(event, "2026-06-07")).toBe(false);
    expect(eventOccursOn(event, "2026-06-08")).toBe(true);
    expect(eventOccursOn(event, "2026-06-14")).toBe(true);
    expect(eventOccursOn(event, "2026-06-15")).toBe(false);
  });

  it("builds a one-week range around today when there are no events", () => {
    expect(buildEventWeekRange([], "2026-05-27")).toEqual({
      startIso: "2026-05-24",
      endIso: "2026-05-31",
    });
  });

  it("focuses active events before upcoming events", () => {
    const events = [
      previewEvent({
        id: "future",
        startDate: "2026-06-20",
      }),
      previewEvent({
        id: "active",
        startDate: "2026-05-20",
        endDate: "2026-05-30",
      }),
    ];

    expect(chooseCalendarFocusDate(events, "2026-05-27")).toBe("2026-05-27");
  });

  it("selects the current game event before older events", () => {
    const events = [
      previewEvent({
        appId: "620",
        id: "past-deal",
        startDate: "2026-04-10",
        title: "-20% Portal 2",
        type: "steam_deal",
      }),
      previewEvent({
        appId: "620",
        id: "upcoming-deal",
        startDate: "2026-06-10",
        title: "-80% Portal 2",
        type: "steam_deal",
      }),
      previewEvent({
        appId: "264710",
        id: "other-game",
        startDate: "2026-05-31",
        title: "-50% Subnautica",
        type: "steam_deal",
      }),
    ];

    expect(chooseCurrentGameEvent(events, "620", "2026-05-30")?.id).toBe("upcoming-deal");
  });

  it("selects an active game event before a future event", () => {
    const events = [
      previewEvent({
        appId: "620",
        endDate: "2026-06-03",
        id: "active-deal",
        startDate: "2026-05-28",
        title: "-20% Portal 2",
        type: "steam_deal",
      }),
      previewEvent({
        appId: "620",
        id: "future-deal",
        startDate: "2026-06-10",
        title: "-80% Portal 2",
        type: "steam_deal",
      }),
    ];

    expect(chooseCurrentGameEvent(events, "620", "2026-05-30")?.id).toBe("active-deal");
  });

  it("focuses selected past events on their actual start date", () => {
    expect(
      chooseEventFocusDate(
        previewEvent({
          endDate: "2026-05-01",
          startDate: "2026-04-30",
        }),
        "2026-05-30",
      ),
    ).toBe("2026-04-30");
    expect(
      chooseEventFocusDate(
        previewEvent({
          endDate: "2026-06-03",
          startDate: "2026-05-28",
        }),
        "2026-05-30",
      ),
    ).toBe("2026-05-30");
  });

  it("does not reload default deals after the user clears tracked games", () => {
    expect(
      shouldLoadDefaultDealPreview({
        hasConnectedWishlist: false,
        hasEditedSelectedGames: false,
        selectedGameCount: 0,
        showMyGames: true,
      }),
    ).toBe(true);

    expect(
      shouldLoadDefaultDealPreview({
        hasConnectedWishlist: false,
        hasEditedSelectedGames: true,
        selectedGameCount: 0,
        showMyGames: true,
      }),
    ).toBe(false);
  });

  it("maps spanning events into weekly calendar segments", () => {
    const event = previewEvent({
      startDate: "2026-06-12",
      endDate: "2026-06-16",
    });

    const weeks = buildContinuousCalendarWeeks([event], "2026-06-07", "2026-06-21");

    expect(weeks).toHaveLength(2);
    expect(weeks[0].segments[0]).toMatchObject({
      event,
      lane: 0,
      startColumn: 5,
      endColumn: 6,
      startsAtEvent: true,
      endsAtEvent: false,
    });
    expect(weeks[1].segments[0]).toMatchObject({
      event,
      lane: 0,
      startColumn: 0,
      endColumn: 1,
      startsAtEvent: false,
      endsAtEvent: true,
    });
  });

  it("infers currency symbols from actual event prices before region fallbacks", () => {
    expect(
      storeRegionCurrencySymbol("US", [
        previewEvent({
          finalPrice: "HK$ 198.00",
        }),
      ]),
    ).toBe("HK$");
    expect(storeRegionCurrencySymbol("CN")).toBe("¥");
  });

  it("normalizes detail titles for discounts and game icons", () => {
    expect(
      detailTitle(
        previewEvent({
          title: "-20% Subnautica",
          discount: "-20%",
          type: "steam_deal",
        }),
      ),
    ).toBe("Subnautica");
    expect(detailTitle(previewEvent({ title: "🎮 Hades II releases" }))).toBe("Hades II releases");
  });

  it("shows historical low facts before sale start timestamps", () => {
    expect(
      detailFacts(
        previewEvent({
          appId: "264710",
          dataSource: "steam_history",
          discountStart: 1779900000,
          historicalLowDate: "2024-11-27",
          historicalLowPrice: "$5.99",
          historicalLowStore: "Steam",
          type: "steam_deal",
        }),
        UI_COPY.en,
        "en",
      ),
    ).toContainEqual({
      label: "Historical low",
      value: "$5.99 · Nov 27, 2024 · Steam",
    });
  });

  it("keeps rich event metadata when seeding selected games", () => {
    expect(
      selectedGameFromEvent(
        previewEvent({
          appId: "620",
          developers: ["Valve"],
          discount: "-80%",
          finalPrice: "$1.99",
          genres: ["Puzzle", "Co-op"],
          imageUrl: "https://cdn.example.test/portal-2.jpg",
          originalPrice: "$9.99",
          publishers: ["Valve"],
          reviewCount: 1000,
          reviewPercentage: 98,
          reviewSummary: "Overwhelmingly Positive",
          releaseDateText: "Apr 18, 2011",
          sourceUrl: "https://store.steampowered.com/app/620/",
          title: "-80% Portal 2",
          type: "steam_deal",
        }),
      ),
    ).toEqual({
      appId: "620",
      developers: ["Valve"],
      genres: ["Puzzle", "Co-op"],
      imageUrl: "https://cdn.example.test/portal-2.jpg",
      name: "Portal 2",
      price: {
        discountPercent: 80,
        finalFormatted: "$1.99",
        initialFormatted: "$9.99",
      },
      publishers: ["Valve"],
      reviewCount: 1000,
      reviewPercentage: 98,
      reviewSummary: "Overwhelmingly Positive",
      releaseDateText: "Apr 18, 2011",
      storeUrl: "https://store.steampowered.com/app/620/",
    });
  });

  it("tailors pending tracked-game copy to release status", () => {
    expect(
      watchedGamePendingMessage({ releaseDateText: "Apr 18, 2011" }, UI_COPY.en, "2026-05-30"),
    ).toBe(UI_COPY.en.watchedReleasedGamePending);
    expect(
      watchedGamePendingMessage({ releaseDateText: "Coming soon" }, UI_COPY.zh, "2026-05-30"),
    ).toBe(UI_COPY.zh.watchedUnreleasedGamePending);
    expect(
      watchedGamePendingMessage(
        { releaseDateText: "2025 年 5 月 25 日" },
        UI_COPY.zh,
        "2026-05-30",
      ),
    ).toBe(UI_COPY.zh.watchedReleasedGamePending);
    expect(watchedGamePendingMessage({}, UI_COPY.en, "2026-05-30")).toBe(
      UI_COPY.en.watchedGamePending,
    );
  });
});
