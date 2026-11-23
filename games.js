// Lista de jogos do portal.
// Para adicionar um jogo: crie a pasta games/<id>/ com um index.html
// e acrescente um objeto aqui.
window.GAMES = [
  {
    id: "coletor-estelar",
    title: "Coletor Estelar",
    description: "Pilote uma nave, colete estrelas e desvie dos asteroides. Quanto tempo você aguenta?",
    tags: ["Ação", "Arcade"],
    controls: "Setas / WASD ou toque e arraste",
    color: "#7c5cff",
    emoji: "🚀",
    added: "2026-11-23"
  },
  {
    id: "memoria-cores",
    title: "Memória de Cores",
    description: "Repita a sequência de cores que fica cada vez mais longa. Teste sua memória!",
    tags: ["Puzzle", "Memória"],
    controls: "Clique / toque ou teclas 1-4",
    color: "#ff8a3d",
    emoji: "🧠",
    added: "2026-11-23"
  },
  {
    id: "sudoku",
    title: "Sudoku",
    description: "Preencha a grade com números de 1 a 9 sem repetir na linha, na coluna nem no quadrado. Três níveis, anotações e dicas.",
    tags: ["Puzzle", "Lógica"],
    controls: "Toque na casa e no número, ou use o teclado (1-9, setas, N = notas, H = dica)",
    color: "#2ee6d6",
    emoji: "🔢",
    added: "2026-11-23"
  }
];
