import { Hero } from '@/components/marketing/hero';
import { ValueGrid } from '@/components/marketing/value-grid';
import { IntegrationShowcase } from '@/components/marketing/integration-showcase';
import { DashboardPreview } from '@/components/marketing/dashboard-preview';
import { AskPreview } from '@/components/marketing/ask-preview';
import { AgentRoadmap } from '@/components/marketing/agent-roadmap';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { FinalCta } from '@/components/marketing/final-cta';

/**
 * Public homepage.
 *
 * Static by design - it reads no user data and makes no API call, so it
 * renders instantly and is unaffected by whether the API is up. Every piece
 * of sample content comes from _data/demo.ts and is clearly labelled as a
 * preview.
 *
 * Section order follows the pitch: what it is (hero), why it is needed
 * (problem), what it connects to (integrations), what it looks like
 * (dashboard), where it is going (assistant, then the agent roadmap), how to
 * start (how it works).
 *
 * The roadmap section is the one place the page describes capabilities that
 * do not exist yet. It carries its own per-item state labels so the tense is
 * never ambiguous - see agent-roadmap.tsx.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <ValueGrid />
      <IntegrationShowcase />
      <DashboardPreview />
      <AskPreview />
      <AgentRoadmap />
      <HowItWorks />
      <FinalCta />
    </>
  );
}
