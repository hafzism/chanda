import {
  BarChart3,
  BookOpen,
  CreditCard,
  Globe2,
  Inbox,
  KeyRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export type AppSection =
  | 'Inbox'
  | 'Knowledge'
  | 'Channels'
  | 'Team'
  | 'Analytics'
  | 'AI provider'
  | 'Billing';

export interface AppNavigationItem {
  icon: LucideIcon;
  label: AppSection;
}

export const APP_NAVIGATION: readonly AppNavigationItem[] = [
  { icon: Inbox, label: 'Inbox' },
  { icon: BookOpen, label: 'Knowledge' },
  { icon: Globe2, label: 'Channels' },
  { icon: UsersRound, label: 'Team' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: KeyRound, label: 'AI provider' },
  { icon: CreditCard, label: 'Billing' },
];

const SECTION_DESCRIPTIONS: Record<AppSection, string> = {
  Analytics: 'Review support volume, outcomes, and retrieval quality.',
  Billing: 'Manage the workspace plan and subscription.',
  Channels: 'Connect and manage customer messaging channels.',
  Inbox: 'Review conversations, evidence, and replies.',
  Knowledge: 'Manage the approved sources used for grounded answers.',
  'AI provider': 'Connect the workspace key used for drafting and retrieval.',
  Team: 'Manage workspace access and roles.',
};

export function isAppSection(value: string | null): value is AppSection {
  return APP_NAVIGATION.some(({ label }) => label === value);
}

export function sectionDescription(section: AppSection): string {
  return SECTION_DESCRIPTIONS[section];
}
