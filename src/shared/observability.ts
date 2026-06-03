export const CALENDAR_SUBSCRIBE_CLICKED_EVENT = "calendar_subscribe_clicked";
export const GAME_SEARCH_COMPLETED_EVENT = "game_search_completed";
export const GAME_SEARCH_FAILED_EVENT = "game_search_failed";
export const GAME_SEARCH_SUBMITTED_EVENT = "game_search_submitted";
export const MANUAL_GAME_ADDED_EVENT = "manual_game_added";
export const MANUAL_GAME_REMOVED_EVENT = "manual_game_removed";
export const PREVIEW_LOAD_FAILED_EVENT = "preview_load_failed";
export const SOURCE_MODE_CHANGED_EVENT = "source_mode_changed";
export const SUBSCRIPTION_LINK_COPIED_EVENT = "subscription_link_copied";
export const SUBSCRIPTION_LINK_COPY_FAILED_EVENT = "subscription_link_copy_failed";
export const WISHLIST_CONNECTED_EVENT = "wishlist_connected";
export const WISHLIST_CONNECT_FAILED_EVENT = "wishlist_connect_failed";
export const WISHLIST_CONNECT_SUBMITTED_EVENT = "wishlist_connect_submitted";
export const WISHLIST_DISCONNECTED_EVENT = "wishlist_disconnected";

export type SourceMode = "manual" | "public" | "wishlist";

export type CalendarSubscribeAnalyticsProperties = {
  eventCount: number;
  source: string;
  trackedGameCount: number;
  usesWishlist: boolean;
};

export type SubscriptionLinkCopiedAnalyticsProperties = CalendarSubscribeAnalyticsProperties & {
  copyMethod: "clipboard";
};

export type GameSearchAnalyticsProperties = {
  queryLength: number;
  region: string;
  resultCount: number;
};

export type GameSearchSubmittedAnalyticsProperties = Omit<
  GameSearchAnalyticsProperties,
  "resultCount"
>;

export type GameSearchFailedAnalyticsProperties = GameSearchSubmittedAnalyticsProperties & {
  errorName: string;
};

export type ManualGameAnalyticsProperties = {
  selectedGameCount: number;
};

export type PreviewLoadFailedAnalyticsProperties = {
  errorName: string;
  region: string;
  route: string;
};

export type SourceModeChangedAnalyticsProperties = {
  sourceMode: SourceMode;
};

export type WishlistConnectSubmittedAnalyticsProperties = {
  inputLength: number;
  locale: string;
  region: string;
};

export type WishlistConnectFailedAnalyticsProperties =
  WishlistConnectSubmittedAnalyticsProperties & {
    errorName: string;
  };

export type WishlistConnectedAnalyticsProperties = {
  appDetails: number;
  eventCount: number;
  locale: string;
  region: string;
  skippedAppIds: number;
  steamMajorEvents: number;
  wishlistGames: number;
  wishlistReleaseEvents: number;
};
