import { CoursenIcon, type CoursenIconName } from '@/components/coursen-icon';
import { Reveal } from '@/components/motion/reveal';
import { Section, SectionHeading } from '@/components/marketing/section';
import { DEMO_ASSIGNMENTS } from '@/app/(marketing)/_data/demo';

/**
 * Dashboard preview.
 *
 * A static composition rather than a screenshot, so it stays sharp at every
 * density and in dark mode, and cannot go stale when the real dashboard
 * changes. Everything shown is marketing demo data from _data/demo.ts.
 */
export function DashboardPreview() {
  return (
    <Section className="border-t border-depth-line">
      <SectionHeading
        align="center"
        eyebrow="Your workspace"
        title="Open one page and know where you stand"
        lede="Today, what is missing, and what is coming - ordered by what actually needs you next."
      />

      <Reveal step={1} className="mt-14">
        <div className="glass-dark overflow-hidden rounded-lg p-3 sm:p-5">
          {/* Summary tiles */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Today', value: '2', icon: 'clock' as CoursenIconName },
              { label: 'Missing', value: '1', icon: 'attention' as CoursenIconName },
              { label: 'Classes', value: '6', icon: 'classes' as CoursenIconName },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl border border-depth-line bg-white/[0.03] p-4"
              >
                <div className="flex items-center gap-2">
                  <CoursenIcon name={tile.icon} className="h-4 w-4 text-depth-muted" />
                  <span className="text-[12px] font-medium text-depth-muted">
                    {tile.label}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-depth-ink">
                  {tile.value}
                </p>
              </div>
            ))}
          </div>

          {/* Work list */}
          <div className="mt-3 rounded-xl border border-depth-line bg-depth-base/50 p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-depth-muted">
              Up next
            </p>
            <ul className="space-y-2">
              {DEMO_ASSIGNMENTS.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-depth-line bg-white/[0.03] px-3.5 py-3 transition-colors duration-base hover:border-depth-line-strong"
                >
                  <span
                    aria-hidden="true"
                    className={`h-8 w-[3px] shrink-0 rounded-full ${item.accent}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-depth-ink">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-depth-muted">
                      {item.course}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="block text-[12px] font-medium text-depth-ink">
                      {item.due}
                    </span>
                    {item.points !== null ? (
                      <span className="block text-[11px] text-depth-muted">
                        {item.points} pts
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-3 px-1 text-[11px] text-depth-muted">
            Sample data shown for illustration. Your workspace shows only your
            own synced coursework.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
