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

## App instalável e offline

`manifest.webmanifest` + `sw.js` deixam o site instalável no celular e jogável sem internet.
Ao publicar mudanças em `style.css`/`games.js`, aumente o `?v=` no `index.html` **e** a constante `V`
(e a lista `BASE`) no `sw.js`, para que todo mundo receba a versão nova de imediato.
Ao adicionar um jogo, inclua `games/<id>/index.html` na lista `BASE` para ele funcionar offline.

## Recordes

O portal mostra o recorde de cada jogo lendo o que o próprio jogo salva no `localStorage`
(veja `RECORDS` no `index.html`). Para um jogo novo, acrescente uma função lá.

## Ranking online e progresso na nuvem (nick + PIN)

O jogador entra com um **nick** e um **PIN** (4 a 8 números). O portal envia para a nuvem o que os
jogos já salvam no navegador (recordes, moedas, melhorias) e traz de volta em outro aparelho.
O ranking usa a melhor pontuação de cada jogo (definida em `GAMES` no `cloud.js`).

Para ligar (grátis):

1. Crie uma conta em https://supabase.com e um projeto novo.
2. No projeto, abra **SQL Editor**, cole o conteúdo de `banco/supabase.sql` e clique em **Run**.
3. Copie a **Project URL** e a **Publishable key** (Project Settings → API Keys) para `ranking-config.js`.
   Nunca use a **Secret key** (nem a antiga `service_role`) no site.
4. Aumente o `?v=` do `ranking-config.js` no `index.html` e no `sw.js` e publique.

Enquanto `ranking-config.js` estiver vazio, o site esconde o botão de entrar e o ranking.
Observação: como os jogos rodam no navegador, as pontuações são enviadas pelo próprio jogador;
o banco impede que alguém mexa no nick ou no progresso de outra pessoa, mas não detecta trapaça.
