"use client";

import {
  detailDescription,
  detailKind,
  detailTitle,
  eventVisualClass,
  formatEventDateRange,
  formatDisplayPrice,
  hasGameEventImage,
} from "./calendar-utils";
import type { PreviewEvent } from "./model";
import { SteamCliImage } from "./steam-cli-image";
import { UI_COPY, type UiLanguage } from "./ui-copy";

export function CalendarEventList({
  events,
  isLoading,
  onSelectEvent,
  recentlyAddedAppId,
  selectedEventId,
  uiCopy,
  uiLanguage,
}: {
  events: PreviewEvent[];
  isLoading: boolean;
  onSelectEvent: (eventId: string) => void;
  recentlyAddedAppId: string | null;
  selectedEventId: string | null;
  uiCopy: (typeof UI_COPY)[UiLanguage];
  uiLanguage: UiLanguage;
}) {
  return (
    <div className="eventListScroll" aria-label="Calendar event list">
      {isLoading ? (
        <div className="calendarLoadingOverlay" role="status">
          <span className="loadingSpinner" />
          <span>{uiCopy.syncingCalendar}</span>
        </div>
      ) : null}
      {events.length ? (
        <div className="eventList">
          {events.map((event) => {
            const shouldShowEventImage = hasGameEventImage(event);

            return (
              <button
                className={[
                  "eventListItem",
                  eventVisualClass(event),
                  shouldShowEventImage ? "" : "noEventImage",
                  event.id === selectedEventId ? "isSelected" : "",
                  event.appId && event.appId === recentlyAddedAppId ? "isNewCalendarItem" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-testid="calendar-event-list-item"
                key={event.id}
                onClick={() => onSelectEvent(event.id)}
                type="button"
              >
                <span className="eventListMarker" aria-hidden="true" />
                {shouldShowEventImage ? (
                  <SteamCliImage fallbackClassName="eventListThumbFallback" src={event.imageUrl} />
                ) : null}
                <span className="eventListContent">
                  <span className="eventListMeta">
                    <span>{formatEventDateRange(event, uiLanguage)}</span>
                    <span>{detailKind(event, uiCopy)}</span>
                  </span>
                  <strong>{detailTitle(event)}</strong>
                  <span className="eventListDescription">{detailDescription(event)}</span>
                </span>
                {event.discount || event.finalPrice ? (
                  <span className="eventListPrice">
                    {event.discount ? <strong>{event.discount}</strong> : null}
                    {event.finalPrice ? (
                      <span>{formatDisplayPrice(event.finalPrice, uiLanguage)}</span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="emptyEventList">
          <h3>{uiCopy.noCalendarEvents}</h3>
          <p>{uiCopy.noCalendarEventsDescription}</p>
        </div>
      )}
    </div>
  );
}
