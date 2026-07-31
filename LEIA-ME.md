# Disk Dourado — pacote atualizado (v2)

## O que tem aqui
- **index.html** — PDV (Caixa + Administração + Comanda + Configurações), agora com **login por PIN** e **papéis de usuário**. Usa Realtime Database, projeto `mercado-disk`.
- **cliente.html** — app do cliente. Agora mostra **o mesmo catálogo de produtos do Caixa** (não existe mais um cardápio separado) e respeita o **estoque real**.
- **app.js** + **style.css** — sistema antigo (Firestore), mantido só como referência/backup.
- **manifest.json**, **service-worker.js**, ícones — sem alteração.

## Novidades desta rodada

### 1. Login por PIN + papéis
Ao abrir o `index.html` agora aparece uma tela de PIN. Cada usuário tem um PIN de 4 a 6 dígitos e uma função:
- **Admin** → vê tudo (Caixa, Administração, Comanda, Configurações)
- **Garçom** → vê só a Comanda (marca pedidos como prontos)
- **Entregador** → vê só a Comanda, filtrada pros pedidos de **entrega**, e só atualiza o status de entrega (não vê o botão "Pronto", que é da cozinha)

**Bootstrap:** como não existe usuário nenhum ainda, na primeira vez que abrir vai liberar automaticamente como admin, com um aviso pra você ir em **Configurações → Usuários** e cadastrar o primeiro usuário de verdade. Depois disso, todo mundo precisa do PIN.

⚠️ **O PIN não é uma senha "de banco"** — ele fica salvo no Realtime Database em texto puro, do mesmo jeito que o resto dos dados. Isso é seguro o suficiente pra controlar quem vê o quê dentro da loja, mas não use um PIN que vocês usam em algum outro lugar sensível (banco, e-mail etc.).

### 2. Link do cliente + QR code
Em **Configurações → Cardápio Digital**, cole o link do `cliente.html` publicado (ex: `https://seunome.github.io/Disk-Dourado/cliente.html`) e clique em Salvar. Aparece o link com botão de copiar e um QR code pra imprimir/compartilhar.

### 3. Catálogo único (Caixa = App do Cliente)
Removi o cadastro separado "Cardápio do App do Cliente". Agora é tudo o mesmo produto:
- Em **Administração → Cadastrar Produto**, cada produto ganhou dois campos novos: **Categoria** (a mesma categoria usada no app do cliente) e um checkbox **"Mostrar este produto no app do cliente"**.
- Só produtos com esse checkbox marcado aparecem pro cliente — assim vocês podem ter itens internos (ex: "gelo cx fechada") que não aparecem no cardápio, sem precisar cadastrar duas vezes.
- **O estoque também é o mesmo.** Quando o cliente faz um pedido pelo app, o sistema já desconta do mesmo `stock` que aparece no Caixa — e o botão "Adicionar" fica desabilitado/"Esgotado" quando não tem mais estoque.

**Ação necessária:** como os produtos que já existiam no Caixa não tinham esses dois campos, **nenhum vai aparecer no app do cliente até você editar cada um e marcar "Mostrar no app do cliente" + escolher a categoria**. Recomendo abrir Administração e passar por cada produto rapidamente.

## ⚠️ Regras do Realtime Database (sem mudança, só reforçando)
```json
{
  "rules": {
    "produtos": { ".read": true, ".write": true },
    "vendas": { ".read": true, ".write": true },
    "pedidosCliente": { ".read": true, ".write": true },
    "config": { ".read": true, ".write": true },
    "usuarios": { ".read": true, ".write": true }
  }
}
```

## Estrutura de dados (Realtime Database) — atualizada
- `produtos/{codigoBarras}` — catálogo único: `name, code, price, costPrice, stock, unit, image, categoria, mostrarNoApp`.
- `vendas/{id}` — vendas do Caixa (sem alteração).
- `pedidosCliente/{id}` — pedidos feitos pelo cliente. A Comanda lê e atualiza `prontoCozinha`/`statusEntrega` direto aqui.
- `config/geral` — chave Pix, telefone, categorias, localização da loja, faixas de entrega, taxa mínima/zero, **linkCliente** (novo).
- `usuarios/{id}` — **novo**: `nome, pin, papel` (`admin` | `garcom` | `entregador`).

## O que eu ainda NÃO fiz (pra vocês decidirem se querem)
- Não criei uma tela de "histórico" separada por usuário (quem vendeu o quê) — o Histórico de Vendas na Administração continua geral, sem filtrar por operador. Se quiserem isso, dá pra adicionar.
- Continua sem o sistema de receita/composição de estoque (baixa de múltiplos ingredientes por item) — aqui é sempre 1 produto = 1 estoque.
- Não testei contra o Firebase de vocês de verdade — testem o fluxo completo (logar com PIN, marcar produto pra aparecer no app, fazer um pedido de teste, ver ele cair na Comanda e o estoque descontar) antes de usar em produção.
