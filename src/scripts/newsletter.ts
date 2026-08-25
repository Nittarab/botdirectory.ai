type NewsletterResponse = {
  subscribed?: boolean;
  error?: string;
};

function mountNewsletterForm(form: HTMLFormElement): void {
  if (form.dataset.mounted === 'true') return;
  form.dataset.mounted = 'true';

  const input = form.elements.namedItem('email');
  const button = form.querySelector<HTMLButtonElement>('.newsletter-submit');
  const status = form.parentElement?.querySelector<HTMLElement>('[data-newsletter-status]');
  if (!(input instanceof HTMLInputElement) || !button || !status) return;

  const defaultStatus = status.innerHTML;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const email = input.value.trim();
    const endpoint = form.dataset.endpoint || '';
    if (!email || !endpoint) return;

    button.disabled = true;
    button.textContent = 'Subscribing…';
    status.textContent = '';
    status.classList.remove('is-error', 'is-success', 'sr-only');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, source: form.dataset.source || 'website' }),
      });
      const result = (await response.json().catch(() => ({}))) as NewsletterResponse;
      if (!response.ok || !result.subscribed) {
        throw new Error(result.error || 'Could not subscribe right now');
      }

      input.value = '';
      input.disabled = true;
      button.textContent = 'You’re in!';
      status.textContent = 'Newsletter subscription successful.';
      status.classList.add('sr-only');

      const posthog = (window as Window & {
        posthog?: { capture?: (event: string, properties?: Record<string, unknown>) => void };
      }).posthog;
      posthog?.capture?.('newsletter_subscribed', {
        source: form.dataset.source || 'website',
      });
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not subscribe right now';
      status.classList.remove('sr-only');
      status.classList.add('is-error');
      button.disabled = false;
      button.textContent = 'Try again';
      window.setTimeout(() => {
        if (!status.classList.contains('is-error')) return;
        status.innerHTML = defaultStatus;
        status.classList.remove('is-error');
      }, 8000);
    }
  });
}

document.querySelectorAll<HTMLFormElement>('[data-newsletter-form]').forEach(mountNewsletterForm);
