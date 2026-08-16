import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

import { landingElementIds, landingWorkflowSteps } from './landing-content';

export function WorkflowSection() {
  return (
    <section
      className="landing-workflow"
      id={landingElementIds.workflow}
      aria-labelledby={landingElementIds.workflowTitle}
    >
      <div className="landing-section-heading">
        <p className="eyebrow">One clear path</p>
        <h2 id={landingElementIds.workflowTitle}>How it works</h2>
        <p>
          From scattered questions to accountable answers in four focused steps.
        </p>
      </div>

      <ol className="workflow-grid">
        {landingWorkflowSteps.map(({ alt, body, image, title }, index) => (
          <li key={title}>
            <Image
              className="workflow-artwork"
              src={image}
              alt={alt}
              width={500}
              height={500}
              sizes="(max-width: 704px) 82vw, (max-width: 992px) 42vw, 20vw"
            />
            <div className="workflow-copy">
              <span>0{index + 1}</span>
              <h3>{title}</h3>
            </div>
            <p>{body}</p>
            {index < landingWorkflowSteps.length - 1 && (
              <ArrowRight
                className="workflow-arrow"
                size={22}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
