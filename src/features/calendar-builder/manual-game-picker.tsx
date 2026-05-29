"use client";

import { Pencil, Search } from "lucide-react";
import type { FormEvent } from "react";
import { SearchResultPrice } from "./game-search-preview-card";
import type { GameSearchResult, SelectedGame } from "./model";
import { SteamCliImage } from "./steam-cli-image";
import { UI_COPY, type UiLanguage } from "./ui-copy";

export function ManualGamePicker({
  copy,
  gameSearch,
  gameSearchError,
  gameSearchResults,
  hasConnectedWishlist,
  isPreviewLoading,
  isSearchingGames,
  lastGameSearchQuery,
  onAddGame,
  onGameClick,
  onGamePreview,
  onGameSearchChange,
  onRemoveGame,
  onSearchPreviewClear,
  onSubmit,
  recentlyAddedAppId,
  selectedGameNoticeAppId,
  selectedGames,
  showMyGames,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  gameSearch: string;
  gameSearchError: string | null;
  gameSearchResults: GameSearchResult[];
  hasConnectedWishlist: boolean;
  isPreviewLoading: boolean;
  isSearchingGames: boolean;
  lastGameSearchQuery: string;
  onAddGame: (game: GameSearchResult) => void;
  onGameClick: (appId: string) => void;
  onGamePreview: (game: GameSearchResult | SelectedGame, element: HTMLElement) => void;
  onGameSearchChange: (value: string) => void;
  onRemoveGame: (appId: string) => void;
  onSearchPreviewClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  recentlyAddedAppId: string | null;
  selectedGameNoticeAppId: string | null;
  selectedGames: SelectedGame[];
  showMyGames: boolean;
}) {
  return (
    <div className="myGamesBlock">
      <div className="sourceTitleRow">
        <Pencil aria-hidden="true" className="sourceIcon" />
        <div>
          <h3>{copy.manualGamesTitle}</h3>
          <p>{copy.manualGamesDescription}</p>
        </div>
      </div>

      <form className="gameSearchForm" onSubmit={onSubmit}>
        <label className="searchBox" htmlFor="game-search">
          <span className="srOnly">Search Steam games</span>
          <Search aria-hidden="true" className="miniIcon" />
          <input
            disabled={!showMyGames || hasConnectedWishlist}
            id="game-search"
            placeholder={copy.searchPlaceholder}
            type="search"
            value={gameSearch}
            onChange={(event) => onGameSearchChange(event.target.value)}
          />
        </label>
        <button
          disabled={!showMyGames || hasConnectedWishlist || isSearchingGames || !gameSearch.trim()}
          type="submit"
        >
          {isSearchingGames ? copy.searchingButton : copy.searchButton}
        </button>
      </form>

      {hasConnectedWishlist ? (
        <div className="notice wishlistNotice">{copy.wishlistConnected}</div>
      ) : null}

      {isPreviewLoading && !hasConnectedWishlist ? (
        <div className="notice loadingNotice" role="status">
          {copy.syncingPreview}
        </div>
      ) : null}

      {gameSearchError ? <div className="notice error">{gameSearchError}</div> : null}

      {isSearchingGames ? <GameSearchSkeleton /> : null}
      {!isSearchingGames && gameSearchResults.length ? (
        <GameSearchResults
          copy={copy}
          gameSearchResults={gameSearchResults}
          hasConnectedWishlist={hasConnectedWishlist}
          onAddGame={onAddGame}
          onGamePreview={onGamePreview}
          onSearchPreviewClear={onSearchPreviewClear}
          selectedGames={selectedGames}
        />
      ) : null}

      {!isSearchingGames && lastGameSearchQuery && !gameSearchResults.length && !gameSearchError ? (
        <div className="notice gameSearchEmpty" role="status">
          <strong>{copy.noSearchResults}</strong>
          <span>{lastGameSearchQuery}</span>
        </div>
      ) : null}

      {!hasConnectedWishlist && selectedGames.length ? (
        <SelectedGamesList
          copy={copy}
          onGameClick={onGameClick}
          onGamePreview={onGamePreview}
          onRemoveGame={onRemoveGame}
          onSearchPreviewClear={onSearchPreviewClear}
          recentlyAddedAppId={recentlyAddedAppId}
          selectedGameNoticeAppId={selectedGameNoticeAppId}
          selectedGames={selectedGames}
        />
      ) : null}
    </div>
  );
}

function GameSearchSkeleton() {
  return (
    <div className="gameSearchResults" aria-label="Steam game search loading results" role="status">
      {[0, 1, 2].map((index) => (
        <div className="gameSearchResult skeletonResult" key={index}>
          <span className="skeletonThumb" />
          <div>
            <span className="skeletonLine wide" />
            <span className="skeletonLine narrow" />
          </div>
          <span className="skeletonButton" />
        </div>
      ))}
    </div>
  );
}

function GameSearchResults({
  copy,
  gameSearchResults,
  hasConnectedWishlist,
  onAddGame,
  onGamePreview,
  onSearchPreviewClear,
  selectedGames,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  gameSearchResults: GameSearchResult[];
  hasConnectedWishlist: boolean;
  onAddGame: (game: GameSearchResult) => void;
  onGamePreview: (game: GameSearchResult, element: HTMLElement) => void;
  onSearchPreviewClear: () => void;
  selectedGames: SelectedGame[];
}) {
  return (
    <div className="gameSearchResults" aria-label="Steam game search results">
      <div className="gameSearchResultsHeader">
        <span className="miniSectionTitle">{copy.searchResultsTitle}</span>
        <span>
          {gameSearchResults.length} {copy.searchResultsCount}
        </span>
      </div>
      {gameSearchResults.map((game) => {
        const isSelected = selectedGames.some((selectedGame) => selectedGame.appId === game.appId);

        return (
          <button
            aria-label={isSelected ? `${game.name}, ${copy.added}` : game.name}
            className={isSelected ? "gameSearchResult isSelected" : "gameSearchResult"}
            disabled={hasConnectedWishlist || isSelected}
            key={game.appId}
            type="button"
            onBlur={onSearchPreviewClear}
            onFocus={(event) => onGamePreview(game, event.currentTarget)}
            onMouseEnter={(event) => onGamePreview(game, event.currentTarget)}
            onMouseLeave={onSearchPreviewClear}
            onClick={() => onAddGame(game)}
          >
            <SteamCliImage fallbackClassName="gameThumbFallback" src={game.imageUrl} />
            <div className="gameSearchResultInfo">
              <strong>{game.name}</strong>
              <SearchResultPrice game={game} copy={copy} />
            </div>
            {isSelected ? <span className="searchResultStatus">{copy.added}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function SelectedGamesList({
  copy,
  onGameClick,
  onGamePreview,
  onRemoveGame,
  onSearchPreviewClear,
  recentlyAddedAppId,
  selectedGameNoticeAppId,
  selectedGames,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  onGameClick: (appId: string) => void;
  onGamePreview: (game: SelectedGame, element: HTMLElement) => void;
  onRemoveGame: (appId: string) => void;
  onSearchPreviewClear: () => void;
  recentlyAddedAppId: string | null;
  selectedGameNoticeAppId: string | null;
  selectedGames: SelectedGame[];
}) {
  return (
    <div className="selectedGames" aria-label="Games added to calendar">
      <div className="selectedGamesHeader">
        <span className="miniSectionTitle">
          {copy.addedGamesLabel} ({selectedGames.length})
        </span>
      </div>
      {selectedGames.map((game) => (
        <div
          className={
            game.appId === recentlyAddedAppId ? "selectedGameRow isNewlyAdded" : "selectedGameRow"
          }
          key={game.appId}
        >
          <button
            className="selectedGameSelect"
            type="button"
            onBlur={onSearchPreviewClear}
            onMouseDown={(event) => event.preventDefault()}
            onFocus={(event) => onGamePreview(game, event.currentTarget)}
            onMouseEnter={(event) => onGamePreview(game, event.currentTarget)}
            onMouseLeave={onSearchPreviewClear}
            onClick={() => {
              onSearchPreviewClear();
              onGameClick(game.appId);
            }}
          >
            <SteamCliImage fallbackClassName="gameThumbFallback" src={game.imageUrl} />
            <span>{game.name}</span>
          </button>
          <button
            aria-label={`${copy.remove} ${game.name}`}
            className="selectedGameRemove"
            type="button"
            onClick={() => onRemoveGame(game.appId)}
          >
            x
          </button>
          {selectedGameNoticeAppId === game.appId ? (
            <div className="selectedGameNotice" role="status">
              {copy.watchedGamePending}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
