// Configuração central das commodities do site.
// Adicionar uma nova commodity = um novo item aqui + um par de arquivos
// data/events-<key>.js e data/comments-<key>.json no mesmo formato.
const COMMODITIES = {
  cobre: {
    label: "Cobre",
    color: "#0a1f44",
    eventsVar: "cobreEvents",
    commentsFile: "data/comments-cobre.json"
  },
  petroleo: {
    label: "Petróleo",
    color: "#3d1f5c",
    eventsVar: "petroleoEvents",
    commentsFile: "data/comments-petroleo.json"
  }
};
