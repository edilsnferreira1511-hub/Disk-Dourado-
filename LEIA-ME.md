# Disk Dourado — pacote atualizado (v6)

## Novidades desta rodada

### 1. Emenda visível no topo — corrigida
A barra de busca "travada" tinha um fundo em degradê que criava uma bordinha reta contra o fundo animado. Removi esse fundo extra — agora só o efeito de vidro (blur) da pílula da busca, sem moldura visível.

### 2. "Último pedido" movido pro canto
Saiu de uma linha inteira embaixo de "O que vai pedir hoje?" e virou um badge discreto no canto superior direito do cartão de saudação, do lado de "Olá, [nome]!".

### 3. Fotos voltaram a preencher o quadro (cover)
Nos cards de produto normal, voltei o `object-fit` de `contain` pra `cover` — a foto preenche o card inteiro, sem sobrar espaço vazio ao redor. Também vale pros novos cards de Destaques (item 5).

### 4. Bug do rastreador de pedido corrigido
- A Comanda (PDV) agora grava a hora exata em que marca "Pronto" ou "Entregue" direto no banco (`prontoEm`/`entregueEm`) — o app do cliente usa essa hora real, não mais "a hora em que o celular do cliente percebeu a mudança"
- Tempo pra sumir da tela: 20 → **10 minutos** depois de concluído
- Trava de segurança nova: se um pedido nunca for marcado como pronto/entregue (esquecimento), ele some sozinho depois de **3 horas** de qualquer jeito — nunca mais fica preso

### 5. Destaques redesenhados — formato banner
Os cards do carrossel de Destaques (Mais vendidos / Promoções / Combos / Frango do domingo) ficaram bem maiores e em formato de banner: foto ocupando o card inteiro, nome + descrição escritos por cima com uma sombra escura pra legibilidade, e preço embaixo.

- **Selo de desconto**: quando o produto (real ou item de promoção) tem um "Desconto (%)" cadastrado, aparece um selo tipo "-15%" no canto e o preço mostra o valor riscado ao lado
  - Produtos reais: campo "Desconto no destaque (%)" no cadastro em Administração
  - Itens de promoção criados na hora: campo "Desconto (%)" no formulário de Configurações → Destaques do Cardápio
- **Título editável por grupo**: em Configurações → Destaques do Cardápio, 4 campos de texto (um por grupo) — deixe em branco pra usar o padrão ("🔥 Mais vendidos" etc.) ou escreva o que quiser, tipo "🔥 Promoção do dia" ou "🍗 Combo especial de domingo"

## Estrutura de dados — novos campos
- `produtos/{codigoBarras}` ganhou `desconto` (número, %)
- `promocoes/{id}` ganhou `desconto` (número, %)
- `pedidosCliente/{id}` ganha `prontoEm` e/ou `entregueEm` (timestamp) quando a Comanda marca o status
- `config/geral` ganhou `destaqueTitulos: { mais_vendidos, promocao, combo, frango_domingo }`

## Observação
O preview que mandei antes de implementar (`preview-destaques-banner.html`) foi só pra aprovação visual — o código real já está no `cliente.html`/`index.html` deste pacote, não precisa mais dele.
