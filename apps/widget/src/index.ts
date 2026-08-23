import { ChandaWidgetElement } from './widget-element';

export const WIDGET_PACKAGE_NAME = '@suppline/widget';

export interface ChandaWidgetOptions {
  apiOrigin?: string;
  logoUrl?: string;
  position?: 'left' | 'right';
  publicKey: string;
  title?: string;
}

export function mount(options: ChandaWidgetOptions): HTMLElement {
  registerElement();
  const widget = document.createElement('chanda-widget');
  widget.setAttribute('public-key', options.publicKey);
  if (options.apiOrigin) widget.setAttribute('api-origin', options.apiOrigin);
  if (options.logoUrl) widget.setAttribute('logo-url', options.logoUrl);
  if (options.position) widget.setAttribute('position', options.position);
  if (options.title) widget.setAttribute('title', options.title);
  document.body.append(widget);
  return widget;
}

function registerElement(): void {
  if (!customElements.get('chanda-widget')) {
    customElements.define('chanda-widget', ChandaWidgetElement);
  }
}

function scriptOptions(): ChandaWidgetOptions | null {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return null;
  const publicKey = script.dataset.publicKey ?? script.dataset.workspaceKey;
  if (!publicKey) return null;
  const apiOrigin =
    script.dataset.apiOrigin ||
    (script.src ? new URL(script.src, window.location.href).origin : undefined);
  const logoUrl = script.src
    ? new URL('/brand/chanda-panda-logo.png', script.src).href
    : undefined;
  return {
    ...(apiOrigin ? { apiOrigin } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    ...(script.dataset.position === 'left'
      ? { position: 'left' as const }
      : {}),
    publicKey,
    ...(script.dataset.title ? { title: script.dataset.title } : {}),
  };
}

if (typeof window !== 'undefined') {
  registerElement();
  const options = scriptOptions();
  if (options && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mount(options), {
      once: true,
    });
  } else {
    if (options) mount(options);
  }
}
