// Renderiza um mini-calendário por commodity (cobreEvents, petroleoEvents),
// um ao lado do outro, compartilhando a mesma navegação de mês.
const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

let current = new Date(2026, 6, 1); // Julho 2026

function renderColumn(key){
  const events = window[COMMODITIES[key].eventsVar];
  const year = current.getFullYear();
  const month = current.getMonth();

  const grid = document.getElementById('grid-' + key);
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
    const dayEvents = events[dateKey];

    cell.className = 'day' + (dayEvents ? ' has-event' : '');

    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = d;
    cell.appendChild(num);

    if(dayEvents){
      dayEvents.forEach(ev => {
        const tag = document.createElement('div');
        tag.className = 'event event-' + key;
        tag.innerHTML = '<span class="co">' + ev.co + '</span>' + ev.desc;
        cell.appendChild(tag);
      });
    }

    grid.appendChild(cell);
  }
}

function render(){
  document.getElementById('monthLabel').textContent = monthNames[current.getMonth()] + " " + current.getFullYear();
  Object.keys(COMMODITIES).forEach(renderColumn);
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
