import { CapabilityStrip } from '../components/landing/capability-strip';
import { landingRoutes } from '../components/landing/landing-content';
import { LandingCallToAction } from '../components/landing/landing-cta';
import { LandingFooter } from '../components/landing/landing-footer';
import { LandingHeader } from '../components/landing/landing-header';
import { LandingHero } from '../components/landing/landing-hero';
import { WorkflowSection } from '../components/landing/workflow-section';

export default function HomePage() {
  return (
    <main className="landing">
      <a className="skip-link" href={landingRoutes.mainContent}>
        Skip to main content
      </a>
      <div className="landing-paper">
        <LandingHeader />
        <LandingHero />
        <CapabilityStrip />
        <WorkflowSection />
        <LandingCallToAction />
        <LandingFooter />
      </div>
    </main>
  );
}
