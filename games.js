// Lista de jogos do portal.
// Para adicionar um jogo: crie a pasta games/<id>/ com um index.html
// e acrescente um objeto em GAMES. Campos:
//   id, title, description, tags, controls, color, emoji  → obrigatórios
//   moods     → coleções da vitrine (veja MOODS abaixo)
//   devices   → "Computador e celular" ou "Só computador"
//   players   → "1 jogador", "1 ou 2 jogadores", "Online"...
//   featured  → true para aparecer no destaque da página inicial
//   thumbnail → imagem de capa (opcional, senão usa o emoji)
//   ratio     → proporção da área de jogo no computador (padrão 16/10)
//   added     → data em que entrou no site (AAAA-MM-DD); jogos com até 30 dias ganham o selo NOVO

window.MOODS = [
  { id: "pensar",     label: "Pra pensar",   desc: "Lógica e memória",           emoji: "🧠", color: "#ffe14d" },
  { id: "adrenalina", label: "Adrenalina",   desc: "Reflexo e ação",             emoji: "⚡", color: "#ff3e9a" },
  { id: "amigos",     label: "Com amigos",   desc: "Online ou no mesmo aparelho", emoji: "👥", color: "#2ee6d6" },
  { id: "rapido",     label: "5 minutinhos", desc: "Partidas rápidas",           emoji: "⏱️", color: "#ff7a1a" },
  { id: "relaxar",    label: "Pra relaxar",  desc: "Sem pressa nenhuma",         emoji: "🌙", color: "#9b8cff" }
];

window.GAMES = [
  {
    id: "racha-turbo",
    title: "Racha Turbo",
    description: "Corrida contra rivais numa estrada cheia de trânsito: desvie, ultrapasse, use nitro e mísseis para tirar os adversários da disputa e chegue no pódio para seguir de fase. 5 carros para comprar na garagem.",
    tags: ["Corrida", "Ação"],
    moods: ["adrenalina", "rapido"],
    controls: "Setas / A D viram, ↑ ou Shift nitro, ↓ freio, Espaço míssil. No celular, arraste o dedo e use os botões",
    devices: "Computador e celular",
    players: "1 jogador",
    color: "#ff3e2e",
    emoji: "🏎️",
    featured: true,
    added: "2026-11-24"
  },
  {
    id: "golfe-nuvens",
    title: "Golfe nas Nuvens",
    description: "Minigolfe com quebra-cabeça em ilhas flutuantes, em pixel art: ajude o golfista Pipo a acertar os bichinhos para abrir o buraco, com ricochetes, setas, portais, tacadas por cima e poderes.",
    tags: ["Golfe", "Puzzle"],
    moods: ["pensar", "relaxar", "rapido"],
    controls: "Arraste para trás e solte (estilingue). Teclado: setas miram e dão força, Espaço taca, L troca o tipo de tacada",
    devices: "Computador e celular",
    players: "1 jogador",
    color: "#FF7241",
    emoji: "⛳",
    featured: true,
    added: "2026-11-23"
  },
  {
    id: "mira-afiada",
    title: "Mira Afiada",
    description: "Treino de mira e reflexo para quem joga tiro: Rajada, Flick, Rastreio e teste de Reação. Mira personalizável e sensibilidade com o mouse travado.",
    tags: ["Treino", "Reflexo"],
    moods: ["adrenalina", "rapido"],
    controls: "Mouse (clique para atirar). Esc pausa. No celular, toque nos alvos",
    devices: "Computador e celular",
    players: "1 jogador",
    color: "#45ff2e",
    emoji: "🎯",
    featured: true,
    added: "2026-11-23"
  },
  {
    id: "role-neon",
    title: "Rolê Neon",
    description: "Corra pela avenida grafitada, desvie de vans, barreiras e placas, junte moedas e use na loja para turbinar poderes e trocar o visual do boneco.",
    tags: ["Corrida", "Ação"],
    moods: ["adrenalina", "rapido"],
    controls: "Setas / WASD (Espaço pula), ou deslize o dedo para os lados, para cima e para baixo",
    devices: "Computador e celular",
    players: "1 jogador",
    color: "#8b5cff",
    emoji: "🏃",
    featured: true,
    added: "2026-11-23"
  },
  {
    id: "jogo-da-velha",
    title: "Jogo da Velha",
    description: "Jogue online contra outra pessoa, contra o computador ou com um amigo no mesmo aparelho. Tabuleiros 3x3, 4x4 e 5x5, temas e níveis de XP.",
    tags: ["Online", "Estratégia", "2 jogadores"],
    moods: ["amigos", "rapido", "pensar"],
    controls: "Toque nas casas, ou teclas 1-9 no 3x3 (R reinicia, M volta ao menu)",
    devices: "Computador e celular",
    players: "1 ou 2 jogadores, online ou no mesmo aparelho",
    color: "#ff2e63",
    emoji: "❌",
    thumbnail: "games/jogo-da-velha/icon-512.png",
    ratio: "1/1",
    featured: true,
    added: "2026-11-23"
  },
  {
    id: "coletor-estelar",
    title: "Coletor Estelar",
    description: "Pilote uma nave, colete estrelas e desvie dos asteroides. Quanto tempo você aguenta?",
    tags: ["Ação", "Arcade"],
    moods: ["adrenalina", "rapido"],
    controls: "Setas / WASD ou toque e arraste",
    devices: "Computador e celular",
    players: "1 jogador",
    color: "#7c5cff",
    emoji: "🚀",
    added: "2026-11-23"
  },
  {
    id: "sudoku",
    title: "Sudoku",
    description: "Preencha a grade com números de 1 a 9 sem repetir na linha, na coluna nem no quadrado. Três níveis, anotações e dicas.",
    tags: ["Puzzle", "Lógica"],
    moods: ["pensar", "relaxar"],
    controls: "Toque na casa e no número, ou use o teclado (1-9, setas, N = notas, H = dica)",
    devices: "Computador e celular",
    players: "1 jogador",
    color: "#2ee6d6",
    emoji: "🔢",
    added: "2026-11-23"
  },
  {
    id: "memoria-cores",
    title: "Memória de Cores",
    description: "Repita a sequência de cores que fica cada vez mais longa. Teste sua memória!",
    tags: ["Puzzle", "Memória"],
    moods: ["pensar", "rapido"],
    controls: "Clique / toque ou teclas 1-4",
    devices: "Computador e celular",
    players: "1 jogador",
    color: "#ff8a3d",
    emoji: "🧠",
    added: "2026-11-23"
  }
];
