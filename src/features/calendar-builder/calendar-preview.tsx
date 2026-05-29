"use client";

import { CalendarPlus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildContinuousCalendarWeeks,
  buildEventWeekRange,
  calendarLegendItems,
  compareEventsForList,
  formatCalendarMonthTitle,
  inferVisibleMonthFromWeek,
  monthKeyFromIsoDate,
  weekStartForDate,
} from "./calendar-utils";
import { CalendarEventList } from "./calendar-event-list";
import { CalendarMonthView } from "./calendar-month-view";
import type { CalendarView, PreviewEvent } from "./model";
import { UI_COPY, type UiLanguage } from "./ui-copy";

export function CalendarPreview({
  events,
  initialFocusDate,
  isLoading,
  onSelectEvent,
  recentlyAddedAppId,
  selectedEventId,
  todayIso,
  uiCopy,
  uiLanguage,
  webcalUrl,
}: {
  events: PreviewEvent[];
  initialFocusDate: string;
  isLoading: boolean;
  onSelectEvent: (eventId: string) => void;
  recentlyAddedAppId: string | null;
  selectedEventId: string | null;
  todayIso: string;
  uiCopy: (typeof UI_COPY)[UiLanguage];
  uiLanguage: UiLanguage;
  webcalUrl: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const weekRefs = useRef(new Map<string, HTMLElement>());
  const initialMonth = monthKeyFromIsoDate(initialFocusDate);
  const initialWeekStart = useMemo(() => weekStartForDate(initialFocusDate), [initialFocusDate]);
  const todayWeekStart = useMemo(() => weekStartForDate(todayIso), [todayIso]);
  const weekRange = useMemo(() => buildEventWeekRange(events, todayIso), [events, todayIso]);
  const weeks = useMemo(
    () => buildContinuousCalendarWeeks(events, weekRange.startIso, weekRange.endIso),
    [events, weekRange],
  );
  const listEvents = useMemo(() => [...events].sort(compareEventsForList), [events]);
  const legendItems = useMemo(() => calendarLegendItems(events, uiCopy), [events, uiCopy]);
  const shouldAlignInitialWeek = useRef(true);
  const pendingWeekScroll = useRef<string | null>(null);
  const lastAlignedFocusDate = useRef<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const canScrollToToday =
    todayWeekStart >= weekRange.startIso && todayWeekStart < weekRange.endIso;
  const calendarAppClassName = ["calendarApp", calendarView === "list" ? "isListView" : ""]
    .filter(Boolean)
    .join(" ");

  useLayoutEffect(() => {
    if (lastAlignedFocusDate.current !== initialFocusDate) {
      shouldAlignInitialWeek.current = true;
      lastAlignedFocusDate.current = initialFocusDate;
    }
  }, [initialFocusDate, initialWeekStart]);

  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    if (!shouldAlignInitialWeek.current && !pendingWeekScroll.current) {
      return;
    }

    const targetWeekIso = pendingWeekScroll.current ?? initialWeekStart;
    const targetWeek = weekRefs.current.get(targetWeekIso);

    if (scrollElement && targetWeek) {
      scrollElement.scrollTop = targetWeek.offsetTop - scrollElement.offsetTop;
      setVisibleMonth(inferVisibleMonthFromWeek(targetWeekIso));
      shouldAlignInitialWeek.current = false;
      pendingWeekScroll.current = null;
      return;
    }

    const fallbackWeek = weeks[0]?.weekStartIso;
    const fallbackWeekNode = fallbackWeek ? weekRefs.current.get(fallbackWeek) : null;

    if (scrollElement && fallbackWeek && fallbackWeekNode) {
      scrollElement.scrollTop = fallbackWeekNode.offsetTop - scrollElement.offsetTop;
      setVisibleMonth(inferVisibleMonthFromWeek(fallbackWeek));
      shouldAlignInitialWeek.current = false;
      pendingWeekScroll.current = null;
    }
  }, [calendarView, initialWeekStart, weeks]);

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    let frameId = 0;
    const updateVisibleMonth = () => {
      if (shouldAlignInitialWeek.current) {
        return;
      }

      frameId = 0;
      const scrollTop = scrollElement.scrollTop;
      let nearestWeek = weeks[0]?.weekStartIso ?? initialWeekStart;
      let nearestDistance = Number.POSITIVE_INFINITY;

      weekRefs.current.forEach((node, weekStartIso) => {
        const distance = Math.abs(node.offsetTop - scrollElement.offsetTop - scrollTop);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestWeek = weekStartIso;
        }
      });

      setVisibleMonth(inferVisibleMonthFromWeek(nearestWeek));
    };

    const handleScroll = () => {
      if (frameId) {
        return;
      }

      frameId = requestAnimationFrame(updateVisibleMonth);
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    updateVisibleMonth();

    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [initialWeekStart, weeks]);

  function scrollToCalendarWeek(weekStartIso: string, behavior: ScrollBehavior = "smooth") {
    const scrollElement = scrollRef.current;
    const targetWeek = weekRefs.current.get(weekStartIso);

    if (!scrollElement || !targetWeek) {
      pendingWeekScroll.current = weekStartIso;
      return;
    }

    scrollElement.scrollTo({
      top: targetWeek.offsetTop - scrollElement.offsetTop,
      behavior,
    });
    setVisibleMonth(inferVisibleMonthFromWeek(weekStartIso));
    pendingWeekScroll.current = null;
  }

  function handleTodayClick() {
    if (!canScrollToToday) {
      return;
    }

    pendingWeekScroll.current = todayWeekStart;
    setCalendarView("month");
    scrollToCalendarWeek(todayWeekStart);
  }

  return (
    <section className={calendarAppClassName} aria-label="Calendar preview">
      <div className="calendarHeader">
        <h2>{formatCalendarMonthTitle(visibleMonth, uiLanguage)}</h2>

        <div className="calendarControls">
          <button
            className="todayButton"
            disabled={!canScrollToToday}
            type="button"
            onClick={handleTodayClick}
          >
            {uiCopy.today}
          </button>
          <div className="viewTabs" aria-label="Calendar view">
            <button
              aria-pressed={calendarView === "month"}
              className={calendarView === "month" ? "isActive" : ""}
              type="button"
              onClick={() => setCalendarView("month")}
            >
              {uiCopy.month}
            </button>
            <button
              aria-pressed={calendarView === "list"}
              className={calendarView === "list" ? "isActive" : ""}
              type="button"
              onClick={() => setCalendarView("list")}
            >
              {uiCopy.list}
            </button>
          </div>
        </div>
      </div>

      {calendarView === "month" ? (
        <>
          <CalendarMonthView
            eventsLength={events.length}
            isLoading={isLoading}
            onSelectEvent={onSelectEvent}
            recentlyAddedAppId={recentlyAddedAppId}
            scrollRef={scrollRef}
            selectedEventId={selectedEventId}
            todayIso={todayIso}
            uiCopy={uiCopy}
            uiLanguage={uiLanguage}
            visibleMonth={visibleMonth}
            weekRefs={weekRefs}
            weeks={weeks}
          />

          <CalendarFooter
            addToCalendarLabel={uiCopy.addToCalendar}
            legendItems={legendItems}
            webcalUrl={webcalUrl}
          />
        </>
      ) : (
        <>
          <CalendarEventList
            events={listEvents}
            isLoading={isLoading}
            onSelectEvent={onSelectEvent}
            recentlyAddedAppId={recentlyAddedAppId}
            selectedEventId={selectedEventId}
            uiCopy={uiCopy}
            uiLanguage={uiLanguage}
          />
          <CalendarFooter
            addToCalendarLabel={uiCopy.addToCalendar}
            legendItems={legendItems}
            webcalUrl={webcalUrl}
          />
        </>
      )}
    </section>
  );
}

function CalendarFooter({
  addToCalendarLabel,
  legendItems,
  webcalUrl,
}: {
  addToCalendarLabel: string;
  legendItems: ReturnType<typeof calendarLegendItems>;
  webcalUrl: string;
}) {
  return (
    <div className="calendarFooter">
      <CalendarLegend legendItems={legendItems} />
      <a className="calendarFooterCta" href={webcalUrl}>
        <CalendarListIcon />
        {addToCalendarLabel}
      </a>
    </div>
  );
}

export function CalendarListIcon() {
  return <CalendarPlus aria-hidden="true" className="toolbarSvg" />;
}

export function CalendarLegend({
  legendItems,
}: {
  legendItems: ReturnType<typeof calendarLegendItems>;
}) {
  return (
    <div className="calendarLegend" aria-label="Calendar legend">
      {legendItems.map((item) => (
        <span key={item.className}>
          <i className={`legendDot ${item.className}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
