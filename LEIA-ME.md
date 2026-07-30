# Disk Dourado — pacote atualizado

## O que tem aqui
- **index.html** — PDV novo (Caixa + Administração + **Comanda** + **Configurações**, as duas últimas abas são novas). Usa **Realtime Database**, projeto `mercado-disk`.
- **cliente.html** — app do cliente (cardápio, carrinho, checkout, rastreamento do pedido). Migrado do Firestore para o **mesmo Realtime Database** (`mercado-disk`), mantendo o visual dourado/glass que você já usa.
- **app.js** + **style.css** — o sistema antigo (Firestore, projeto `disk-frango-f902c`). Deixei aqui pra referência/backup, mas ele **não é mais o sistema principal** — o `index.html` assume esse papel daqui pra frente.
- **manifest.json**, **service-worker.js**, ícones — arquivos do PWA, sem alteração.

## ⚠️ Antes de colocar no ar: configure as Regras do Realtime Database
O `cliente.html` agora escreve pedidos direto no banco (sem login). No console do Firebase do projeto **mercado-disk** → Realtime Database → Regras, garanta algo assim como ponto de partida (depois dá pra refinar):

```json
{
  "rules": {
    "produtos": { ".read": true, ".write": true },
    "produtosAvulsos": { ".read": true, ".write": true },
    "vendas": { ".read": true, ".write": true },
    "pedidosCliente": { ".read": true, ".write": true },
    "config": { ".read": true, ".write": true }
  }
}
```
Sem isso, tanto o `cliente.html` quanto as abas novas do `index.html` vão dar erro de permissão.

## Estrutura de dados nova (Realtime Database)
- `produtos/{codigoBarras}` — já existia, é o estoque com código de barras do Caixa (não mexi).
- `vendas/{id}` — já existia, vendas feitas no Caixa (não mexi).
- `produtosAvulsos/{id}` — **novo**: itens do cardápio mostrado no app do cliente (nome, preço, categoria, descrição, foto). Gerenciado pela aba Configurações → "Cardápio do App do Cliente".
- `pedidosCliente/{id}` — **novo**: pedidos feitos pelo cliente. A aba **Comanda** lê daqui e marca "pronto"/status de entrega direto nesse registro (não depende mais de cruzar com `vendas`).
- `config/geral` — **novo**: chave Pix, telefone da loja, categorias, localização da loja, faixas de entrega por km, taxa mínima, taxa zero.

## O que eu NÃO portei (fique de olho)
- O sistema de **receita/composição de estoque** (baixa automática de ingredientes por item vendido) que existia no Firestore antigo **não tem equivalente** no PDV novo — o `produtos` do RTDB é baixa simples (1 produto = 1 estoque). Se isso for importante pra vocês, me avisa que a gente desenha isso.
- Módulos do `app.js` que ainda só existem no sistema antigo (Financeiro detalhado, Estoque com fichas técnicas, Usuários/PIN) **não foram portados** pro `index.html` — só Comanda e Configurações, como você pediu.
- Não tenho como testar contra o Firebase de vocês de verdade — testei sintaxe e a lógica com cuidado, mas façam um teste ponta a ponta (fazer um pedido no `cliente.html` e ver ele aparecer na Comanda) antes de usar em produção.
