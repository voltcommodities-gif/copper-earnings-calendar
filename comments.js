const sourceTypeLabels = {
  earnings_call: "Earnings Call",
  press_release: "Press Release",
  operational_report: "Relatório Operacional",
  interview: "Entrevista"
};

const weekdayNames = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const monthNamesFull = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

const allComments = {}; // key (ex: "cobre") -> array de itens

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
      '<div class="card-foot">' +
        '<div class="card-type">' + (sourceTypeLabels[item.source_type] || item.source_type) + '</div>' +
        '<div class="card-links"><a href="' + item.source_url + '" target="_blank" rel="noopener">Fonte oficial</a>' + extraLinks + '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderColumn(key, filterDate){
  const feed = document.getElementById('feed-' + key);

  let items = allComments[key] || [];
  if(filterDate){
    items = items.filter(item => item.date === filterDate);
  }

  if(!items.length){
    feed.innerHTML = '<div class="feed-empty">' +
      (filterDate ? 'Nenhum comentário nessa data.' : 'Nenhum comentário confirmado ainda.') +
    '</div>';
    return;
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  const dates = [...new Set(items.map(item => item.date))];

  feed.innerHTML = dates.map(date => {
    const dayItems = items.filter(item => item.date === date);
    return (
      '<div class="day-group">' +
        '<div class="day-group-header day-group-header-' + key + '">' + formatDateLabel(date) + '</div>' +
        dayItems.map(item => renderCard(item, key)).join('') +
      '</div>'
    );
  }).join('');
}

function renderFeed(filterDate){
  Object.keys(COMMODITIES).forEach(key => renderColumn(key, filterDate));
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
  renderFeed(e.target.value || null);
});
document.getElementById('clearFilter').addEventListener('click', () => {
  document.getElementById('dateFilter').value = '';
  renderFeed(null);
});

loadComments();
