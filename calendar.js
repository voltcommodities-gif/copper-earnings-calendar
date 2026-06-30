// Eventos confirmados (aba "Confirmados")
const events = {
  "2026-07-21": [
    { co: "Boliden (BOL)", desc: "Relatório de Resultados do 2º trimestre 2026" }
  ],
  "2026-07-23": [
    { co: "Anglo American (AAL)", desc: "Relatório de Produção Q2 2026" },
    { co: "Teck Resources (TECK)", desc: "Teleconferência de resultados Q2 2026" }
  ],
  "2026-07-29": [
    { co: "Rio Tinto (RIO)", desc: "Resultado do 1º semestre de 2026" },
    { co: "Glencore (GLEN)", desc: "Relatório de Produção do 1º semestre 2026" }
  ],
  "2026-07-30": [
    { co: "Anglo American (AAL)", desc: "Resultado do 1º semestre de 2026" },
    { co: "Ivanhoe Mines (IVN)", desc: "Teleconferência de resultados Q2 2026" }
  ],
  "2026-08-05": [
    { co: "Glencore (GLEN)", desc: "Resultado do 1º semestre de 2026" }
  ],
  "2026-08-06": [
    { co: "Aurubis (NDA)", desc: "Relatório dos primeiros 9 meses do exercício fiscal 2025/26" }
  ],
  "2026-08-13": [
    { co: "Antofagasta plc (ANTO)", desc: "Resultado do 1º semestre de 2026" }
  ],
  "2026-08-18": [
    { co: "BHP Group (BHP)", desc: "Resultado do ano fiscal 2026 (encerrado 30/jun/26)" }
  ],
  "2026-08-19": [
    { co: "KGHM Polska Miedź (KGH)", desc: "Relatório consolidado do 1º semestre 2026" }
  ],
  "2026-10-20": [
    { co: "Anglo American (AAL)", desc: "Relatório de Produção Q3 2026" },
    { co: "BHP Group (BHP)", desc: "Relatório Operacional Q1 (ano fiscal 2027)" }
  ],
  "2026-10-29": [
    { co: "Glencore (GLEN)", desc: "Relatório de Produção Q3 2026" }
  ]
};

const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

let current = new Date(2026, 6, 1); // Julho 2026

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
    const key = year + "-" + String(month+1).padStart(2,'0') + "-" + String(d).padStart(2,'0');
    const dayEvents = events[key];

    cell.className = 'day' + (dayEvents ? ' has-event' : '');

    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = d;
    cell.appendChild(num);

    if(dayEvents){
      dayEvents.forEach(ev => {
        const tag = document.createElement('div');
        tag.className = 'event';
        tag.innerHTML = '<span class="co">' + ev.co + '</span>' + ev.desc;
        cell.appendChild(tag);
      });
    }

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
