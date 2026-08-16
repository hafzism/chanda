import Link from 'next/link';

import { Brand } from '../brand';
import { landingNavigationItems, landingRoutes } from './landing-content';

export function LandingHeader() {
  return (
    <header className="landing-header">
      <Brand />
      <nav aria-label="Main navigation">
        {landingNavigationItems.map(({ href, label }) => (
          <a href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <Link className="text-link" href={landingRoutes.signIn}>
          Sign in
        </Link>
        <Link
          className="button small-button primary-button"
          href={landingRoutes.signUp}
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
