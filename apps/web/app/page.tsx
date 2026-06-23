import {
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

import { Brand } from '../components/brand';

const principles = [
  {
    icon: BookOpen,
    title: 'Grounded by default',
    body: 'Every suggested answer is tied to approved company knowledge, with sources your team can inspect.',
  },
  {
    icon: ShieldCheck,
    title: 'Judgment stays human',
    body: 'Sensitive, uncertain, or high-impact conversations move to a person with the context already assembled.',
  },
  {
    icon: MessageSquareText,
    title: 'One operating view',
    body: 'Keep web, email, and messaging conversations in a consistent queue instead of scattered tabs.',
  },
];

export default function HomePage() {
  return (
    <main className="landing">
      <header className="landing-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#approach">Approach</a>
          <a href="#workflow">How it works</a>
        </nav>
        <div className="header-actions">
          <Link className="text-link" href="/sign-in">
            Sign in
          </Link>
          <Link className="button small-button primary-button" href="/sign-up">
            Start free <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            AI support, with a point of view
          </p>
          <h1>Let automation answer. Let evidence decide when.</h1>
          <p className="hero-summary">
            Suppline AI brings customer conversations, trusted knowledge, and
            human review into one composed support workspace.
          </p>
          <div className="hero-actions">
            <Link className="button primary-button" href="/sign-up">
              Create your workspace <ArrowRight size={17} />
            </Link>
            <a className="button secondary-button" href="#workflow">
              See the workflow
            </a>
          </div>
          <p className="hero-proof">
            <Check size={15} />
            No credit card required
          </p>
        </div>

        <div
          className="product-frame"
          aria-label="Suppline AI support workspace preview"
        >
          <div className="frame-topbar">
            <div className="frame-brand">
              <span className="brand-mark" />
              <span>Support desk</span>
            </div>
            <span className="live-chip">
              <span /> Live queue
            </span>
          </div>
          <div className="frame-body">
            <aside className="frame-sidebar">
              <span className="sidebar-line active" />
              <span className="sidebar-line" />
              <span className="sidebar-line short" />
              <span className="sidebar-spacer" />
              <span className="sidebar-line" />
            </aside>
            <div className="inbox-list">
              <div className="inbox-heading">
                <span>Inbox</span>
                <strong>12</strong>
              </div>
              <article className="inbox-row active">
                <span className="avatar terracotta">AM</span>
                <div>
                  <strong>Amara Mills</strong>
                  <p>Can I change the delivery…</p>
                </div>
                <time>2m</time>
              </article>
              <article className="inbox-row">
                <span className="avatar ochre">JL</span>
                <div>
                  <strong>Jonah Lee</strong>
                  <p>Question about my invoice</p>
                </div>
                <time>8m</time>
              </article>
              <article className="inbox-row">
                <span className="avatar brown">NS</span>
                <div>
                  <strong>Nila Shah</strong>
                  <p>Thanks, that worked!</p>
                </div>
                <time>14m</time>
              </article>
            </div>
            <div className="conversation-preview">
              <div className="conversation-person">
                <span className="avatar terracotta">AM</span>
                <div>
                  <strong>Amara Mills</strong>
                  <span>Web chat · Active</span>
                </div>
                <span className="priority-chip">Normal</span>
              </div>
              <div className="message customer-message">
                Can I change the delivery address after placing my order?
              </div>
              <div className="ai-draft">
                <div className="draft-label">
                  <Sparkles size={14} />
                  <strong>Grounded draft</strong>
                  <span>2 sources</span>
                </div>
                <p>
                  Yes—your address can be updated until the order enters
                  packing. Share the new address and we’ll confirm the change.
                </p>
                <div className="source-row">
                  <BookOpen size={13} />
                  Order changes · Delivery policy
                </div>
                <div className="draft-actions">
                  <span>
                    <CircleCheck size={14} />
                    Ready to review
                  </span>
                  <b>Send reply</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="principles" id="approach">
        <div className="section-intro">
          <p className="eyebrow">A calmer operating model</p>
          <h2>Useful AI is not the loudest person in the room.</h2>
          <p>
            It brings the right evidence forward, handles the ordinary, and
            knows when to step aside.
          </p>
        </div>
        <div className="principle-grid">
          {principles.map(({ body, icon: Icon, title }, index) => (
            <article key={title} className="principle-card">
              <span className="card-index">0{index + 1}</span>
              <Icon size={23} strokeWidth={1.7} />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow" id="workflow">
        <div>
          <p className="eyebrow">One clear path</p>
          <h2>From question to accountable answer.</h2>
        </div>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>Listen</strong>
              <p>
                A customer message enters one shared queue with its channel
                context intact.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Ground</strong>
              <p>
                Suppline retrieves the most relevant approved knowledge and
                prepares a cited draft.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Decide</strong>
              <p>
                Clear cases move quickly. Risk, uncertainty, and exceptions
                arrive with a human.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="closing-cta">
        <p className="eyebrow">Start with one workspace</p>
        <h2>Make support feel considered again.</h2>
        <Link className="button light-button" href="/sign-up">
          Create your workspace <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="landing-footer">
        <Brand />
        <p>Grounded answers. Human judgment.</p>
        <span>© 2026 Suppline AI</span>
      </footer>
    </main>
  );
}
