type LandingImagePath = `/landing/${string}.png`;

interface LandingCapability {
  body: string;
  image: LandingImagePath;
  title: string;
}

interface LandingWorkflowStep extends LandingCapability {
  alt: string;
}

interface LandingNavigationItem {
  href: `#${string}`;
  label: string;
}

export const landingElementIds = {
  callToAction: 'safety',
  callToActionTitle: 'cta-title',
  features: 'features',
  hero: 'main-content',
  heroTitle: 'hero-title',
  workflow: 'workflow',
  workflowTitle: 'workflow-title',
} as const;

export const landingRoutes = {
  features: `#${landingElementIds.features}`,
  mainContent: `#${landingElementIds.hero}`,
  safety: `#${landingElementIds.callToAction}`,
  signIn: '/sign-in',
  signUp: '/sign-up',
  workflow: `#${landingElementIds.workflow}`,
} as const;

export const landingNavigationItems = [
  { href: landingRoutes.features, label: 'Features' },
  { href: landingRoutes.workflow, label: 'How it works' },
  { href: landingRoutes.safety, label: 'Safety' },
] as const satisfies readonly LandingNavigationItem[];

export const landingCapabilities = [
  {
    image: '/landing/chat.png',
    title: 'One shared inbox',
    body: 'Bring web chat, email, and messaging conversations into one calm queue.',
  },
  {
    image: '/landing/puzzle1.png',
    title: 'Safe by design',
    body: 'Risk rules and human review keep sensitive answers in the right hands.',
  },
  {
    image: '/landing/book1.png',
    title: 'Grounded answers',
    body: 'Every AI draft is built from approved company knowledge and clear sources.',
  },
  {
    image: '/landing/growth.png',
    title: 'Smarter operations',
    body: 'Evaluate retrieval and draft outcomes so support improves with evidence.',
  },
] as const satisfies readonly LandingCapability[];

export const landingWorkflowSteps = [
  {
    image: '/landing/panda1.png',
    alt: 'Panda connecting support channels and knowledge sources',
    title: 'Connect',
    body: 'Add your support channels and approved knowledge sources.',
  },
  {
    image: '/landing/panda2.png',
    alt: 'Panda listening to customer conversations',
    title: 'Listen',
    body: 'Customer questions arrive in one workspace with context intact.',
  },
  {
    image: '/landing/panda3.png',
    alt: 'Panda grounding an answer in approved evidence',
    title: 'Ground',
    body: 'Chanda finds relevant evidence and prepares a cited draft.',
  },
  {
    image: '/landing/panda4.png',
    alt: 'Panda reviewing support outcomes and improvements',
    title: 'Resolve',
    body: 'Your team reviews, replies, and learns from the outcome.',
  },
] as const satisfies readonly LandingWorkflowStep[];
