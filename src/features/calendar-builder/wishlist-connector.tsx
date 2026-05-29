"use client";

import { Link, X } from "lucide-react";
import type { FormEvent } from "react";
import { formatWishlistCalendarSummary, selectedGameFromWishlistGame } from "./calendar-utils";
import type { PreviewEvent, WishlistGame } from "./model";
import { SteamCliImage } from "./steam-cli-image";
import { UI_COPY, type UiLanguage } from "./ui-copy";

export function WishlistConnector({
  connectedWishlistGames,
  copy,
  error,
  errorCode,
  hasConnectedWishlist,
  isLoading,
  isWishlistImportOpen,
  onDisconnect,
  onGameClick,
  onGamePreview,
  onImportOpen,
  onSearchPreviewClear,
  onSteamIdChange,
  onSubmit,
  previewProfileName,
  selectedGameNoticeAppId,
  sortedEvents,
  steamId64,
  uiLanguage,
  wishlistEventCount,
  wishlistGameCount,
}: {
  connectedWishlistGames: WishlistGame[];
  copy: (typeof UI_COPY)[UiLanguage];
  error: string | null;
  errorCode: string | null;
  hasConnectedWishlist: boolean;
  isLoading: boolean;
  isWishlistImportOpen: boolean;
  onDisconnect: () => void;
  onGameClick: (appId: string) => void;
  onGamePreview: (
    game: ReturnType<typeof selectedGameFromWishlistGame>,
    element: HTMLElement,
  ) => void;
  onImportOpen: () => void;
  onSearchPreviewClear: () => void;
  onSteamIdChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  previewProfileName?: string | null;
  selectedGameNoticeAppId: string | null;
  sortedEvents: PreviewEvent[];
  steamId64: string;
  uiLanguage: UiLanguage;
  wishlistEventCount: number;
  wishlistGameCount: number;
}) {
  return (
    <section className="wishlistTaskCard" id="steam-connect" aria-label="Connect Steam wishlist">
      <div className="taskCardHeader">
        <span className="taskCardBadge">{copy.recommendedLabel}</span>
        <div className="taskCardContent">
          <Link aria-hidden="true" className="linkIcon" />
          <div className="taskCardCopy">
            <h3>{copy.connectWishlistTitle}</h3>
            <p>{copy.connectWishlistDescription}</p>
          </div>
        </div>
      </div>

      {hasConnectedWishlist ? (
        <button className="disconnectWishlistButton" type="button" onClick={onDisconnect}>
          <X aria-hidden="true" className="miniIcon" />
          {copy.disconnectWishlist}
        </button>
      ) : isWishlistImportOpen ? (
        <form
          className="wishlistImport"
          onSubmit={onSubmit}
          aria-label="Import Steam wishlist releases to the calendar"
        >
          <label className="srOnly" htmlFor="steam-id">
            {copy.steamProfilePlaceholder}
          </label>
          <div className="steamInputWrap">
            <input
              id="steam-id"
              inputMode="text"
              placeholder={copy.steamProfilePlaceholder}
              value={steamId64}
              onChange={(event) => onSteamIdChange(event.target.value)}
            />
          </div>
          <button disabled={isLoading} type="submit">
            {isLoading ? copy.importing : copy.importWishlistShort}
          </button>
        </form>
      ) : (
        <button className="connectWishlistButton" type="button" onClick={onImportOpen}>
          {copy.connectWishlistButton}
        </button>
      )}

      {isLoading ? (
        <div className="notice loadingNotice" role="status">
          {copy.importingWishlist}
        </div>
      ) : null}

      {hasConnectedWishlist ? (
        <div className="connectedWishlistSummary">
          <p>
            {copy.connectedSteamUser}{" "}
            <strong>{previewProfileName || copy.connectedSteamUserFallback}</strong>
          </p>
          <p>
            {formatWishlistCalendarSummary(wishlistGameCount, wishlistEventCount, copy, uiLanguage)}
          </p>
        </div>
      ) : (
        <p className="wishlistHint">{copy.wishlistHint}</p>
      )}

      {hasConnectedWishlist && connectedWishlistGames.length ? (
        <div className="selectedGames wishlistGamesList" aria-label={copy.wishlistGamesListLabel}>
          <div className="selectedGamesHeader">
            <span className="miniSectionTitle">
              {copy.wishlistGamesListLabel} ({connectedWishlistGames.length})
            </span>
          </div>
          {connectedWishlistGames.map((game) => {
            const matchingEvent = sortedEvents.find((event) => event.appId === game.appId);
            const displayGame = selectedGameFromWishlistGame(game, matchingEvent);

            return (
              <div className="selectedGameRow wishlistGameRow" key={game.appId}>
                <button
                  className="selectedGameSelect"
                  type="button"
                  onBlur={onSearchPreviewClear}
                  onMouseDown={(event) => event.preventDefault()}
                  onFocus={(event) => onGamePreview(displayGame, event.currentTarget)}
                  onMouseEnter={(event) => onGamePreview(displayGame, event.currentTarget)}
                  onMouseLeave={onSearchPreviewClear}
                  onClick={() => {
                    onSearchPreviewClear();
                    onGameClick(game.appId);
                  }}
                >
                  <SteamCliImage fallbackClassName="gameThumbFallback" src={displayGame.imageUrl} />
                  <span>{game.name}</span>
                </button>
                {selectedGameNoticeAppId === game.appId ? (
                  <div className="selectedGameNotice" role="status">
                    {copy.watchedGamePending}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? <div className="notice error">{error}</div> : null}
      {error ? (
        <div className="notice fallbackNotice">
          {errorCode === "wishlist_private_or_unavailable"
            ? copy.wishlistPrivateHint
            : copy.wishlistGenericHint}
        </div>
      ) : null}
    </section>
  );
}
