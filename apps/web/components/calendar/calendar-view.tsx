'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CalendarEventDto, CalendarItemType } from '@classpilot/shared';
import { isDerivedEventId } from '@classpilot/shared';
import { CoursenIcon } from '@/components/coursen-icon';
import { EventDialog } from '@/components/calendar/event-dialog';
import { cn } from '@/lib/utils';

/**
 * Month grid and agenda for the Coursen calendar.
 *
 * TWO KINDS OF ITEM, VISIBLY DIFFERENT
 *
 * Events the student owns can be edited and deleted here. Items derived from
 * Classroom due dates cannot - they belong to the assignment, and the only
 * honest way to move one is to change it in Classroom and sync. The UI says
 * so rather than offering an edit button that would quietly do nothing.
 */

const TYPE_STYLES: Record<CalendarItemType, { dot: string; label: string }> = {
  assignment: { dot: 'bg-primary', label: 'Assignment' },
  quiz: { dot: 'bg-warning', label: 'Quiz' },
  test: { dot: 'bg-error-text', label: 'Test' },
  event: { dot: 'bg-success', label: 'Event' },
  study_block: { dot: 'bg-sky', label: 'Study block' },
  reminder: { dot: 'bg-muted-foreground', label: 'Reminder' },
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView({
  year,
  monthIndex,
  events,
  classes,
}: {
  year: number;
  monthIndex: number;
  events: CalendarEventDto[];
  classes: Array<{ id: string; name: string }>;
  assistantName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CalendarEventDto | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);

  const monthLabel = new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const weeks = useMemo(() => buildMonthGrid(year, monthIndex), [year, monthIndex]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEventDto[]>();
    for (const event of events) {
      const key = event.startAt.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  const monthEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const date = new Date(event.startAt);
          return date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex;
        })
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [events, year, monthIndex],
  );

  const previous = shiftMonth(year, monthIndex, -1);
  const next = shiftMonth(year, monthIndex, 1);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="eyebrow">Your schedule</p>
          <h1 className="page-heading">{monthLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${previous}`}
            className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-button text-foreground transition-colors duration-fast hover:bg-secondary"
            aria-label="Previous month"
          >
            Previous
          </Link>
          <Link
            href="/calendar"
            className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-button text-foreground transition-colors duration-fast hover:bg-secondary"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${next}`}
            className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-button text-foreground transition-colors duration-fast hover:bg-secondary"
            aria-label="Next month"
          >
            Next
          </Link>
          <button
            type="button"
            onClick={() => setCreatingOn(today)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-button text-primary-foreground transition-colors duration-fast hover:bg-action-hover"
          >
            New event
          </button>
        </div>
      </div>

      {/* --- Month grid --- */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-metadata font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weeks.flat().map((day) => {
            const dayEvents = byDay.get(day.iso) ?? [];
            return (
              <div
                key={day.iso}
                className={cn(
                  'min-h-[7rem] border-b border-r border-border p-1.5 last:border-r-0',
                  !day.inMonth && 'bg-background',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-metadata font-medium',
                      day.iso === today
                        ? 'bg-primary text-primary-foreground'
                        : day.inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {day.dayOfMonth}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreatingOn(day.iso)}
                    className="rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity duration-fast hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Add an event on ${day.iso}`}
                  >
                    +
                  </button>
                </div>

                <ul className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <li key={event.id}>
                      <EventChip event={event} onOpen={() => setEditing(event)} />
                    </li>
                  ))}
                  {dayEvents.length > 3 ? (
                    <li className="px-1 text-metadata text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Agenda --- */}
      <section className="space-y-3">
        <h2 className="section-heading">This month</h2>
        {monthEvents.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-small-body text-muted-foreground">
            Nothing scheduled this month. Assignments with a due date appear here
            automatically once they sync.
          </p>
        ) : (
          <ul className="space-y-2">
            {monthEvents.map((event) => (
              <li key={event.id}>
                <AgendaRow event={event} onOpen={() => setEditing(event)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing || creatingOn ? (
        <EventDialog
          event={editing}
          defaultDate={creatingOn}
          classes={classes}
          onClose={() => {
            setEditing(null);
            setCreatingOn(null);
          }}
          onSaved={() => {
            setEditing(null);
            setCreatingOn(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function EventChip({
  event,
  onOpen,
}: {
  event: CalendarEventDto;
  onOpen: () => void;
}) {
  const style = TYPE_STYLES[event.type];
  const derived = isDerivedEventId(event.id);

  const content = (
    <span className="flex w-full items-center gap-1.5 overflow-hidden">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} aria-hidden="true" />
      <span className="truncate text-metadata text-foreground">{event.title}</span>
    </span>
  );

  if (derived) {
    // Classroom items belong to the assignment. Link to it rather than
    // offering an editor that could not honestly save.
    return (
      <Link
        href={`/assignments/${event.assignmentId}`}
        className="block rounded-sm px-1 py-0.5 hover:bg-secondary"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-sm px-1 py-0.5 text-left hover:bg-secondary"
    >
      {content}
    </button>
  );
}

function AgendaRow({ event, onOpen }: { event: CalendarEventDto; onOpen: () => void }) {
  const style = TYPE_STYLES[event.type];
  const derived = isDerivedEventId(event.id);
  const when = new Date(event.startAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(event.allDay ? {} : { hour: 'numeric', minute: '2-digit' }),
  });

  const body = (
    <>
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', style.dot)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small-body font-semibold text-foreground">
          {event.title}
        </span>
        <span className="block truncate text-metadata text-muted-foreground">
          {when}
          {event.className ? ` · ${event.className}` : ''}
          {` · ${style.label}`}
        </span>
      </span>
      {derived ? (
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-metadata font-medium text-primary">
          From Classroom
        </span>
      ) : (
        <CoursenIcon
          name="arrow"
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
      )}
    </>
  );

  const shared =
    'flex w-full items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors duration-fast hover:bg-background';

  return derived ? (
    <Link href={`/assignments/${event.assignmentId}`} className={shared}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className={shared}>
      {body}
    </button>
  );
}

interface GridDay {
  iso: string;
  dayOfMonth: number;
  inMonth: boolean;
}

/**
 * A Monday-first month grid.
 *
 * Built in UTC throughout. Mixing local and UTC here is how a calendar ends
 * up putting an event on the wrong day for anyone east of Greenwich.
 */
function buildMonthGrid(year: number, monthIndex: number): GridDay[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  // getUTCDay is Sunday-0; shift so Monday is column 0.
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - offset);

  const weeks: GridDay[][] = [];
  const cursor = new Date(start);
  for (let week = 0; week < 6; week += 1) {
    const days: GridDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push({
        iso: cursor.toISOString().slice(0, 10),
        dayOfMonth: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === monthIndex,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(days);
    // Stop once the month is fully covered rather than always drawing six
    // rows, which leaves an empty week at the bottom of most months.
    if (cursor.getUTCMonth() !== monthIndex && week >= 3) break;
  }
  return weeks;
}

function shiftMonth(year: number, monthIndex: number, delta: number): string {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
