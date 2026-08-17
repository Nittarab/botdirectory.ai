// Home-page interactivity: filter / sort / search / view toggle over the
// statically rendered rows. Rows are never re-created — they are shown,
// hidden and reordered in place, so the full list stays in the HTML.
import { deltaFor, refreshCopyLabels } from './copies';

interface BrowseState {
  category: string;
  integration: string;
  query: string;
  sort: 'copies' | 'name';
  view: 'table' | 'cards';
}

function init(): void {
  const search = document.getElementById('bot-search') as HTMLInputElement | null;
  // The selects are <Select /> components: a hidden input that fires `change`.
  const category = document.getElementById('bot-category') as HTMLInputElement | null;
  const integration = document.getElementById('bot-integration') as HTMLInputElement | null;
  const sort = document.getElementById('bot-sort') as HTMLInputElement | null;
  const btnTable = document.getElementById('view-table-btn');
  const btnCards = document.getElementById('view-cards-btn');
  const tableView = document.getElementById('table-view');
  const cardsView = document.getElementById('cards-view');
  const empty = document.getElementById('empty-state');
  // `sort` is optional: the select is hidden pre-launch while copy counts are hidden.
  if (!search || !category || !integration || !btnTable || !btnCards || !tableView || !cardsView || !empty) return;

  const state: BrowseState = {
    category: new URLSearchParams(location.search).get('category') || 'All',
    integration: 'all',
    query: '',
    sort: 'copies',
    view: 'table',
  };
  // Bot pages deep-link here with ?category=…; reflect it in the select.
  category.dispatchEvent(new CustomEvent('select:set', { detail: state.category }));

  /** Keep ?category= shareable without adding history entries. */
  function syncUrl(): void {
    const url = new URL(location.href);
    if (state.category === 'All') url.searchParams.delete('category');
    else url.searchParams.set('category', state.category);
    history.replaceState(null, '', url);
  }

  const effectiveCopies = (row: HTMLElement): number =>
    Number(row.dataset.copies || '0') + deltaFor(row.dataset.slug || '');

  const matches = (row: HTMLElement, q: string): boolean =>
    (state.category === 'All' || row.dataset.category === state.category) &&
    (state.integration === 'all' || (row.dataset.integrations || '').split('|').includes(state.integration)) &&
    (!q || (row.dataset.search || '').includes(q));

  function applyTo(container: HTMLElement): number {
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-slug], [data-promo]'));
    const botRows = rows.filter((r) => !r.hasAttribute('data-promo'));
    const promoRows = rows.filter((r) => r.hasAttribute('data-promo'));
    const q = state.query.trim().toLowerCase();

    const visible = botRows.filter((r) => matches(r, q));
    visible.sort(
      state.sort === 'name'
        ? (a, b) => (a.dataset.name || '').localeCompare(b.dataset.name || '')
        : (a, b) => effectiveCopies(b) - effectiveCopies(a)
    );

    // Promoted rows keep their fixed positions in the visible list.
    const ordered = [...visible];
    for (const p of promoRows) {
      ordered.splice(Math.min(Number(p.dataset.at || '0'), ordered.length), 0, p);
    }
    const hiddenRows = botRows.filter((r) => !visible.includes(r));

    for (const r of ordered) r.hidden = false;
    for (const r of hiddenRows) r.hidden = true;
    // Reorder in place (the table header stays first: only rows move).
    for (const r of [...ordered, ...hiddenRows]) container.appendChild(r);

    return visible.length + promoRows.length;
  }

  function apply(): void {
    applyTo(tableView!);
    applyTo(cardsView!);
    const anyVisible = tableView!.querySelectorAll('[data-slug]:not([hidden])').length > 0;
    empty!.hidden = anyVisible;
  }

  function syncView(): void {
    tableView!.hidden = state.view !== 'table';
    cardsView!.hidden = state.view !== 'cards';
    btnTable!.classList.toggle('active', state.view === 'table');
    btnCards!.classList.toggle('active', state.view === 'cards');
  }

  search.addEventListener('input', () => {
    state.query = search.value;
    apply();
  });
  category.addEventListener('change', () => {
    state.category = category.value || 'All';
    syncUrl();
    apply();
  });
  integration.addEventListener('change', () => {
    state.integration = integration.value;
    apply();
  });
  sort?.addEventListener('change', () => {
    state.sort = sort.value === 'name' ? 'name' : 'copies';
    apply();
  });
  btnTable.addEventListener('click', () => {
    state.view = 'table';
    syncView();
  });
  btnCards.addEventListener('click', () => {
    state.view = 'cards';
    syncView();
  });

  refreshCopyLabels();
  apply();
  syncView();
}

init();
