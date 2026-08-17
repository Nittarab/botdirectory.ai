// Popover listbox behaviour for <Select />. Astro hoists this script once per
// page; the per-root guard keeps it idempotent regardless.
function setup(root: HTMLElement): void {
  if (root.dataset.selectReady) return;
  root.dataset.selectReady = '1';
  const input = root.querySelector<HTMLInputElement>('input[type="hidden"]');
  const trigger = root.querySelector<HTMLButtonElement>('.sel-trigger');
  const triggerBody = root.querySelector<HTMLElement>('.sel-trigger-body');
  const pop = root.querySelector<HTMLElement>('.sel-pop');
  const search = root.querySelector<HTMLInputElement>('.sel-search-input');
  const list = root.querySelector<HTMLElement>('.sel-list');
  const emptyMsg = root.querySelector<HTMLElement>('.sel-empty');
  if (!input || !trigger || !triggerBody || !pop || !list) return;

  const options = Array.from(list.querySelectorAll<HTMLElement>('.sel-opt'));
  let active = -1;

  const visible = () => options.filter((o) => !o.hidden);

  function setActive(el: HTMLElement | null): void {
    for (const o of options) o.classList.toggle('is-active', o === el);
    active = el ? options.indexOf(el) : -1;
    if (el) {
      list!.setAttribute('aria-activedescendant', el.id || (el.id = `${input!.id}-opt-${active}`));
      el.scrollIntoView({ block: 'nearest' });
    } else {
      list!.removeAttribute('aria-activedescendant');
    }
  }

  function filter(q: string): void {
    const needle = q.trim().toLowerCase();
    for (const o of options) o.hidden = !!needle && !(o.dataset.label || '').includes(needle);
    const shown = visible();
    if (emptyMsg) emptyMsg.hidden = shown.length > 0;
    const cur = active >= 0 ? options[active] : null;
    setActive(cur && !cur.hidden ? cur : shown[0] ?? null);
  }

  function open(): void {
    if (!pop!.hidden) return;
    pop!.hidden = false;
    trigger!.setAttribute('aria-expanded', 'true');
    if (search) {
      search.value = '';
      filter('');
      search.focus();
    } else {
      list!.focus();
    }
    setActive(options.find((o) => o.getAttribute('aria-selected') === 'true') ?? visible()[0] ?? null);
    document.addEventListener('pointerdown', onOutside, true);
  }

  function close(focusTrigger = false): void {
    if (pop!.hidden) return;
    pop!.hidden = true;
    trigger!.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    if (focusTrigger) trigger!.focus();
  }

  function onOutside(e: Event): void {
    if (!root.contains(e.target as Node)) close();
  }

  function pick(el: HTMLElement): void {
    const value = el.dataset.value ?? '';
    for (const o of options) o.setAttribute('aria-selected', o === el ? 'true' : 'false');
    triggerBody!.innerHTML = el.querySelector('.sel-opt-body')!.innerHTML;
    // The trigger reuses the option's markup; only the label span class differs.
    triggerBody!.querySelector('.sel-opt-label')?.classList.replace('sel-opt-label', 'sel-trigger-label');
    if (input!.value !== value) {
      input!.value = value;
      input!.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close(true);
  }

  function move(delta: number): void {
    const shown = visible();
    if (!shown.length) return;
    const cur = active >= 0 ? shown.indexOf(options[active]) : -1;
    const next = cur < 0 ? (delta > 0 ? 0 : shown.length - 1) : Math.min(shown.length - 1, Math.max(0, cur + delta));
    setActive(shown[next]);
  }

  function onKey(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': e.preventDefault(); setActive(visible()[0] ?? null); break;
      case 'End': e.preventDefault(); setActive(visible().at(-1) ?? null); break;
      case 'Enter':
        e.preventDefault();
        if (active >= 0 && !options[active].hidden) pick(options[active]);
        break;
      case 'Escape': e.preventDefault(); close(true); break;
      case 'Tab': close(); break;
    }
  }

  trigger.addEventListener('click', () => (pop.hidden ? open() : close()));
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
  });
  search?.addEventListener('input', () => filter(search.value));
  search?.addEventListener('keydown', onKey);
  list.addEventListener('keydown', onKey);
  for (const o of options) {
    o.addEventListener('pointermove', () => { if (active !== options.indexOf(o)) setActive(o); });
    o.addEventListener('click', () => pick(o));
  }
}

document.querySelectorAll<HTMLElement>('[data-select]').forEach(setup);

export {};
