import { ArrowRight, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { landingElementIds, landingRoutes } from './landing-content';

export function LandingHero() {
  return (
    <section
      className="landing-hero"
      id={landingElementIds.hero}
      aria-labelledby={landingElementIds.heroTitle}
    >
      <div className="landing-hero-copy">
        <h1 id={landingElementIds.heroTitle}>
          <span className="hero-line">Your team’s</span>
          <span className="hero-line">knowledge, always</span>
          <span className="hero-line hero-accent-line">one chat away.</span>
        </h1>
        <p className="hero-summary">
          AI-powered support that understands your company’s context, prepares
          evidence-backed answers, and keeps human judgment in control.
        </p>
        <div className="hero-actions">
          <Link className="button primary-button" href={landingRoutes.signUp}>
            Create your workspace <ArrowRight aria-hidden="true" size={17} />
          </Link>
          <a className="button secondary-button" href={landingRoutes.workflow}>
            See how it works
          </a>
        </div>
        <p className="hero-proof">
          <ShieldCheck aria-hidden="true" size={16} />
          Secure by design. Your sources stay workspace-isolated.
        </p>
      </div>

      <Image
        className="hero-artwork"
        src="/landing/pandahero.png"
        alt="Friendly panda support assistant working at a laptop"
        width={1448}
        height={1086}
        sizes="(max-width: 992px) 90vw, 54rem"
        quality={95}
        preload
      />
    </section>
  );
}
