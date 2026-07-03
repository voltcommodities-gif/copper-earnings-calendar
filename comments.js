const sourceTypeLabels = {
  earnings_call: "Earnings Call",
  press_release: "Resultados",
  operational_report: "Relatório Operacional",
  investor_presentation: "Apresentação",
  interview: "Entrevista",
  news: "Notícia"
};

const weekdayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const monthNamesFull = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const PAGE_SIZE = 3;

const allComments = {}; // key (ex: "cobre") -> array de itens
const visibleCounts = {}; // key -> quantos itens mostrar na coluna (não na tela cheia)
let currentFilterDate = null;
let dailyRefreshTimer = null;

function formatDateLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return weekdayNames[dt.getDay()] + ", " + d + " de " + monthNamesFull[m - 1] + " de " + y;
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength = 130) {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength - 1).trim() + '…' : text;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCard(item, key) {
  const extraLinks = (item.extra_sources || [])
    .map((url, i) => '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Fonte adicional ' + (i + 1) + '</a>')
    .join('');

  const officialUrl = item.source_url && /^https?:\/\//.test(item.source_url)
    ? item.source_url
    : '';
  const officialLink = officialUrl
    ? '<a href="' + escapeHtml(officialUrl) + '" target="_blank" rel="noopener">Fonte oficial</a>'
    : '';

  return (
    '<div class="card card-' + key + '">' +
    '<div class="card-head">' +
    '<div class="card-company">' + escapeHtml(stripHtml(item.company)) + '</div>' +
    '</div>' +
    '<div class="card-summary">' + escapeHtml(stripHtml(item.summary)) + '</div>' +
    '<button class="read-more-btn" type="button">Ler mais</button>' +
    '<div class="card-foot">' +
    '<div class="card-type">' + escapeHtml(sourceTypeLabels[item.source_type] || item.source_type) + '</div>' +
    '<div class="card-links">' + officialLink + extraLinks + '</div>' +
    '</div>' +
    '</div>'
  );
}

function renderFeedHtml(items, filterDate) {
  if (!items.length) {
    return '<div class="feed-empty">' +
      (filterDate ? 'Nenhum comentário nessa data.' : 'Nenhum comentário confirmado ainda.') +
      '</div>';
  }

  const dates = [...new Set(items.map(item => item.date))];

  return dates.map(date => {
    const dayItems = items.filter(item => item.date === date);
    return (
      '<div class="day-group">' +
      '<div class="day-group-header day-group-header-' + dayItems[0]._key + '">' + formatDateLabel(date) + '</div>' +
      dayItems.map(item => renderCard(item, item._key)).join('') +
      '</div>'
    );
  }).join('');
}

// Esconde o botão "Ler mais" em cards cujo resumo já cabe sem truncar.
function setupReadMoreButtons(container) {
  container.querySelectorAll('.card-summary').forEach(summary => {
    const btn = summary.nextElementSibling;
    if (!btn || !btn.classList.contains('read-more-btn')) return;
    if (summary.scrollHeight <= summary.clientHeight + 1) {
      btn.style.display = 'none';
    }
  });
}

// targetId/showAll: usados pela tela cheia, que sempre mostra tudo, sem paginação.
function renderColumn(key, filterDate, targetId, showAll) {
  const feed = document.getElementById(targetId || ('feed-' + key));
  if (!feed) return;

  let items = (allComments[key] || []).map(item => ({ ...item, _key: key }));
  if (filterDate) {
    items = items.filter(item => item.date === filterDate);
  }
  items.sort((a, b) => b.date.localeCompare(a.date));

  const limit = showAll ? items.length : (visibleCounts[key] || PAGE_SIZE);
  const visibleItems = items.slice(0, limit);

  feed.innerHTML = renderFeedHtml(visibleItems, filterDate);
  setupReadMoreButtons(feed);

  if (!showAll && (items.length > limit || limit > PAGE_SIZE)) {
    const bar = document.createElement('div');
    bar.className = 'load-more-bar';

    if (items.length > limit) {
      const more = document.createElement('button');
      more.className = 'load-more-btn';
      more.type = 'button';
      more.textContent = 'Carregar mais (' + (items.length - limit) + ')';
      more.addEventListener('click', () => {
        visibleCounts[key] = limit + PAGE_SIZE;
        renderColumn(key, filterDate, targetId, showAll);
      });
      bar.appendChild(more);
    }

    if (limit > PAGE_SIZE) {
      const less = document.createElement('button');
      less.className = 'load-more-btn load-less-btn';
      less.type = 'button';
      less.textContent = 'Carregar menos';
      less.addEventListener('click', () => {
        visibleCounts[key] = PAGE_SIZE;
        renderColumn(key, filterDate, targetId, showAll);
      });
      bar.appendChild(less);
    }

    feed.appendChild(bar);
  }
}

function renderOverviewCards(filterDate) {
  const container = document.getElementById('overviewGrid');
  if (!container) return;

  const cards = Object.keys(COMMODITIES).map(key => {
    if (!COMMODITIES[key]) return '';
    const items = (allComments[key] || [])
      .filter(item => !filterDate || item.date === filterDate)
      .sort((a, b) => b.date.localeCompare(a.date));
    const label = COMMODITIES[key].label;
    const officialItem = items.find(item => item.source_url && /^https?:\/\//.test(item.source_url));
    const displayItem = officialItem || items[0];
    const preview = displayItem ? truncateText(stripHtml(displayItem.summary), 120) : 'Nenhuma atualização registrada para esta commodity.';
    const count = items.length;
    const sourceUrl = displayItem && displayItem.source_url && /^https?:\/\//.test(displayItem.source_url) ? displayItem.source_url : '';
    const sourceLabel = sourceUrl ? 'Fonte oficial' : '';
    const sourceLink = sourceUrl ? '<a class="overview-card-source" href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener">' + escapeHtml(sourceLabel) + '</a>' : '';

    return (
      '<div class="overview-card overview-card-' + key + '" data-key="' + escapeHtml(key) + '">' +
      '<div class="overview-card-header">' +
      '<div class="overview-card-title">' + escapeHtml(label) + '</div>' +
      '<div class="overview-card-badge">' + count + ' itens</div>' +
      '</div>' +
      '<p>' + escapeHtml(preview) + '</p>' +
      '<div class="overview-card-meta">' +
      '<span>' + escapeHtml(stripHtml(displayItem ? displayItem.company : 'Sem atualização')) + '</span>' +
      '<span class="overview-card-actions">' +
      '<span class="overview-card-link">Abrir detalhes</span>' + sourceLink +
      '</span>' +
      '</div>' +
      '</div>'
    );
  }).join('');

  container.innerHTML = cards || '<div class="feed-empty">Nenhuma atualização encontrada.</div>';
}

function renderFeed(filterDate) {
  renderOverviewCards(filterDate);
  Object.keys(COMMODITIES).forEach(key => {
    visibleCounts[key] = PAGE_SIZE;
    renderColumn(key, filterDate);
  });
  const overlay = document.getElementById('fullscreenOverlay');
  if (overlay.classList.contains('active')) {
    const key = overlay.dataset.key;
    if (key && COMMODITIES[key]) {
      renderColumn(key, filterDate, 'feed-fullscreen', true);
    }
  }
}

function scheduleDailyRefresh() {
  if (dailyRefreshTimer) {
    clearTimeout(dailyRefreshTimer);
  }

  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(7, 0, 0, 0);

  if (now >= nextRun) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const delay = nextRun.getTime() - now.getTime();
  dailyRefreshTimer = setTimeout(() => {
    if (document.visibilityState === 'visible') {
      window.location.reload();
    } else {
      scheduleDailyRefresh();
    }
  }, delay);
}

async function loadComments() {
  await Promise.all(Object.keys(COMMODITIES).map(async key => {
    try {
      const res = await fetch(COMMODITIES[key].commentsFile, { cache: 'no-store' });
      allComments[key] = await res.json();
    } catch (e) {
      allComments[key] = [];
      const feed = document.getElementById('feed-' + key);
      if (feed) {
        feed.innerHTML = '<div class="feed-empty">Não foi possível carregar os comentários.</div>';
      }
    }
  }));
  renderFeed(null);
}

document.getElementById('dateFilter').addEventListener('change', (e) => {
  currentFilterDate = e.target.value || null;
  renderFeed(currentFilterDate);
});
document.getElementById('clearFilter').addEventListener('click', () => {
  document.getElementById('dateFilter').value = '';
  currentFilterDate = null;
  renderFeed(null);
});

// "Ler mais" / "Ler menos" via delegação de evento (cards são recriados a cada render).
document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('read-more-btn')) return;
  const card = e.target.closest('.card');
  const expanded = card.classList.toggle('expanded');
  e.target.textContent = expanded ? 'Ler menos' : 'Ler mais';
});

// Abrir/fechar coluna em tela cheia (sempre mostra o histórico completo).
document.addEventListener('click', (e) => {
  if (e.target.closest('a')) return; // allow official links to open without triggering the overlay
  const card = e.target.closest('.overview-card');
  if (card) {
    const key = card.dataset.key;
    if (!key || !COMMODITIES[key]) return;
    const overlay = document.getElementById('fullscreenOverlay');
    overlay.dataset.key = key;
    document.getElementById('fullscreenTitle').textContent = COMMODITIES[key].label;
    renderColumn(key, currentFilterDate, 'feed-fullscreen', true);
    overlay.classList.add('active');
    return;
  }

  const btn = e.target.closest('.expand-btn');
  if (!btn) return;
  const key = btn.dataset.key;
  if (!key || !COMMODITIES[key]) return;
  const overlay = document.getElementById('fullscreenOverlay');
  overlay.dataset.key = key;
  document.getElementById('fullscreenTitle').textContent = COMMODITIES[key].label;
  renderColumn(key, currentFilterDate, 'feed-fullscreen', true);
  overlay.classList.add('active');
});
document.getElementById('fullscreenClose').addEventListener('click', () => {
  document.getElementById('fullscreenOverlay').classList.remove('active');
});

loadComments();
scheduleDailyRefresh();
