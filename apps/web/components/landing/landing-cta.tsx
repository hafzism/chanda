import { ArrowRight, BookOpen, Check, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { landingElementIds, landingRoutes } from './landing-content';

export function LandingCallToAction() {
  return (
    <section
      className="landing-cta"
      id={landingElementIds.callToAction}
      aria-labelledby={landingElementIds.callToActionTitle}
    >
      <Image
        className="cta-artwork"
        src="/landing/footerpanda.png"
        alt="Friendly Chanda AI panda waving"
        width={1536}
        height={1024}
        sizes="(max-width: 992px) 90vw, 44vw"
      />
      <div className="cta-copy">
        <h2 id={landingElementIds.callToActionTitle}>
          Ready to supercharge
          <br />
          your support?
        </h2>
        <p>
          Join teams that are already saving time and making their customers
          happier.
        </p>
        <Link className="button primary-button" href={landingRoutes.signUp}>
          Get started <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
      <div className="cta-assurances" aria-label="Account assurances">
        <span>
          <Check aria-hidden="true" size={15} /> No credit card required
        </span>
        <span>
          <ShieldCheck aria-hidden="true" size={15} /> Human-controlled replies
        </span>
        <span>
          <BookOpen aria-hidden="true" size={15} /> Inspectable sources
        </span>
      </div>
    </section>
  );
}
