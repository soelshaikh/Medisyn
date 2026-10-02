"use client";

import { useState, useMemo, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AvailableSlot } from "@/api/appointments.api";
import { fmt12h } from "@/lib/utils";

interface SlotCalendarProps {
  slots: AvailableSlot[];
  selectedSlot: AvailableSlot | null;
  onSelect: (slot: AvailableSlot | null) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SlotCalendar({ slots, selectedSlot, onSelect }: SlotCalendarProps) {
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (slots.length === 0) return new Date();
    const today = new Date();
    const earliest = slots.reduce<Date | null>((min, s) => {
      const d = parseISO(s.date);
      return min === null || d < min ? d : min;
    }, null);
    return earliest && earliest > today ? startOfMonth(earliest) : startOfMonth(today);
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (slots.length === 0) return;
    const today = new Date();
    const hasThisMonth = slots.some((s) => isSameMonth(parseISO(s.date), today));
    if (!hasThisMonth) {
      const earliest = slots.reduce<Date | null>((min, s) => {
        const d = parseISO(s.date);
        return min === null || d < min ? d : min;
      }, null);
      if (earliest && earliest > today) setViewMonth(startOfMonth(earliest));
    }
  }, [slots]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const slot of slots) {
      const key = slot.date.slice(0, 10);
      const existing = map.get(key) ?? [];
      existing.push(slot);
      map.set(key, existing);
    }
    return map;
  }, [slots]);

  const calendarDays = useMemo(() => {
    const mStart    = startOfMonth(viewMonth);
    const mEnd      = endOfMonth(viewMonth);
    const gridStart = startOfWeek(mStart, { weekStartsOn: 0 });
    const gridEnd   = endOfWeek(mEnd,     { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const monthHasSlots = useMemo(
    () => slots.some((s) => isSameMonth(parseISO(s.date), viewMonth)),
    [slots, viewMonth],
  );

  const slotsForDay = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return [...(slotsByDate.get(key) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [selectedDate, slotsByDate]);

  function handleDayClick(day: Date) {
    if (!isSameMonth(day, viewMonth)) return;
    const key = format(day, "yyyy-MM-dd");
    if (!slotsByDate.has(key)) return;
    if (selectedDate && isSameDay(day, selectedDate)) {
      setSelectedDate(null);
      onSelect(null);
    } else {
      setSelectedDate(day);
      if (selectedSlot && selectedSlot.date.slice(0, 10) !== key) onSelect(null);
    }
  }

  function prevMonth() { setViewMonth((m) => subMonths(m, 1)); setSelectedDate(null); onSelect(null); }
  function nextMonth() { setViewMonth((m) => addMonths(m, 1)); setSelectedDate(null); onSelect(null); }

  return (
    <div className="space-y-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-sm font-semibold text-ink-900">
          {format(viewMonth, "MMMM yyyy")}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-100 pb-2 text-center">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {d}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1.5">
        {calendarDays.map((day) => {
          const key        = format(day, "yyyy-MM-dd");
          const inMonth    = isSameMonth(day, viewMonth);
          const daySlots   = slotsByDate.get(key) ?? [];
          const hasSlots   = inMonth && daySlots.length > 0;
          const allFull    = hasSlots && daySlots.every((s) => s.isFullyBooked && s.capacityType === "strict");
          const hasOpen    = hasSlots && !allFull;
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const todayDay   = isToday(day);

          /* ── Cell class ── */
          let cellClass = "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition select-none ";

          if (!inMonth) {
            // Outside current month — very muted, not interactive
            cellClass += "text-slate-200 cursor-default pointer-events-none";
          } else if (isSelected) {
            // Selected available day
            cellClass += "bg-brand-600 text-white font-bold cursor-pointer shadow-md";
          } else if (hasOpen) {
            // Has open slots — prominent teal-blue fill
            cellClass += "bg-brand-100 text-brand-800 font-bold cursor-pointer hover:bg-brand-200 hover:text-brand-900";
            if (todayDay) cellClass += " ring-2 ring-brand-500 ring-offset-1";
          } else if (allFull) {
            // All slots fully booked — red tint, not clickable
            cellClass += "bg-red-50 text-red-400 font-medium cursor-not-allowed line-through";
          } else {
            // In-month day with no slots
            cellClass += "text-slate-400 cursor-default";
            if (todayDay) cellClass += " ring-1 ring-slate-300";
          }

          return (
            <div key={key} className="flex flex-col items-center gap-0.5 py-0.5">
              <button
                type="button"
                disabled={!hasOpen}
                onClick={() => handleDayClick(day)}
                className={cellClass}
                aria-label={format(day, "MMMM d")}
              >
                {format(day, "d")}
              </button>
              {/* Availability dot */}
              {inMonth && (
                <span
                  className={`h-1 w-1 rounded-full ${
                    isSelected
                      ? "bg-brand-600"
                      : hasOpen
                      ? "bg-brand-400"
                      : allFull
                      ? "bg-red-300"
                      : "bg-transparent"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 border-t border-slate-100 pt-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 rounded-full bg-brand-100 ring-1 ring-brand-300" />
          Available
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 rounded-full bg-red-50 ring-1 ring-red-200" />
          Fully booked
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 rounded-full bg-brand-600" />
          Selected
        </span>
      </div>

      {/* No slots this month notice */}
      {!monthHasSlots && (
        <p className="text-center text-xs text-slate-500">
          No available slots this month — use the arrows to navigate.
        </p>
      )}

      {/* Time slot pills for selected date */}
      {selectedDate && slotsForDay.length > 0 && (
        <div className="space-y-2 rounded-xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-xs font-semibold text-brand-700">
            {format(selectedDate, "EEEE, MMMM d")} — choose a time
          </p>
          <div className="flex flex-wrap gap-2">
            {slotsForDay.map((slot) => {
              const full     = slot.isFullyBooked && slot.capacityType === "strict";
              const isActive = selectedSlot?._id === slot._id;

              return (
                <button
                  key={slot._id}
                  type="button"
                  disabled={full}
                  onClick={() => onSelect(isActive ? null : slot)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                      : full
                      ? "border-slate-200 bg-white text-slate-400 line-through cursor-not-allowed"
                      : "border-brand-300 bg-white text-brand-800 hover:border-brand-500 hover:bg-brand-100"
                  }`}
                >
                  {fmt12h(slot.startTime)}–{fmt12h(slot.endTime)}
                  {!full && slot.capacityType === "strict" && slot.spotsLeft !== null && (
                    <span className={`ml-1.5 ${isActive ? "text-brand-200" : "text-brand-400"}`}>
                      · {slot.spotsLeft} {slot.spotsLeft === 1 ? "spot" : "spots"}
                    </span>
                  )}
                  {full && <span className="ml-1.5 text-red-300">· Full</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
