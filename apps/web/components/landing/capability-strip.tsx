import Image from 'next/image';

import { landingCapabilities, landingElementIds } from './landing-content';

export function CapabilityStrip() {
  return (
    <section
      className="capability-strip"
      id={landingElementIds.features}
      aria-label="Product capabilities"
    >
      {landingCapabilities.map(({ body, image, title }) => (
        <article key={title}>
          <span className="capability-icon" aria-hidden="true">
            <Image
              src={image}
              alt=""
              width={1254}
              height={1254}
              sizes="6.6rem"
            />
          </span>
          <h2>{title}</h2>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}
