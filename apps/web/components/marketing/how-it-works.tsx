import { Reveal } from '@/components/motion/reveal';
import { Section, SectionHeading } from '@/components/marketing/section';
import { brand } from '@classpilot/shared';

/**
 * How it works.
 *
 * Three steps, numbered, with the honest mechanism stated in each. The point
 * is to remove the "what is this actually doing to my account" worry before
 * it becomes a reason not to sign up.
 */
const STEPS = [
  {
    title: `Install ${brand.extensionName}`,
    body: 'A small Chrome extension that reads Classroom pages you can already open. No password, no admin approval, no Google OAuth prompt.',
  },
  {
    title: 'Sync your classes',
    body: 'One click. Coursen reads your classes and classwork in a background tab and brings the structure across - titles, due dates, points, status, attachments.',
  },
  {
    title: 'Work from one place',
    body: 'Your week resolves into Today, Upcoming and Missing. As more sources connect, Coursen gets better at telling you what actually matters next.',
  },
] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" className="border-t border-depth-line">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
        <SectionHeading
          eyebrow="How it works"
          title="Connected in about two minutes"
          lede="Coursen reads what you can already see. Nothing is scraped from behind a login you do not have."
        />

        <ol className="space-y-px">
          {STEPS.map((step, index) => (
            <Reveal
              key={step.title}
              as="li"
              step={((index % 3) + 1) as 1 | 2 | 3}
              className="relative flex gap-5 border-b border-depth-line py-7 first:pt-0 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-depth-line-strong bg-white/[0.04] text-[13px] font-bold tabular-nums text-depth-glow"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-depth-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-depth-muted">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}
