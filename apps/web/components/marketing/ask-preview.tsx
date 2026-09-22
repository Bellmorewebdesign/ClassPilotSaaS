'use client';

import { useRef } from 'react';
import { CoursenIcon } from '@/components/coursen-icon';
import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { Reveal } from '@/components/motion/reveal';
import { Section, SectionHeading } from '@/components/marketing/section';
import { useSequence } from '@/components/motion/use-sequence';
import { DEMO_PROMPTS } from '@/app/(marketing)/_data/demo';
import { cn } from '@/lib/utils';

/**
 * Ask Coursen preview.
 *
 * IMPORTANT: this shows the QUESTIONS the assistant is being built to answer,
 * and deliberately shows no answers. Faking a convincing AI response would be
 * the single most dishonest thing on this page, so the composer is visibly
 * disabled and labelled.
 *
 * The motion is just the prompt cycling in the input, which communicates
 * "this understands your school context" without asserting it works yet.
 */
export function AskPreview() {
  const root = useRef<HTMLDivElement>(null);
  const { step } = useSequence(DEMO_PROMPTS.length, {
    stepDurationMs: 2600,
    holdMs: 2600,
    ref: root,
  });

  return (
    <Section className="border-t border-depth-line">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <SectionHeading
          eyebrow={brand.assistantTitle}
          title="Ask about your school week"
          lede="Once your sources are connected, Coursen will answer from your actual coursework - not from the internet at large. The assistant is in development; these are the questions it is being built to answer."
        />

        <Reveal step={1}>
          <div ref={root} className="glass-dark rounded-lg p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <BrandMark size={20} className="h-5 w-5 text-depth-accent" />
              <span className="text-[13px] font-semibold text-depth-ink">
                {brand.assistantTitle}
              </span>
              <span className="ml-auto rounded-full border border-depth-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-depth-muted">
                In development
              </span>
            </div>

            {/* The cycling prompt. */}
            <div className="relative flex min-h-[3.25rem] items-center gap-3 rounded-xl border border-depth-line-strong bg-depth-base/60 px-4">
              <CoursenIcon name="search" className="h-4 w-4 shrink-0 text-depth-accent" />
              <span className="relative min-w-0 flex-1 overflow-hidden py-3">
                {DEMO_PROMPTS.map((prompt, index) => (
                  <span
                    key={prompt}
                    aria-hidden={index !== step}
                    className={cn(
                      'block truncate text-[14px] text-depth-ink transition-all duration-slow ease-out',
                      index === step
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none absolute inset-x-0 top-3 translate-y-2 opacity-0',
                    )}
                  >
                    {prompt}
                  </span>
                ))}
              </span>
            </div>

            <ul className="mt-4 flex flex-wrap gap-2">
              {DEMO_PROMPTS.map((prompt) => (
                <li
                  key={prompt}
                  className="rounded-full border border-depth-line bg-white/[0.03] px-3 py-1.5 text-[12px] text-depth-muted"
                >
                  {prompt}
                </li>
              ))}
            </ul>

            <p className="mt-5 border-t border-depth-line pt-4 text-[12px] leading-relaxed text-depth-muted">
              Coursen will answer from your synced coursework. It is not a
              homework-answering bot, and it will not write your assignments
              for you.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
