import { Reveal } from '@/components/motion/reveal';
import { Section, SectionHeading } from '@/components/marketing/section';
import { IntegrationCard } from '@/components/integrations/integration-card';
import { INTEGRATIONS, resolveState } from '@/lib/integrations/registry';

/**
 * Integration showcase.
 *
 * Reads the same registry the in-app integrations centre uses, so the public
 * claims and the product can never drift apart. `resolveState` forces every
 * unimplemented integration to "Coming soon" - the marketing page physically
 * cannot advertise a connection that does not exist.
 */
export function IntegrationShowcase() {
  return (
    <Section id="integrations" className="border-t border-depth-line">
      <SectionHeading
        eyebrow="Integrations"
        title="Connected to where your school already lives"
        lede="Classroom works today. Calendar, Drive and Docs are next - each one adds context Coursen can reason about."
      />

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INTEGRATIONS.map((definition, index) => (
          <Reveal
            key={definition.id}
            step={((index % 4) + 1) as 1 | 2 | 3 | 4}
            className="h-full"
          >
            <IntegrationCard
              definition={definition}
              tone="depth"
              // "available", not "connected": this page describes what the
              // product can do, not what any particular visitor has set up.
              state={resolveState(definition, 'available')}
              detail={
                definition.implemented
                  ? definition.method
                  : 'In development'
              }
            />
          </Reveal>
        ))}
      </div>

      <Reveal step={2}>
        <p className="mt-8 text-[13px] leading-relaxed text-depth-muted">
          Coursen never asks for your school password. Classroom is read from
          the browser session you are already signed into, and future
          integrations will connect through your own Google account with
          permissions you choose.
        </p>
      </Reveal>
    </Section>
  );
}
