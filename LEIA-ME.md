# Disk Dourado — pacote atualizado (v4)

## Novidades desta rodada (visual/UX do app do cliente)

1. **Card do produto**: imagem de 150px → 210px, e trocada pra `object-fit:contain` (a foto inteira aparece, sem cortar) — isso ajuda a disfarçar um pouco fotos com enquadramentos diferentes entre si, mas fotos padronizadas na origem (fundo neutro, mesmo enquadramento) continuam sendo o que mais eleva a percepção de qualidade.
2. **Barra do carrinho**: mais fina, com efeito de vidro (glass/blur) e texto resumido "🛒 2 itens • R$ 35,00". Também "pulsa" quando um item é adicionado.
3. **Animações de toque**: foto do produto dá um leve zoom ao tocar no card; botão de adicionar tem CSS pronto pra efeito de "bump" (dá pra ativar se quiser mais tarde).
4. **Página de detalhe do produto**: tocar no card (fora do botão "Adicionar") abre uma tela com foto grande, descrição, campo de observação e quantidade. O botão "Adicionar" no card continua sendo o atalho rápido, sem abrir a tela.
   ⚠️ Não incluí um campo de "ingredientes" separado porque isso não existe nos dados dos produtos hoje — dá pra usar o campo "Descrição" pra isso, ou eu adiciono um campo novo se vocês quiserem.
5. **Carrinho**: cada item agora mostra a miniatura da foto do produto, e a observação (quando o cliente escreve uma) aparece junto do item.
6. **Banner inicial**: "🍗 Frango Assado de Domingo" com botão "Pedir agora" (sem menção a entrega grátis, como combinado). O botão filtra o cardápio por "frango" — se quiser, dá pra linkar direto pra uma categoria específica.
7. **Destaques**: seção com rolagem horizontal antes das categorias (🔥 Mais vendidos / ❤️ Promoções / 🥤 Combos / 🍗 Frango do domingo). Você controla manualmente quais produtos aparecem em cada uma — vá em **Administração**, edite o produto e escolha o "Destaque" no formulário. Só aparece a seção/grupo que tiver pelo menos 1 produto marcado.
8. **"Olá, [nome]!" + Pedir novamente**: depois que o cliente conclui o primeiro pedido, o nome e telefone ficam salvos no navegador dele (sem senha, sem login — só naquele aparelho/navegador). Na próxima visita, o app busca o último pedido feito com aquele telefone e mostra a saudação com os itens + botão "🔁 Pedir novamente".
   ⚠️ Pra essa busca ficar rápida no banco, recomendo (não é obrigatório) adicionar no Firebase Console → Realtime Database → Regras, um índice no campo telefone:
   ```json
   "pedidosCliente": {
     ".read": true, ".write": true,
     ".indexOn": ["telefone"]
   }
   ```
   Sem isso ainda funciona, só é um pouco mais lento conforme o número de pedidos crescer.

## Sem avaliações/estrelas
Removi completamente a ideia de nota (⭐ 4,9) e contagem de avaliações — não tem sistema de avaliação real ainda, então não colocamos nada decorativo/falso no lugar, como combinado.

## Bug corrigido de brinde: campo "ordem" não se perdia mais
Reparei que o formulário de cadastro/edição de produto (Administração) sobrescrevia o produto inteiro toda vez que salvava — isso ia apagar silenciosamente a ordem de exibição definida no preview arrastável (Configurações) sempre que alguém editasse um produto depois de reordenar. Corrigido: agora o formulário preserva os campos que não são dele (como "ordem") ao salvar.

## Estrutura de dados — novo campo
- `produtos/{codigoBarras}` ganhou o campo `destaque`: `''` | `'mais_vendidos'` | `'promocao'` | `'combo'` | `'frango_domingo'`
