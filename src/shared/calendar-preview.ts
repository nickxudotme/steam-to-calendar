import type { SteamEventCategory } from "@/domain/calendar/config";
import { STEAM_EVENTS_CALENDAR_ID } from "@/domain/calendar/constants";

export type PreviewEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  sourceUrl?: string;
  type: "wishlist_release" | "steam_major_event" | "steam_deal" | "steam_preorder";
  dataSource?: "steam_history" | "steam_store" | "steam_events";
  appId?: string;
  imageUrl?: string;
  discount?: string;
  originalPrice?: string;
  finalPrice?: string;
  releaseTime?: number;
  discountEnd?: number;
  discountStart?: number;
  historicalLowDate?: string;
  historicalLowPrice?: string;
  historicalLowStore?: string;
  saleStatus?: string;
  saleStore?: string;
  genres?: string[];
  reviewSummary?: string;
  reviewPercentage?: number;
  reviewCount?: number;
  developers?: string[];
  publishers?: string[];
  releaseDateText?: string | null;
  eventCategory?: SteamEventCategory;
};

export type PreviewWishlistGame = {
  appId: string;
  developers?: string[];
  genres?: string[];
  name: string;
  imageUrl?: string;
  price?: {
    discountPercent: number;
    finalFormatted?: string;
    initialFormatted?: string;
  };
  publishers?: string[];
  releaseDateText: string | null;
  reviewCount?: number;
  reviewPercentage?: number;
  reviewSummary?: string;
  storeUrl: string;
};

export type PreviewResponse = {
  steamId64: string;
  feedPath: string;
  calendarPath: string;
  wishlistUrl: string;
  profileName?: string | null;
  wishlistGames?: PreviewWishlistGame[];
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
    priceHistoryEvents?: number;
    skippedWatchedAppIds?: number;
    storeFallbackEvents?: number;
  };
  events: PreviewEvent[];
};

export const PUBLIC_PREVIEW: PreviewResponse = {
  steamId64: STEAM_EVENTS_CALENDAR_ID,
  feedPath: `/feed/${STEAM_EVENTS_CALENDAR_ID}.ics`,
  calendarPath: `/cal/${STEAM_EVENTS_CALENDAR_ID}`,
  wishlistUrl: "",
  profileName: null,
  wishlistGames: [],
  stats: {
    wishlistGames: 0,
    appDetails: 0,
    skippedAppIds: 0,
    wishlistReleaseEvents: 0,
    steamMajorEvents: 0,
  },
  events: [],
};
