import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(resolve('app/page.tsx'), 'utf8');
const landingComponentDirectory = resolve('components/landing');
const landingComponentSource = readdirSync(landingComponentDirectory)
  .filter((fileName) => /\.tsx?$/.test(fileName))
  .sort()
  .map((fileName) =>
    readFileSync(resolve(landingComponentDirectory, fileName), 'utf8'),
  )
  .join('\n');
const landingSource = `${pageSource}\n${landingComponentSource}`;
const styles = readFileSync(resolve('app/globals.css'), 'utf8');
const nextConfig = readFileSync(resolve('next.config.ts'), 'utf8');

function getCssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));

  expect(rule, `Missing CSS rule for ${selector}`).not.toBeNull();
  return rule?.[1] ?? '';
}

describe('public landing page', () => {
  it('keeps every navigation and conversion link attached to a real destination', () => {
    expect(landingSource).toContain("features: 'features'");
    expect(landingSource).toContain("workflow: 'workflow'");
    expect(landingSource).toContain("callToAction: 'safety'");
    expect(landingSource).toContain("signIn: '/sign-in'");
    expect(landingSource).toContain("signUp: '/sign-up'");
    expect(landingSource).toContain('id={landingElementIds.features}');
    expect(landingSource).toContain('id={landingElementIds.workflow}');
    expect(landingSource).toContain('id={landingElementIds.callToAction}');
  });

  it('ships the supplied hero and capability artwork without violating the no-gradient system', () => {
    expect(landingSource).toContain('/landing/pandahero.png');
    expect(landingSource).not.toContain('className="hero-visual"');
    expect(landingSource).toContain('/landing/chat.png');
    expect(landingSource).toContain('/landing/puzzle1.png');
    expect(landingSource).toContain('/landing/book1.png');
    expect(landingSource).toContain('/landing/growth.png');
    expect(landingSource).toContain('/landing/panda1.png');
    expect(landingSource).toContain('/landing/panda2.png');
    expect(landingSource).toContain('/landing/panda3.png');
    expect(landingSource).toContain('/landing/panda4.png');
    expect(landingSource).toContain('/landing/footerpanda.png');
    expect(landingSource).toContain('quality={95}');
    expect(landingSource).toContain('sizes="6.6rem"');
    expect(nextConfig).toContain('qualities: [75, 95]');
    expect(landingSource).not.toContain('IllustrationPlaceholder');
    expect(styles).not.toMatch(/(?:linear|radial|conic)-gradient/i);
  });

  it('applies the premium responsive and accessibility contracts', () => {
    expect(landingSource).toContain('className="skip-link"');
    expect(landingSource).toContain("hero: 'main-content'");
    expect(landingSource).toContain('id={landingElementIds.hero}');
    expect(landingSource).not.toContain('placeholder-window');
    expect(landingSource).not.toContain('placeholder-character');
    expect(styles).not.toContain('.illustration-placeholder');
    expect(styles).toContain('.workflow-artwork');
    expect(styles).toContain('.cta-artwork');
    expect(styles).toContain('position: fixed');
    expect(styles).toContain('width: 100%');
    expect(styles).toContain('--landing-content: 88rem');
    expect(styles).toContain('min-height: 2.75rem');
    expect(styles).toContain('overflow-x: clip');
    expect(styles).toContain('scrollbar-width: none');
    expect(styles).toContain('html:has(.landing)::-webkit-scrollbar');
    expect(landingSource).toContain('one chat away.');
    expect(landingSource).toContain('Ready to supercharge');
    expect(landingSource).not.toContain('Grounded customer support');
    expect(landingSource).not.toContain(
      'Ready to make every answer more useful?',
    );
    expect(styles).toContain('--landing-panel: #fde9cc');
    expect(styles).toContain('box-shadow: none');
    expect(styles).not.toContain('.capability-strip article + article::before');
    expect(styles).not.toContain('.cta-assurances span + span');
    expect(styles).not.toContain('box-shadow: inset 0 0 0 1px');
    expect(styles).toContain('filter: drop-shadow');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');

    for (const selector of [
      '.capability-strip',
      '.landing-cta',
      '.cta-assurances',
    ]) {
      const rule = getCssRule(selector);
      expect(rule).not.toMatch(/^\s*border\s*:/m);
      expect(rule).not.toMatch(/^\s*box-shadow\s*:/m);
    }
  });
});
