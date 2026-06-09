"use client";

import { CircleHelp, Link, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatedSizePresence } from "./animated-size-presence";
import {
  formatWishlistCalendarSummary,
  selectedGameFromWishlistGame,
  watchedGamePendingMessage,
} from "./calendar-utils";
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
  todayIso,
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
  todayIso: string;
  uiLanguage: UiLanguage;
  wishlistEventCount: number;
  wishlistGameCount: number;
}) {
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isProfileHelpOpen, setIsProfileHelpOpen] = useState(false);
  const [profileHelpStyle, setProfileHelpStyle] = useState<CSSProperties>({});
  const [profileHelpPlacement, setProfileHelpPlacement] = useState<"bottom" | "right" | "top">(
    "right",
  );
  const isProfileHelpVisible = isProfileHelpOpen && isWishlistImportOpen && !hasConnectedWishlist;

  function canUseHoverHelp() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  const openProfileHelp = useCallback(() => {
    const buttonRect = helpButtonRef.current?.getBoundingClientRect();
    if (!buttonRect) {
      return;
    }

    const viewportPadding = 12;
    const shouldUseBottomPlacement = window.innerWidth < 720;
    const popoverWidth = shouldUseBottomPlacement
      ? window.innerWidth - viewportPadding * 2
      : Math.min(460, window.innerWidth - viewportPadding * 2);
    const mobileEstimatedHeight = 320;
    const mobileHasBottomSpace =
      window.innerHeight - buttonRect.bottom - viewportPadding >= mobileEstimatedHeight;
    const mobileTop = mobileHasBottomSpace
      ? buttonRect.bottom + 8
      : Math.max(viewportPadding, buttonRect.top - mobileEstimatedHeight - 8);
    const left = Math.min(buttonRect.right + 8, window.innerWidth - popoverWidth - viewportPadding);

    setProfileHelpStyle({
      left: shouldUseBottomPlacement ? viewportPadding : left,
      top: shouldUseBottomPlacement ? mobileTop : buttonRect.top + buttonRect.height / 2,
      width: popoverWidth,
    });
    setProfileHelpPlacement(
      shouldUseBottomPlacement ? (mobileHasBottomSpace ? "bottom" : "top") : "right",
    );
    setIsProfileHelpOpen(true);
  }, []);

  const profileHelpPopover = (
    <div
      className="steamProfileHelpPopover"
      data-open={isProfileHelpVisible}
      data-placement={profileHelpPlacement}
      id="steam-profile-help"
      role="tooltip"
      style={profileHelpStyle}
    >
      <div className="steamProfileHelpArt" aria-hidden="true">
        <div className="steamProfileTopBar">
          {copy.steamProfileHelpSteamNav
            .trim()
            .split(/\s+/)
            .map((item) => (
              <span className="steamProfileNavItem" key={item}>
                {item}
              </span>
            ))}
          <span className="steamProfileUserName">{copy.steamProfileHelpUserName}</span>
          <span className="steamProfileStepBadge steamProfileStepBadgeName">
            {copy.steamProfileHelpClickHere}
          </span>
        </div>
        <div className="steamProfileAddress">
          <span>{copy.steamProfileHelpExampleId}</span>
        </div>
        <div className="steamProfileAddressCallout">{copy.steamProfileHelpAddressLabel}</div>
      </div>
      <strong>{copy.steamProfileHelpTitle}</strong>
      <p>{copy.steamProfileHelpBody}</p>
      <code>{copy.steamProfileHelpExampleProfiles}</code>
      <code>{copy.steamProfileHelpExampleId}</code>
    </div>
  );

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => setHasMounted(true));

    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <>
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

        <div
          className="wishlistActionRegion"
          data-mode={
            hasConnectedWishlist ? "connected" : isWishlistImportOpen ? "import" : "connect"
          }
        >
          {hasConnectedWishlist ? (
            <button className="disconnectWishlistButton" type="button" onClick={onDisconnect}>
              <X aria-hidden="true" className="miniIcon" />
              {copy.disconnectWishlist}
            </button>
          ) : isWishlistImportOpen ? (
            <form
              className="wishlistImport"
              onSubmit={(event) => {
                setIsProfileHelpOpen(false);
                onSubmit(event);
              }}
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
                <button
                  aria-describedby="steam-profile-help"
                  aria-expanded={isProfileHelpVisible}
                  aria-label={copy.steamProfileHelpLabel}
                  aria-controls="steam-profile-help"
                  className="steamProfileHelpButton"
                  onBlur={() => setIsProfileHelpOpen(false)}
                  onFocus={() => {
                    if (canUseHoverHelp()) {
                      openProfileHelp();
                    }
                  }}
                  onClick={() => {
                    if (canUseHoverHelp()) {
                      return;
                    }

                    if (isProfileHelpOpen) {
                      setIsProfileHelpOpen(false);
                    } else {
                      openProfileHelp();
                    }
                  }}
                  onPointerEnter={() => {
                    if (canUseHoverHelp()) {
                      openProfileHelp();
                    }
                  }}
                  onPointerLeave={() => {
                    if (canUseHoverHelp()) {
                      setIsProfileHelpOpen(false);
                    }
                  }}
                  onPointerDown={(event) => {
                    if (canUseHoverHelp()) {
                      event.preventDefault();
                    }
                  }}
                  ref={helpButtonRef}
                  type="button"
                >
                  <CircleHelp aria-hidden="true" size={16} strokeWidth={2.2} />
                </button>
              </div>
              <button disabled={isLoading} type="submit">
                {isLoading ? copy.importing : copy.importWishlistShort}
              </button>
              <p className="steamProfileInputHint">{copy.steamProfileAcceptedInputs}</p>
            </form>
          ) : (
            <button className="connectWishlistButton" type="button" onClick={onImportOpen}>
              {copy.connectWishlistButton}
            </button>
          )}
        </div>

        <AnimatedSizePresence id="wishlist-loading" marginTop={8} visible={isLoading}>
          <div className="notice loadingNotice wishlistAnimatedBlock" role="status">
            {copy.importingWishlist}
          </div>
        </AnimatedSizePresence>

        <AnimatedSizePresence id="wishlist-summary" marginTop={8} visible={hasConnectedWishlist}>
          <div className="connectedWishlistSummary wishlistAnimatedBlock">
            <p>
              {copy.connectedSteamUser}{" "}
              <strong>{previewProfileName || copy.connectedSteamUserFallback}</strong>
            </p>
            <p>
              {formatWishlistCalendarSummary(
                wishlistGameCount,
                wishlistEventCount,
                copy,
                uiLanguage,
              )}
            </p>
          </div>
        </AnimatedSizePresence>

        <AnimatedSizePresence id="wishlist-hint" marginTop={8} visible={!hasConnectedWishlist}>
          <p className="wishlistHint wishlistAnimatedBlock">{copy.wishlistHint}</p>
        </AnimatedSizePresence>

        <AnimatedSizePresence
          id="wishlist-games"
          marginTop={8}
          visible={hasConnectedWishlist && connectedWishlistGames.length > 0}
        >
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
                    <SteamCliImage
                      fallbackClassName="gameThumbFallback"
                      src={displayGame.imageUrl}
                    />
                    <span>{game.name}</span>
                  </button>
                  {selectedGameNoticeAppId === game.appId ? (
                    <div className="selectedGameNotice" role="status">
                      {watchedGamePendingMessage(displayGame, copy, todayIso)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </AnimatedSizePresence>

        <AnimatedSizePresence id="wishlist-error" marginTop={8} visible={Boolean(error)}>
          <div className="notice error wishlistAnimatedBlock">
            {wishlistErrorMessage(error, errorCode, copy)}
          </div>
        </AnimatedSizePresence>
        <AnimatedSizePresence id="wishlist-fallback" marginTop={8} visible={Boolean(error)}>
          <div className="notice fallbackNotice wishlistAnimatedBlock">
            {wishlistFallbackMessage(errorCode, copy)}
          </div>
        </AnimatedSizePresence>
      </section>
      {hasMounted ? createPortal(profileHelpPopover, document.body) : null}
    </>
  );
}

function wishlistErrorMessage(
  error: string | null,
  errorCode: string | null,
  copy: (typeof UI_COPY)[UiLanguage],
): string {
  if (errorCode === "invalid_steam_id") {
    return copy.wishlistInvalidInputError;
  }

  if (errorCode === "fetch_failed") {
    return copy.wishlistFetchFailedError;
  }

  if (errorCode === "wishlist_rate_limited") {
    return copy.wishlistRateLimitedError;
  }

  return error ?? copy.wishlistGenericHint;
}

function wishlistFallbackMessage(
  errorCode: string | null,
  copy: (typeof UI_COPY)[UiLanguage],
): string {
  if (errorCode === "invalid_steam_id") {
    return copy.wishlistInvalidInputHint;
  }

  if (errorCode === "fetch_failed") {
    return copy.wishlistFetchFailedHint;
  }

  if (errorCode === "wishlist_private_or_unavailable") {
    return copy.wishlistPrivateHint;
  }

  if (errorCode === "wishlist_rate_limited") {
    return copy.wishlistRateLimitedHint;
  }

  return copy.wishlistGenericHint;
}
