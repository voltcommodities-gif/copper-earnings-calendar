const sourceTypeLabels = {
  earnings_call: "Earnings Call",
  press_release: "Press Release",
  operational_report: "Relatório Operacional",
  interview: "Entrevista"
};

function formatDate(iso){
  const [y, m, d] = iso.split("-");
  return d + "/" + m + "/" + y;
}

async function loadComments(){
  const feed = document.getElementById('feed');
  try{
    const res = await fetch('data/comments.json', { cache: 'no-store' });
    const items = await res.json();

    if(!items.length){
      feed.innerHTML = '<div class="feed-empty">Nenhum comentário confirmado ainda.</div>';
      return;
    }

    items.sort((a, b) => b.date.localeCompare(a.date));

    feed.innerHTML = items.map(item => {
      const extraLinks = (item.extra_sources || [])
        .map((url, i) => '<a href="' + url + '" target="_blank" rel="noopener">Fonte adicional ' + (i + 1) + '</a>')
        .join('');

      return (
        '<div class="card">' +
          '<div class="card-head">' +
            '<div class="card-company">' + item.company + '</div>' +
            '<div class="card-date">' + formatDate(item.date) + '</div>' +
          '</div>' +
          '<div class="card-summary">' + item.summary + '</div>' +
          '<div class="card-foot">' +
            '<div class="card-type">' + (sourceTypeLabels[item.source_type] || item.source_type) + '</div>' +
            '<div class="card-links"><a href="' + item.source_url + '" target="_blank" rel="noopener">Fonte oficial</a>' + extraLinks + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }catch(e){
    feed.innerHTML = '<div class="feed-empty">Não foi possível carregar os comentários.</div>';
  }
}

loadComments();
