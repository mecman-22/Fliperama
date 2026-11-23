# Fliperama — portal de jogos autorais

Site estático (HTML/CSS/JS puro, sem build) para hospedar jogos que rodam direto no navegador.

```
index.html          → vitrine + página do jogo (index.html#id-do-jogo)
games.js            → lista de jogos (o "catálogo")
style.css           → visual do portal
games/<id>/index.html → cada jogo fica na sua própria pasta
```

## Adicionar um jogo

1. Crie a pasta `games/meu-jogo/` com um `index.html` (pode ter JS, imagens, sons etc. junto).
   Funciona com jogos exportados de Godot (Web), Phaser, Construct, GDevelop, PICO-8, Unity WebGL…
2. Adicione uma entrada em `games.js`:

```js
{
  id: "meu-jogo",                 // igual ao nome da pasta
  title: "Meu Jogo",
  description: "Uma frase sobre o jogo.",
  tags: ["Plataforma"],
  controls: "Setas + Espaço",
  color: "#22c55e",               // cor do card
  emoji: "🐸",                    // ou use thumbnail:
  // thumbnail: "games/meu-jogo/capa.png",
  // ratio: "1/1",                // opcional: proporção da área de jogo no computador (padrão 16/10)
  // url: "https://..."           // opcional: jogo hospedado em outro lugar
}
```

## Testar localmente

Abrir o `index.html` direto funciona para jogos simples. Jogos exportados de engines
(Godot, Unity) precisam de um servidor:

```
node serve.js
```

e acesse http://localhost:8765.

## Publicar (grátis)

- **GitHub Pages:** suba a pasta para um repositório → Settings → Pages → branch `main`.
- **Netlify / Cloudflare Pages:** arraste a pasta no painel ou conecte o repositório.
- **itch.io** não é necessário — mas você pode usar `url` em `games.js` para apontar para jogos hospedados lá.

> Godot 4 com threads exige os cabeçalhos COOP/COEP; no Netlify, crie um arquivo `_headers`.
> Ou exporte com "Thread Support" desativado.
