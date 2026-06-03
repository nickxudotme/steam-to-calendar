export const CALENDAR_SUBSCRIBE_CLICKED_EVENT = "calendar_subscribe_clicked";
export const GAME_SEARCH_COMPLETED_EVENT = "game_search_completed";
export const MANUAL_GAME_ADDED_EVENT = "manual_game_added";
export const MANUAL_GAME_REMOVED_EVENT = "manual_game_removed";
export const SUBSCRIPTION_LINK_COPIED_EVENT = "subscription_link_copied";
export const WISHLIST_CONNECTED_EVENT = "wishlist_connected";

export type CalendarSubscribeAnalyticsProperties = {
  eventCount: number;
  source: string;
  trackedGameCount: number;
  usesWishlist: boolean;
};

export type SubscriptionLinkCopiedAnalyticsProperties = CalendarSubscribeAnalyticsProperties & {
  didCopy: boolean;
};

export type GameSearchAnalyticsProperties = {
  queryLength: number;
  region: string;
  resultCount: number;
};

export type ManualGameAnalyticsProperties = {
  selectedGameCount: number;
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
