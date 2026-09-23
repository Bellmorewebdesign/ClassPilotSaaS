/**
 * Coursen interface icons - Brand Kit v2.
 *
 * Geometry transcribed verbatim from the kit's `icons/interface-*.svg`, with
 * one change: the kit hardcodes `#3F6FA8`, which cannot follow the text colour
 * of the thing it sits beside. Here every stroke is `currentColor`, so an icon
 * in muted copy reads muted and an icon in an active nav item reads active.
 *
 * Inlined rather than loaded as files: fourteen `<img>` requests for ~450
 * bytes each is worse than one component, and an `<img>` cannot inherit colour.
 *
 * "Quiet geometry. Consistent weight." (guide page 29) - these all share a
 * 24x24 frame and a 1.8 stroke, which is why they should be preferred over a
 * generic icon set wherever a kit icon exists.
 */

export type CoursenIconName =
  | 'overview'
  | 'assignment'
  | 'classes'
  | 'calendar'
  | 'check'
  | 'clock'
  | 'attention'
  | 'sync'
  | 'source'
  | 'file'
  | 'search'
  | 'settings'
  | 'bell'
  | 'arrow';

/** Raw inner markup, keyed by name. */
const PATHS: Record<CoursenIconName, string> = {
  overview:
    '<rect x="3.0" y="3.0" width="7.0" height="7.0" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14.0" y="3.0" width="7.0" height="11.0" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3.0" y="14.0" width="7.0" height="7.0" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="14.0" y="18.0" width="7.0" height="3.0" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  assignment:
    '<rect x="5.0" y="3.0" width="14.0" height="18.0" rx="2.0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.0 8.0 L15.0 8.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.0 12.0 L15.0 12.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.0 16.0 L12.0 16.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  classes:
    '<rect x="3.0" y="4.0" width="18.0" height="16.0" rx="2.0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.0 9.0 L21.0 9.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.0 9.0 L9.0 20.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  calendar:
    '<rect x="3.0" y="5.0" width="18.0" height="16.0" rx="2.0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7.0 3.0 L7.0 7.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.0 3.0 L17.0 7.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3.0 10.0 L21.0 10.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8.0" cy="15.0" r="0.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="14.0" cy="15.0" r="0.6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  check:
    '<path d="M5.0 12.0 L10.0 17.0 L20.0 6.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  clock:
    '<circle cx="12.0" cy="12.0" r="9.0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.0 6.0 L12.0 12.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12.0 12.0 L16.0 14.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  attention:
    '<circle cx="12.0" cy="12.0" r="9.0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.0 7.0 L12.0 12.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12.0" cy="16.0" r="0.6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  sync:
    '<path d="M19.372368398600926 17.162187927159415 C16.695748272333503 20.98479762529406 11.541346329313992 22.127501025177885 7.500000000000002 19.794228634059948 C3.4586536706860125 17.46095624294201 1.8710628724664948 12.42576151902933 3.8432299166701505 8.196435644333707 C5.815396960873807 3.9671097696380837 10.693063593496984 1.9467140976708581 15.07818128993102 3.5427664129268255" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M16.0 3.0 L21.0 6.0 L20.0 1.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  source:
    '<rect x="3.0" y="9.0" width="12.0" height="12.0" rx="2.0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11.0 3.0 L21.0 3.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M21.0 3.0 L21.0 13.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M11.0 13.0 L21.0 3.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  file:
    '<rect x="5.0" y="3.0" width="14.0" height="18.0" rx="2.0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.0 10.0 L15.0 10.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.0 14.0 L15.0 14.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  search:
    '<circle cx="10.0" cy="10.0" r="6.0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.0 15.0 L21.0 21.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  settings:
    '<path d="M3.0 5.0 L21.0 5.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9.0" cy="5.0" r="2.5" fill="#FFFFFF" stroke="currentColor" stroke-width="1.8"/><path d="M3.0 12.0 L21.0 12.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16.0" cy="12.0" r="2.5" fill="#FFFFFF" stroke="currentColor" stroke-width="1.8"/><path d="M3.0 19.0 L21.0 19.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8.0" cy="19.0" r="2.5" fill="#FFFFFF" stroke="currentColor" stroke-width="1.8"/>',
  bell:
    '<path d="M5.0 17.0 L7.0 14.0 L7.0 8.0 L9.0 5.0 L15.0 5.0 L17.0 8.0 L17.0 14.0 L19.0 17.0 L5.0 17.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.0 20.0 L14.0 20.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  arrow:
    '<path d="M4.0 12.0 L20.0 12.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.0 7.0 L20.0 12.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.0 17.0 L20.0 12.0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};

export function CoursenIcon({
  name,
  className,
  title,
  size = 24,
}: {
  name: CoursenIconName;
  className?: string;
  /** Supply only when the icon is the sole label for a control. */
  title?: string;
  /**
   * Intrinsic size in px. Almost never worth setting - the default matches
   * the 24x24 frame and CSS sizes the icon in practice. It exists so the
   * icon has a bounded size before CSS applies: an <svg> with a viewBox and
   * no width/height falls back to `width:100%` of its container, which
   * during a client-side route change (new DOM, stylesheet chunk not yet
   * loaded) renders a viewport-filling glyph. See BrandMark for the full
   * account.
   */
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      dangerouslySetInnerHTML={{
        __html: (title ? `<title>${title}</title>` : '') + PATHS[name],
      }}
    />
  );
}
