# Disk Dourado — pacote atualizado (v5)

## Novidades desta rodada

### 1. Header
"Bebidas & Frango" → "Bebidas🍻", mais enxuto.

### 2. Taxa de entrega ZERO — agora encolhe pro cabeçalho
Quando ativa, aparece grande por ~4 segundos (como já era) e depois "derrete" — some o aviso grande e aparece um quadradinho fixo no cabeçalho, do lado oposto à logo, com "🛵 Entrega grátis hoje".

### 3. Busca travada (sticky) no topo
A barra de busca agora fica sempre visível logo abaixo do cabeçalho, mesmo rolando a tela pra baixo.

### 4. Saudação mais compacta
"Olá, [nome]!" continua no topo, mas "Último pedido" virou uma barrinha compacta com uma setinha (▾) — só expande (mostra os itens + botão "Pedir novamente") quando o cliente toca nela.

### 5. Busca pula de categoria automaticamente
Se você buscar "coca" estando na categoria "Frango assado", o app pula sozinho pra categoria onde a Coca-Cola está e mostra o resultado — sem precisar trocar de categoria manualmente.

### 6. Banner fixo → Destaques configuráveis
Removi o banner único e fixo "Frango Assado de Domingo". No lugar, os **Destaques** (🔥 Mais vendidos / ❤️ Promoções / 🥤 Combos / 🍗 Frango do domingo) — que já existiam como carrossel — agora servem também pra isso, e ganharam uma peça importante:

**Itens de promoção "criados na hora"** — em **Configurações → Destaques do Cardápio**, além de marcar produtos reais do Caixa como destaque (já dava pra fazer, editando o produto em Administração), agora dá pra **criar um item que não existe como produto separado**, tipo "Frango + Coca por R$50":
- Nome, preço, **estoque próprio**, descrição, foto (opcional) e o grupo (Mais vendidos / Promoção / Combo / Frango do domingo)
- Botão de olho pra **ativar/desativar** sem precisar apagar — ex: hoje mostra "Combo de sábado", amanhã desliga e liga outro
- O estoque desse item de promoção é **separado** do estoque dos produtos reais — quando o cliente compra, desconta só dali, sem mexer no estoque do Caixa
- No app do cliente, tocar num card de destaque (produto real ou item de promoção) abre a mesma telinha de detalhe (foto grande, descrição, observação, quantidade)

## Estrutura de dados — novo node
- `promocoes/{id}`: `nome, preco, estoque, descricao, foto, grupo, ativo`
- Incluído no Exportar/Importar Backup também.

## Pendências / observações
- O botão do banner antigo linkava pra busca "frango" — isso não existe mais como conceito fixo; agora é tudo via Destaques configuráveis, mais flexível.
- Testem o fluxo: criar um item de promoção em Configurações → conferir se aparece no carrossel do cliente → fazer um pedido de teste → conferir se o estoque daquele item específico desconta certinho (e não mexe no estoque de nenhum produto real).
