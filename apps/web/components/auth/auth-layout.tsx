import { BookOpen, MessagesSquare, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { Brand } from '../brand';

interface AuthLayoutProps {
  children: ReactNode;
}

const assurances = [
  { icon: BookOpen, text: 'Answers grounded in your approved knowledge' },
  { icon: MessagesSquare, text: 'Every customer conversation in one place' },
  { icon: ShieldCheck, text: 'Human review when confidence is not enough' },
];

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Suppline AI overview">
        <Brand />
        <div className="auth-story-copy">
          <p className="eyebrow">Support operations, composed</p>
          <h2>Give every answer a source—and every risk a human.</h2>
          <p>
            A focused workspace for teams that want useful automation without
            losing judgment, context, or control.
          </p>
        </div>
        <ul className="assurance-list">
          {assurances.map(({ icon: Icon, text }) => (
            <li key={text}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p className="auth-note">
          Built for support teams who care how an answer was made.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        {children}
      </section>
    </main>
  );
}
