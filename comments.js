const sourceTypeLabels = {
  earnings_call: "Earnings Call",
  press_release: "Press Release",
  operational_report: "Relatório Operacional",
  interview: "Entrevista"
};

const weekdayNames = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const monthNamesFull = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

const allComments = {}; // key (ex: "cobre") -> array de itens
let currentFilterDate = null;

function formatDateLabel(iso){
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return weekdayNames[dt.getDay()] + ", " + d + " de " + monthNamesFull[m - 1] + " de " + y;
}

function renderCard(item, key){
  const extraLinks = (item.extra_sources || [])
    .map((url, i) => '<a href="' + url + '" target="_blank" rel="noopener">Fonte adicional ' + (i + 1) + '</a>')
    .join('');

  return (
    '<div class="card card-' + key + '">' +
      '<div class="card-head">' +
        '<div class="card-company">' + item.company + '</div>' +
      '</div>' +
      '<div class="card-summary">' + item.summary + '</div>' +
      '<button class="read-more-btn" type="button">Ler mais</button>' +
      '<div class="card-foot">' +
        '<div class="card-type">' + (sourceTypeLabels[item.source_type] || item.source_type) + '</div>' +
        '<div class="card-links"><a href="' + item.source_url + '" target="_blank" rel="noopener">Fonte oficial</a>' + extraLinks + '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderFeedHtml(items, filterDate){
  if(!items.length){
    return '<div class="feed-empty">' +
      (filterDate ? 'Nenhum comentário nessa data.' : 'Nenhum comentário confirmado ainda.') +
    '</div>';
  }

  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const dates = [...new Set(sorted.map(item => item.date))];

  return dates.map(date => {
    const dayItems = sorted.filter(item => item.date === date);
    return (
      '<div class="day-group">' +
        '<div class="day-group-header day-group-header-' + dayItems[0]._key + '">' + formatDateLabel(date) + '</div>' +
        dayItems.map(item => renderCard(item, item._key)).join('') +
      '</div>'
    );
  }).join('');
}

// Esconde o botão "Ler mais" em cards cujo resumo já cabe sem truncar.
function setupReadMoreButtons(container){
  container.querySelectorAll('.card-summary').forEach(summary => {
    const btn = summary.nextElementSibling;
    if(!btn || !btn.classList.contains('read-more-btn')) return;
    if(summary.scrollHeight <= summary.clientHeight + 1){
      btn.style.display = 'none';
    }
  });
}

function renderColumn(key, filterDate, targetId){
  const feed = document.getElementById(targetId || ('feed-' + key));
  let items = (allComments[key] || []).map(item => ({ ...item, _key: key }));
  if(filterDate){
    items = items.filter(item => item.date === filterDate);
  }
  feed.innerHTML = renderFeedHtml(items, filterDate);
  setupReadMoreButtons(feed);
}

function renderFeed(filterDate){
  Object.keys(COMMODITIES).forEach(key => renderColumn(key, filterDate));
  if(document.getElementById('fullscreenOverlay').classList.contains('active')){
    const key = document.getElementById('fullscreenOverlay').dataset.key;
    renderColumn(key, filterDate, 'feed-fullscreen');
  }
}

async function loadComments(){
  await Promise.all(Object.keys(COMMODITIES).map(async key => {
    try{
      const res = await fetch(COMMODITIES[key].commentsFile, { cache: 'no-store' });
      allComments[key] = await res.json();
    }catch(e){
      allComments[key] = [];
      const feed = document.getElementById('feed-' + key);
      feed.innerHTML = '<div class="feed-empty">Não foi possível carregar os comentários.</div>';
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
  if(!e.target.classList.contains('read-more-btn')) return;
  const card = e.target.closest('.card');
  const expanded = card.classList.toggle('expanded');
  e.target.textContent = expanded ? 'Ler menos' : 'Ler mais';
});

// Abrir/fechar coluna em tela cheia.
document.querySelectorAll('.expand-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    const overlay = document.getElementById('fullscreenOverlay');
    overlay.dataset.key = key;
    document.getElementById('fullscreenTitle').textContent = COMMODITIES[key].label;
    renderColumn(key, currentFilterDate, 'feed-fullscreen');
    overlay.classList.add('active');
  });
});
document.getElementById('fullscreenClose').addEventListener('click', () => {
  document.getElementById('fullscreenOverlay').classList.remove('active');
});

loadComments();
