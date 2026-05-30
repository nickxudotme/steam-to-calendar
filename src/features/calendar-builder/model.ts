import type { PreviewEvent } from "@/shared/calendar-preview";
export {
  PUBLIC_PREVIEW,
  type PreviewEvent,
  type PreviewResponse,
  type PreviewWishlistGame as WishlistGame,
} from "@/shared/calendar-preview";

export type GameSearchResult = {
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
  releaseDateText?: string | null;
  storeUrl: string;
};

export type SelectedGame = {
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
  reviewCount?: number;
  reviewPercentage?: number;
  reviewSummary?: string;
  releaseDateText?: string | null;
  storeUrl: string;
};

export type CalendarView = "month" | "list";

export type CalendarCell = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  events: PreviewEvent[];
};

export type CalendarEventSegment = {
  event: PreviewEvent;
  weekIndex: number;
  lane: number;
  startColumn: number;
  endColumn: number;
  startsAtEvent: boolean;
  endsAtEvent: boolean;
};

export type CalendarWeek = {
  weekStartIso: string;
  cells: CalendarCell[];
  segments: CalendarEventSegment[];
};

export const AUTO_TRACKED_GAME_COUNT = 3;
export const MAX_EVENT_LANES = 12;
export const EVENT_PAST_DAYS_MAX = 180;
export const EVENT_FUTURE_DAYS_MAX = 365;
export const INTRO_STORAGE_KEY = "steam-to-calendar-intro-seen";
