"use client";

import { ExternalLink, X } from "lucide-react";
import type { CSSProperties } from "react";
import {
  detailDescription,
  detailFacts,
  detailKind,
  detailTitle,
  formatDisplayPrice,
  formatDetailDateSentence,
  hasDifferentDisplayCurrency,
  hasGameEventImage,
  steamStoreUrlForEvent,
} from "./calendar-utils";
import type { PreviewEvent } from "./model";
import { UI_COPY, type UiLanguage } from "./ui-copy";

export function EventDetails({
  copy,
  currentStoreCurrency,
  event,
  isMobileOpen,
  onCloseMobile,
  uiLanguage,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  currentStoreCurrency?: string;
  event: PreviewEvent | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  uiLanguage: UiLanguage;
}) {
  if (!event) {
    return (
      <aside
        className={isMobileOpen ? "detailPanel isMobileOpen" : "detailPanel"}
        aria-label="Selected event details"
      >
        <div className="mobileDetailHeader">
          <h2>{copy.noEventsVisible}</h2>
          <button aria-label="Close details" type="button" onClick={onCloseMobile}>
            <X aria-hidden="true" className="miniIcon" />
          </button>
        </div>
        <div className="emptyDetail">
          <h2>{copy.noEventsVisible}</h2>
          <p>{copy.noEventsVisibleDescription}</p>
        </div>
      </aside>
    );
  }

  const shouldShowDetailHero = hasGameEventImage(event);
  const heroStyle = shouldShowDetailHero
    ? ({
        backgroundImage: `linear-gradient(180deg, rgba(5, 9, 15, 0.02), rgba(5, 9, 15, 0.18)), url("${event.imageUrl}")`,
      } as CSSProperties)
    : undefined;
  const steamStoreUrl = steamStoreUrlForEvent(event);
  const shouldShowCurrencyMismatchNote = hasHistoricalCurrencyMismatch(
    event,
    currentStoreCurrency,
    uiLanguage,
  );

  return (
    <aside
      className={[
        "detailPanel",
        shouldShowDetailHero ? "" : "noDetailHero",
        isMobileOpen ? "isMobileOpen" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Selected event details"
    >
      <div className="mobileDetailHeader">
        <h2>{copy.eventDetailsTitle}</h2>
        <button aria-label="Close details" type="button" onClick={onCloseMobile}>
          <X aria-hidden="true" className="miniIcon" />
        </button>
      </div>
      <div className="detailTitleBlock" key={`${event.id}-title`}>
        <span>{detailKind(event, copy)}</span>
        <h2>{detailTitle(event)}</h2>
      </div>
      {shouldShowDetailHero ? (
        <div
          className="detailHero gameHero hasSteamCliImage"
          key={`${event.id}-hero`}
          style={heroStyle}
        />
      ) : null}

      <div className="detailBody" key={`${event.id}-body`}>
        <div
          className={event.type === "steam_deal" ? "detailMeta detailMetaCallout" : "detailMeta"}
        >
          <span>{formatDetailDateSentence(event, copy, uiLanguage)}</span>
        </div>

        {event.discount || event.finalPrice ? (
          <div className="commerceLine">
            {event.discount ? <div className="discountBadge">{event.discount}</div> : null}

            {event.finalPrice ? (
              <div className="priceLine">
                <strong>{formatDisplayPrice(event.finalPrice, uiLanguage)}</strong>
                {event.originalPrice ? (
                  <span>{formatDisplayPrice(event.originalPrice, uiLanguage)}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {shouldShowCurrencyMismatchNote ? (
          <div className="currencySourceNotice">{copy.historicalCurrencyMismatchNote}</div>
        ) : null}

        <p className="detailDescription">{detailDescription(event)}</p>

        <DetailFacts copy={copy} event={event} uiLanguage={uiLanguage} />

        {steamStoreUrl ? (
          <div className="detailActions">
            <a className="secondaryAction" href={steamStoreUrl} rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" className="toolbarSvg" />
              {copy.viewOnSteam}
            </a>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function hasHistoricalCurrencyMismatch(
  event: PreviewEvent,
  currentStoreCurrency: string | undefined,
  uiLanguage: UiLanguage,
): boolean {
  if (event.dataSource !== "steam_history") {
    return false;
  }

  return [event.finalPrice, event.originalPrice].some((price) =>
    hasDifferentDisplayCurrency(price, currentStoreCurrency, uiLanguage),
  );
}

function DetailFacts({
  copy,
  event,
  uiLanguage,
}: {
  copy: (typeof UI_COPY)[UiLanguage];
  event: PreviewEvent;
  uiLanguage: UiLanguage;
}) {
  const facts = detailFacts(event, copy, uiLanguage);

  if (!facts.length) {
    return null;
  }

  return (
    <dl className="detailFacts">
      {facts.map((fact) => (
        <div className="detailFact" key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
