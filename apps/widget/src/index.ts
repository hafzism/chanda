import { SupplineWidgetElement } from './widget-element';

export const WIDGET_PACKAGE_NAME = '@suppline/widget';

export interface SupplineWidgetOptions {
  apiOrigin?: string;
  position?: 'left' | 'right';
  publicKey: string;
  title?: string;
}

export function mount(options: SupplineWidgetOptions): HTMLElement {
  registerElement();
  const widget = document.createElement('suppline-widget');
  widget.setAttribute('public-key', options.publicKey);
  if (options.apiOrigin) widget.setAttribute('api-origin', options.apiOrigin);
  if (options.position) widget.setAttribute('position', options.position);
  if (options.title) widget.setAttribute('title', options.title);
  document.body.append(widget);
  return widget;
}

function registerElement(): void {
  if (!customElements.get('suppline-widget')) {
    customElements.define('suppline-widget', SupplineWidgetElement);
  }
}

function scriptOptions(): SupplineWidgetOptions | null {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return null;
  const publicKey = script.dataset.publicKey ?? script.dataset.workspaceKey;
  if (!publicKey) return null;
  const apiOrigin =
    script.dataset.apiOrigin ||
    (script.src ? new URL(script.src, window.location.href).origin : undefined);
  return {
    ...(apiOrigin ? { apiOrigin } : {}),
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
