# Disk Dourado — pacote atualizado (v3)

## Novidades desta rodada

### 1. Layout responsivo (celular e computador)
O problema era o cabeçalho: como ele tinha muitos botões numa linha só que não quebrava, no celular isso fazia a página inteira "encolher pra um cantinho" (bug clássico de navegador mobile quando algum elemento é mais largo que a tela). Corrigido:
- Cabeçalho agora quebra em linhas e esconde texto/itens secundários no celular (só ícones)
- Telas de Caixa, Administração, Comanda e Configurações empilham em coluna única no celular e voltam a ficar lado a lado no computador
- Tabela do Caixa ganhou rolagem horizontal própria em vez de espremer/estourar a tela
- Adicionei uma trava de segurança (`overflow-x:hidden`) pra isso não voltar a acontecer se algum elemento novo ficar largo demais

### 2. Atribuir produtos por categoria (em massa)
Nova seção em **Configurações → Atribuir Produtos por Categoria**: escolhe a categoria (ex: Cerveja), aparece a lista de todos os produtos do Caixa com checkbox, marca os que são daquela categoria, salva de uma vez. Marcar aqui já liga automaticamente **"Mostrar no app do cliente"** desses produtos.

### 3. Preview do cardápio com arrastar-e-soltar
Nova seção **Configurações → Preview do Cardápio do Cliente**: mostra as categorias e os produtos de cada uma, do jeito que vai aparecer pro cliente. Arraste os cartões de categoria pra mudar a ordem entre elas, e arraste os produtos dentro de cada categoria pra reordenar. Salva sozinho a cada solto (sem precisar de botão salvar). O `cliente.html` já respeita essa ordem.

### 4. Importar fotos de um backup antigo
Nova seção **Configurações → Importar Fotos de um Backup Antigo**: sobe o `.json` exportado do sistema antigo (Firestore), o painel casa os nomes com os produtos que já existem no Caixa novo e mostra uma lista com "foto antiga → produto atual" pra você conferir e desmarcar o que não quiser. Só depois de clicar em **"Aplicar selecionadas"** as fotos são realmente trocadas — nada muda sozinho. Código de barras, preço e estoque continuam sendo os que já estão no sistema novo, só a foto vem do backup.

⚠️ O casamento é feito comparando o **nome exato** (ignorando maiúsculas/acentos/espaços extras) do produto no backup antigo com o nome no Caixa novo. Produtos com nomes bem diferentes entre os dois sistemas não vão casar automaticamente — nesse caso, edite a foto direto no cadastro do produto em Administração.

### 5. Correção no Importar Backup (segurança)
Um objeto vazio `{}` conta como "verdadeiro" em JavaScript — isso fazia o botão "Importar Backup" (o normal, não o de fotos) apagar dados reais se o arquivo tivesse alguma seção vazia. Corrigido: agora só sobrescreve o que o backup realmente tiver, e ele detecta e bloqueia se você tentar importar por engano um backup do formato antigo ali.

### 6. Comanda com Maps, WhatsApp e troco
Cada pedido de entrega na Comanda agora mostra botão de abrir rota no Google Maps, botão de abrir WhatsApp já com mensagem pronta pro cliente, endereço + distância, e aviso de troco quando o pagamento é em dinheiro — igual tinha no painel antigo.

## Pendências / decisões que ficaram combinadas
- **Localização do cliente**: você confirmou que está do jeito que precisa (só o link do Maps, sem mapa incorporado) — nenhuma mudança aqui.
- Continua sem o sistema de receita/composição de estoque (baixa de múltiplos ingredientes por item vendido).

## Como usar as novidades (ordem sugerida)
1. Vá em Administração e confira/edite as fotos dos produtos que quiser (ou use a importação de fotos do backup antigo)
2. Vá em Configurações → Atribuir Produtos por Categoria e organize seus produtos por categoria (Cerveja, Refri, etc.) — isso já marca "mostrar no app do cliente"
3. Vá em Configurações → Preview do Cardápio do Cliente e arraste pra deixar na ordem que você quer
4. Teste no celular e no computador pra confirmar que o layout está bom

## Estrutura de dados (Realtime Database) — sem mudança de schema nessa rodada
- `produtos/{codigoBarras}`: `name, code, price, costPrice, stock, unit, image, categoria, mostrarNoApp, ordem` (novo campo: `ordem`)
- Resto igual ao pacote anterior.
