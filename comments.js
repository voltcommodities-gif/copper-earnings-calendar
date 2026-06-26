const sourceTypeLabels = {
  earnings_call: "Earnings Call",
  press_release: "Press Release",
  operational_report: "Relatório Operacional",
  interview: "Entrevista"
};

const weekdayNames = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const monthNamesFull = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

let allComments = [];

function formatDateLabel(iso){
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return weekdayNames[dt.getDay()] + ", " + d + " de " + monthNamesFull[m - 1] + " de " + y;
}

function renderCard(item){
  const extraLinks = (item.extra_sources || [])
    .map((url, i) => '<a href="' + url + '" target="_blank" rel="noopener">Fonte adicional ' + (i + 1) + '</a>')
    .join('');

  return (
    '<div class="card">' +
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

function renderFeed(filterDate){
  const feed = document.getElementById('feed');

  let items = allComments;
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
        '<div class="day-group-header">' + formatDateLabel(date) + '</div>' +
        dayItems.map(renderCard).join('') +
      '</div>'
    );
  }).join('');
}

async function loadComments(){
  const feed = document.getElementById('feed');
  try{
    const res = await fetch('data/comments.json', { cache: 'no-store' });
    allComments = await res.json();
    renderFeed(null);
  }catch(e){
    feed.innerHTML = '<div class="feed-empty">Não foi possível carregar os comentários.</div>';
  }
}

document.getElementById('dateFilter').addEventListener('change', (e) => {
  renderFeed(e.target.value || null);
});
document.getElementById('clearFilter').addEventListener('click', () => {
  document.getElementById('dateFilter').value = '';
  renderFeed(null);
});

loadComments();
