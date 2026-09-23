import { brand } from '@classpilot/shared';
import { CoursenIcon, type CoursenIconName } from '@/components/coursen-icon';
import { Reveal } from '@/components/motion/reveal';
import { Section, SectionHeading } from '@/components/marketing/section';

/**
 * Where Coursen is going: the agent.
 *
 * THIS SECTION IS THE ROADMAP, AND IT SAYS SO.
 *
 * Browsing, clicking, editing documents, building slides and producing PDFs
 * are the product's direction, and there is a typed contract for most of them
 * in @classpilot/shared - name, input schema, permission class. What there is
 * not, yet, is an implementation: every one of those tools is `status:
 * 'planned'` and the executor refuses to run it.
 *
 * So this sells the vision at full strength and is unambiguous about tense.
 * Each capability carries its real state, the section is headed "on the
 * roadmap", and nothing here is written in the present tense. The one thing
 * that would cost more than the section gains is a student arriving expecting
 * Coursen to write their slides today.
 *
 * When a capability ships, change its `state` to 'available' and move it into
 * the product sections above. The copy needs no other edit.
 */

type CapabilityState = 'building' | 'designed' | 'explored';

const STATE_LABELS: Record<CapabilityState, string> = {
  /** Contract written, implementation under way. */
  building: 'In development',
  /** Contract and permission model agreed, not yet built. */
  designed: 'Designed',
  /** Direction we are committed to, details still open. */
  explored: 'On the roadmap',
};

interface Capability {
  icon: CoursenIconName;
  title: string;
  body: string;
  state: CapabilityState;
}

const CAPABILITIES: Capability[] = [
  {
    icon: 'source',
    title: 'Open the sources your work points at',
    body: 'An assignment links to an article, a dataset, a reading. Coursen will open it in your own browser, with the sessions you are already signed into - you approve the site, once, and it tells you why it needs it.',
    state: 'designed',
  },
  {
    icon: 'search',
    title: 'Read a page and bring back what matters',
    body: 'Headings, the readable text, the links worth following. Structured context Coursen can actually reason over, so it answers from the source your teacher set rather than from the internet at large.',
    state: 'designed',
  },
  {
    icon: 'assignment',
    title: 'Work through a site, with your say-so',
    body: 'Navigating a multi-page resource, following a citation, stepping through an interactive exercise. Every action you can see before it happens, and nothing runs without you approving that task.',
    state: 'explored',
  },
  {
    icon: 'file',
    title: 'Draft into your Google Docs',
    body: 'An outline in the doc you are already writing in, from the assignment brief and the sources you gathered. Your document, your words to approve - Coursen drafts, you decide what stays.',
    state: 'explored',
  },
  {
    icon: 'classes',
    title: 'Build the deck, not just the outline',
    body: 'Turn a project brief and your research into slides you can open, edit and present. The structure and the first draft, so the work starts from something instead of an empty file.',
    state: 'explored',
  },
  {
    icon: 'check',
    title: 'Hand it back as a document you can submit',
    body: 'Study guides, revision sheets and project drafts exported as clean PDFs - formatted, readable, and yours to check before anything leaves your machine.',
    state: 'explored',
  },
];

/** Reveal's stagger steps map to the .delay-step-N utilities, which stop at 5. */
const STAGGER = [1, 2, 3, 4, 5] as const;

export function AgentRoadmap() {
  return (
    <Section id="roadmap" className="border-t border-depth-line">
      <SectionHeading
        eyebrow="Where this is going"
        title={
          <>
            A workspace that can do the legwork.
            <br />
            Not one that does your homework.
          </>
        }
        lede={`${brand.shortName} is being built into an agent for a student's school life: one that can open the sources an assignment points at, read them, and help you turn them into work you actually hand in. None of the capabilities below have shipped yet - each one says where it has got to.`}
      />

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        {CAPABILITIES.map((capability, index) => (
          <li key={capability.title}>
            <Reveal step={STAGGER[index % STAGGER.length]} className="h-full">
              <article className="flex h-full flex-col rounded-lg border border-depth-line bg-white/[0.03] p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <CoursenIcon
                    name={capability.icon}
                    size={22}
                    className="h-[22px] w-[22px] shrink-0 text-depth-accent"
                  />
                  <span className="shrink-0 rounded-full border border-depth-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-depth-muted">
                    {STATE_LABELS[capability.state]}
                  </span>
                </div>
                <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.02em] text-depth-ink">
                  {capability.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-depth-muted">
                  {capability.body}
                </p>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>

      {/*
        The boundary, stated on the marketing page rather than buried in a
        policy. It is a product position, not a disclaimer: a tool that would
        submit for you is a tool a student cannot safely use.
      */}
      <Reveal step={5}>
        <div className="mt-10 rounded-lg border border-depth-line bg-depth-sunken/60 p-6 sm:mt-12 sm:p-8">
          <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-depth-ink">
            Two things {brand.shortName} will never do
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <p className="text-[14px] leading-relaxed text-depth-muted">
              <span className="font-semibold text-depth-ink">
                Turn work in for you.
              </span>{' '}
              Submitting an assignment, typing into a graded form, sending
              something as you. There is no button for it and no tool behind
              it - that is your decision to make, every time.
            </p>
            <p className="text-[14px] leading-relaxed text-depth-muted">
              <span className="font-semibold text-depth-ink">
                Reach somewhere you did not send it.
              </span>{' '}
              Opening a site, reading a page or editing a document is asked for
              in plain language, for one place, and you can say no. Reading the
              coursework already in your workspace never asks.
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
