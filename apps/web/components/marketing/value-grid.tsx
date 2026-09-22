import { Reveal } from '@/components/motion/reveal';
import { Section, SectionHeading } from '@/components/marketing/section';

/**
 * The problem section.
 *
 * Named after the feeling rather than the feature: a student does not want
 * "unified data aggregation", they want to stop losing things across six
 * places. Each card names one of those places.
 */
const PROBLEMS = [
  {
    title: 'Six tabs, one class',
    body: 'Classwork in one place, the doc in another, the deadline somewhere else entirely.',
  },
  {
    title: 'Deadlines that hide',
    body: 'Due dates live inside assignments you have to open one at a time to find.',
  },
  {
    title: 'Announcements that vanish',
    body: 'The one message about the test scrolls away under three weeks of posts.',
  },
  {
    title: 'No single inbox',
    body: 'Nothing tells you what actually changed across your classes since yesterday.',
  },
  {
    title: 'Context you rebuild daily',
    body: 'Every time you sit down you reconstruct where you were from scratch.',
  },
  {
    title: 'No honest "what is next"',
    body: 'Plenty of lists. None of them know what is urgent versus what just looks urgent.',
  },
] as const;

export function ValueGrid() {
  return (
    <Section id="product" className="border-t border-depth-line">
      <SectionHeading
        eyebrow="The problem"
        title={
          <>
            Everything school throws at you.
            <br className="hidden sm:block" /> One place.
          </>
        }
        lede="School information is scattered across half a dozen surfaces that do not talk to each other. Coursen is the layer that connects them."
      />

      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROBLEMS.map((item, index) => (
          <Reveal
            key={item.title}
            as="li"
            step={((index % 3) + 1) as 1 | 2 | 3}
            className="lift rounded-xl border border-depth-line bg-white/[0.03] p-6 hover:border-depth-line-strong"
          >
            {/* "Order comes from alignment, not decoration" - the kit has no
                iconography for problems, so these are numbered rather than
                given approximate glyphs. */}
            <span
              aria-hidden="true"
              className="text-metadata font-semibold tabular-nums text-depth-accent"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-3 card-heading text-depth-ink">{item.title}</h3>
            <p className="mt-2 text-small-body text-depth-muted">{item.body}</p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
