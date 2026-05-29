"use client";

import { formatSearchReviewFact } from "./calendar-utils";
import type { GameSearchResult } from "./model";
import { SteamCliImage } from "./steam-cli-image";
import { UI_COPY, type UiLanguage } from "./ui-copy";

export function GameSearchPreviewCard({
  copy,
  preview,
  uiLanguage,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  preview: { game: GameSearchResult; left: number; top: number } | null;
  uiLanguage: UiLanguage;
}) {
  if (!preview) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="gameSearchPreview"
      style={{ left: preview.left, top: preview.top }}
    >
      <span className="gameSearchPreviewMedia">
        <SteamCliImage fallbackClassName="gameSearchPreviewFallback" src={preview.game.imageUrl} />
      </span>
      <span className="gameSearchPreviewBody">
        <strong>{preview.game.name}</strong>
        <SearchResultPrice game={preview.game} copy={copy} />
        <SearchPreviewFacts copy={copy} game={preview.game} uiLanguage={uiLanguage} />
      </span>
    </div>
  );
}

function SearchPreviewFacts({
  copy,
  game,
  uiLanguage,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  game: GameSearchResult;
  uiLanguage: UiLanguage;
}) {
  const facts: Array<{ label: string; value: string }> = [];
  const genres = (game.genres ?? []).filter(Boolean).slice(0, 2);
  if (genres.length) {
    facts.push({ label: copy.genreLabel, value: genres.join(" / ") });
  }

  const rating = formatSearchReviewFact(game, uiLanguage);
  if (rating) {
    facts.push({ label: copy.ratingLabel, value: rating });
  }

  if (!facts.length) {
    return null;
  }

  return (
    <span className="gameSearchPreviewFacts">
      {facts.map((fact) => (
        <span className="gameSearchPreviewFact" key={fact.label}>
          <span>{fact.label}</span>
          <strong>{fact.value}</strong>
        </span>
      ))}
    </span>
  );
}

export function SearchResultPrice({
  copy,
  game,
}: {
  copy: Record<string, string>;
  game: GameSearchResult;
}) {
  if (!game.price) {
    return <span className="searchResultPrice mutedPrice">{copy.priceUnavailable}</span>;
  }

  return (
    <span className="searchResultPrice">
      {game.price.discountPercent > 0 ? <strong>-{game.price.discountPercent}%</strong> : null}
      <span>{game.price.finalFormatted || copy.priceUnavailable}</span>
      {game.price.initialFormatted && game.price.discountPercent > 0 ? (
        <del>{game.price.initialFormatted}</del>
      ) : null}
    </span>
  );
}
