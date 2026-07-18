import { SteamWishlistError, type SteamWishlistErrorCode } from "@/integrations/steam/client";

export type SteamApiErrorPayload = {
  code: SteamWishlistErrorCode | "unknown_error";
  message: string;
  profileSettingsUrl?: string;
};

export function steamApiErrorResponse(error: unknown, fallbackMessage: string): Response {
  const payload = steamApiErrorPayload(error, fallbackMessage);

  return Response.json(payload, { status: steamApiErrorStatus(payload.code) });
}

export function steamApiErrorPayload(
  error: unknown,
  fallbackMessage: string,
): SteamApiErrorPayload {
  if (error instanceof SteamWishlistError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.recovery?.profileSettingsUrl
        ? { profileSettingsUrl: error.recovery.profileSettingsUrl }
        : {}),
    };
  }

  return {
    code: "unknown_error",
    message: fallbackMessage,
  };
}

export function steamApiErrorStatus(code: SteamApiErrorPayload["code"]): number {
  switch (code) {
    case "invalid_steam_id":
      return 400;
    case "wishlist_private_or_unavailable":
      return 404;
    case "wishlist_rate_limited":
      return 429;
    case "fetch_failed":
      return 503;
    case "wishlist_parse_failed":
    case "app_details_parse_failed":
    case "app_details_unavailable":
    case "unknown_error":
      return 502;
  }
}
