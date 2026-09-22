'use client';

import { useEffect, useRef, useState } from 'react';
import type { CalendarEventDto, CalendarItemType } from '@classpilot/shared';
import { CALENDAR_ITEM_TYPES } from '@classpilot/shared';

/**
 * Create / edit / delete one calendar event.
 *
 * A native <dialog>, so focus trapping, Escape and the backdrop come from the
 * platform rather than from several hundred lines of hand-rolled modal.
 *
 * Writes go through the app's own route handlers rather than straight to the
 * API, because the API token lives on the server and must not reach the
 * browser.
 */

const TYPE_LABELS: Record<CalendarItemType, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  test: 'Test',
  event: 'Event',
  study_block: 'Study block',
  reminder: 'Reminder',
};

export function EventDialog({
  event,
  defaultDate,
  classes,
  onClose,
  onSaved,
}: {
  event: CalendarEventDto | null;
  defaultDate: string | null;
  classes: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(event?.title ?? '');
  const [type, setType] = useState<CalendarItemType>(event?.type ?? 'event');
  const [date, setDate] = useState(
    (event?.startAt ?? `${defaultDate ?? ''}T09:00:00Z`).slice(0, 10),
  );
  const [time, setTime] = useState(
    event?.allDay ? '' : (event?.startAt ?? 'T09:00').slice(11, 16),
  );
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [classId, setClassId] = useState(event?.classId ?? '');
  const [description, setDescription] = useState(event?.description ?? '');

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const submit = async (): Promise<void> => {
    setSaving(true);
    setError(null);

    /*
     * The browser's zone, sent with the event. Storing it means a later DST
     * change cannot silently move "3pm Tuesday" by an hour.
     */
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startAt = allDay
      ? new Date(`${date}T00:00:00`).toISOString()
      : new Date(`${date}T${time || '09:00'}:00`).toISOString();

    const body = {
      title: title.trim(),
      description: description.trim() === '' ? null : description.trim(),
      type,
      startAt,
      endAt: null,
      allDay,
      timezone,
      classId: classId === '' ? null : classId,
    };

    const response = await fetch(
      event ? `/api/calendar/${event.id}` : '/api/calendar',
      {
        method: event ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    setSaving(false);
    if (!response.ok) {
      setError('That could not be saved. Check the title and date, then try again.');
      return;
    }
    onSaved();
  };

  const remove = async (): Promise<void> => {
    if (!event) return;
    setSaving(true);
    const response = await fetch(`/api/calendar/${event.id}`, { method: 'DELETE' });
    setSaving(false);
    if (!response.ok) {
      setError('That could not be deleted.');
      return;
    }
    onSaved();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground shadow-high backdrop:bg-depth-base/40"
    >
      <form
        method="dialog"
        onSubmit={(formEvent) => {
          formEvent.preventDefault();
          void submit();
        }}
        className="space-y-4 p-6"
      >
        <h2 className="card-heading">{event ? 'Edit event' : 'New event'}</h2>

        <label className="block">
          <span className="mb-1 block text-metadata font-medium text-muted-foreground">
            Title
          </span>
          <input
            required
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Revise for the chemistry test"
            className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-small-body"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-metadata font-medium text-muted-foreground">
              Type
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CalendarItemType)}
              className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-small-body"
            >
              {CALENDAR_ITEM_TYPES.map((value) => (
                <option key={value} value={value}>
                  {TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-metadata font-medium text-muted-foreground">
              Class
            </span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-small-body"
            >
              <option value="">No class</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-metadata font-medium text-muted-foreground">
              Date
            </span>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-small-body"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-metadata font-medium text-muted-foreground">
              Time
            </span>
            <input
              type="time"
              value={time}
              disabled={allDay}
              onChange={(e) => setTime(e.target.value)}
              className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-small-body disabled:bg-disabled-fill disabled:text-disabled"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-small-body">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          All day
        </label>

        <label className="block">
          <span className="mb-1 block text-metadata font-medium text-muted-foreground">
            Notes
          </span>
          <textarea
            rows={3}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-small-body"
          />
        </label>

        {error ? (
          <p role="alert" className="rounded-md bg-error-surface px-3 py-2 text-metadata text-foreground">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {event ? (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving}
              className="min-h-11 rounded-md px-3 text-button text-error-text transition-colors duration-fast hover:bg-error-surface"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="min-h-11 rounded-md border border-border px-4 text-button text-foreground transition-colors duration-fast hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || title.trim() === ''}
              className="min-h-11 rounded-md bg-primary px-4 text-button text-primary-foreground transition-colors duration-fast hover:bg-action-hover disabled:bg-disabled-fill disabled:text-disabled"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </span>
        </div>
      </form>
    </dialog>
  );
}
