"use client";

import type { CSSProperties, RefObject } from "react";
import { compactEventTitle, eventVisualClass, formatDate } from "./calendar-utils";
import type { CalendarWeek } from "./model";
import { UI_COPY, WEEKDAY_LABELS, type UiLanguage } from "./ui-copy";

export function CalendarMonthView({
  eventsLength,
  isLoading,
  onSelectEvent,
  recentlyAddedAppId,
  scrollRef,
  selectedEventId,
  todayIso,
  uiCopy,
  uiLanguage,
  visibleMonth,
  weekRefs,
  weeks,
}: {
  eventsLength: number;
  isLoading: boolean;
  onSelectEvent: (eventId: string) => void;
  recentlyAddedAppId: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedEventId: string | null;
  todayIso: string;
  uiCopy: (typeof UI_COPY)[UiLanguage];
  uiLanguage: UiLanguage;
  visibleMonth: string;
  weekRefs: RefObject<Map<string, HTMLElement>>;
  weeks: CalendarWeek[];
}) {
  return (
    <>
      <div className="calendarWeekdays" aria-hidden="true">
        {WEEKDAY_LABELS[uiLanguage].map((weekday) => (
          <div className="weekday" key={weekday}>
            {weekday}
          </div>
        ))}
      </div>

      <div
        className="calendarScroll"
        ref={scrollRef}
        aria-label="Scrollable calendar weeks"
        tabIndex={0}
      >
        {isLoading ? (
          <div className="calendarLoadingOverlay" role="status">
            <span className="loadingSpinner" />
            <span>{uiCopy.syncingCalendar}</span>
          </div>
        ) : null}
        {eventsLength ? (
          <div className="calendarTimeline" role="grid" aria-label="Continuous calendar grid">
            {weeks.map((week) => {
              const weekLanes = Math.max(
                3,
                week.segments.reduce(
                  (highestLane, segment) => Math.max(highestLane, segment.lane + 1),
                  0,
                ),
              );

              return (
                <div
                  aria-label={`Week of ${formatDate(week.weekStartIso, uiLanguage)}`}
                  className="calendarWeek"
                  data-week-start={week.weekStartIso}
                  key={week.weekStartIso}
                  ref={(node) => {
                    if (node) {
                      weekRefs.current.set(week.weekStartIso, node);
                    } else {
                      weekRefs.current.delete(week.weekStartIso);
                    }
                  }}
                  role="row"
                  style={{ "--week-lanes": weekLanes } as CSSProperties}
                >
                  {week.cells.map((cell, index) => (
                    <div
                      className={
                        cell.date.startsWith(`${visibleMonth}-`)
                          ? "dayCell"
                          : "dayCell outsideMonth"
                      }
                      key={cell.date}
                      role="gridcell"
                      aria-label={`${formatDate(cell.date, uiLanguage)}${cell.events.length ? `, ${cell.events.length} events` : ""}`}
                      style={{ gridColumn: index + 1 } as CSSProperties}
                    >
                      <span className={cell.date === todayIso ? "dayNumber isToday" : "dayNumber"}>
                        {cell.day}
                      </span>
                    </div>
                  ))}
                  {week.segments.map((segment) => (
                    <button
                      aria-label={segment.event.title}
                      className={[
                        "calendarSegment",
                        segment.event.type,
                        eventVisualClass(segment.event),
                        segment.event.id === selectedEventId ? "isSelected" : "",
                        segment.event.appId && segment.event.appId === recentlyAddedAppId
                          ? "isNewCalendarItem"
                          : "",
                        segment.startsAtEvent ? "startsAtEvent" : "",
                        segment.endsAtEvent ? "endsAtEvent" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-event-id={segment.event.id}
                      data-testid="calendar-event-segment"
                      key={`${week.weekStartIso}-${segment.event.id}`}
                      style={
                        {
                          "--segment-lane": segment.lane,
                          "--segment-start": segment.startColumn,
                          "--segment-span": segment.endColumn - segment.startColumn + 1,
                        } as CSSProperties
                      }
                      onClick={() => onSelectEvent(segment.event.id)}
                      title={segment.event.title}
                      type="button"
                    >
                      <span className="segmentTitle">{compactEventTitle(segment.event.title)}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : !isLoading ? (
          <div className="emptyEventList emptyCalendarState">
            <h3>{uiCopy.noCalendarEvents}</h3>
            <p>{uiCopy.noCalendarEventsDescription}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
