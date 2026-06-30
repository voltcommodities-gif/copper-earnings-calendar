// Calendário único com earnings de todas as commodities (COMMODITIES),
// cada evento colorido de acordo com a commodity de origem.
const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

let current = new Date(2026, 6, 1); // Julho 2026

function eventsForDate(dateKey){
  const result = [];
  Object.keys(COMMODITIES).forEach(key => {
    const events = window[COMMODITIES[key].eventsVar] || {};
    (events[dateKey] || []).forEach(ev => result.push({ ...ev, commodityKey: key }));
  });
  return result;
}

function render(){
  const year = current.getFullYear();
  const month = current.getMonth();
  document.getElementById('monthLabel').textContent = monthNames[month] + " " + year;

  const grid = document.getElementById('grid');
  grid.innerHTML = "";

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for(let i = 0; i < firstDay; i++){
    const cell = document.createElement('div');
    cell.className = 'day empty';
    grid.appendChild(cell);
  }

  for(let d = 1; d <= daysInMonth; d++){
    const cell = document.createElement('div');
    const dateKey = year + "-" + String(month+1).padStart(2,'0') + "-" + String(d).padStart(2,'0');
    const dayEvents = eventsForDate(dateKey);

    cell.className = 'day' + (dayEvents.length ? ' has-event' : '');

    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = d;
    cell.appendChild(num);

    dayEvents.forEach(ev => {
      const tag = document.createElement('div');
      tag.className = 'event event-' + ev.commodityKey;
      tag.innerHTML = '<span class="co">' + ev.co + '</span>' + ev.desc;
      cell.appendChild(tag);
    });

    grid.appendChild(cell);
  }
}

document.getElementById('prev').addEventListener('click', () => {
  current.setMonth(current.getMonth() - 1);
  render();
});
document.getElementById('next').addEventListener('click', () => {
  current.setMonth(current.getMonth() + 1);
  render();
});

render();
