import { brand } from '@classpilot/shared';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/states';
import { CalendarView } from '@/components/calendar/calendar-view';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Calendar' };

/**
 * The Coursen calendar.
 *
 * It is Coursen's own calendar, not a window onto Google's. It works with no
 * external account connected, and it shows two things side by side: the
 * events the student created, and the due dates that came from Classroom.
 *
 * The Classroom items are derived at query time from synced assignments
 * rather than copied into the calendar, so a deadline here is always what
 * the last sync actually saw.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonth(params.month);

  // A month grid shows leading and trailing days from the neighbouring
  // months, so the window has to be wider than the month itself.
  const from = new Date(Date.UTC(month.year, month.index, 1));
  from.setUTCDate(from.getUTCDate() - 7);
  const to = new Date(Date.UTC(month.year, month.index + 1, 1));
  to.setUTCDate(to.getUTCDate() + 7);

  const [calendar, classes] = await Promise.all([
    api.calendar(from.toISOString(), to.toISOString()),
    api.classes(),
  ]);

  if (!calendar.ok) {
    return (
      <ErrorState title="Could not load your calendar" message={calendar.message} />
    );
  }

  return (
    <CalendarView
      year={month.year}
      monthIndex={month.index}
      events={calendar.data.events}
      classes={classes.ok ? classes.data.items.map((c) => ({ id: c.id, name: c.name })) : []}
      assistantName={brand.assistantTitle}
    />
  );
}

/** `?month=2026-09`, defaulting to the current month. */
function parseMonth(value: string | undefined): { year: number; index: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (match) {
    const year = Number(match[1]);
    const index = Number(match[2]) - 1;
    if (year >= 2000 && year <= 2100 && index >= 0 && index <= 11) {
      return { year, index };
    }
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), index: now.getUTCMonth() };
}
