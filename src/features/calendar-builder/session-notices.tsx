"use client";

import type { SelectedGame } from "./model";
import { UI_COPY, type UiLanguage } from "./ui-copy";

export function UndoAddToast({
  copy,
  game,
  onUndo,
  uiLanguage,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  game: SelectedGame | null;
  onUndo: (appId: string) => void;
  uiLanguage: UiLanguage;
}) {
  if (!game) {
    return null;
  }

  const message =
    uiLanguage === "zh"
      ? `${game.name} ${copy.addedToast}`
      : `${game.name} ${copy.addedToast.toLowerCase()}`;

  return (
    <div className="undoToast" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" onClick={() => onUndo(game.appId)}>
        {copy.undo}
      </button>
    </div>
  );
}

export function IntroPanel({
  copy,
  onClose,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  onClose: () => void;
}) {
  return (
    <section aria-labelledby="intro-title" className="introPanel">
      <div className="introKicker">{copy.productName}</div>
      <h2 id="intro-title">{copy.positioning}</h2>
      <p>{copy.introBody}</p>
      <p className="introDisclaimer">{copy.footerNotice}</p>
      <button className="introPrimary" type="button" onClick={onClose}>
        {copy.introPrimary}
      </button>
    </section>
  );
}
