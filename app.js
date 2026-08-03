/* ==========================================================================
   DISK DOURADO — Sistema de Gestão v2 (Firebase + PIN + módulos completos)
   ========================================================================== */

/* ==================== FIREBASE ==================== */
const firebaseConfig = {
  apiKey: "AIzaSyCeU5gZB7CXd6aDVTsnGzlg6BtqIuaJRfc",
  authDomain: "disk-frango-f902c.firebaseapp.com",
  projectId: "disk-frango-f902c",
  storageBucket: "disk-frango-f902c.firebasestorage.app",
  messagingSenderId: "1004269285224",
  appId: "1:1004269285224:web:b1fd2754215248740430dd",
  measurementId: "G-CCKPVXCY35"
};
firebase.initializeApp(firebaseConfig);
const fdb = firebase.firestore();
fdb.enablePersistence({ synchronizeTabs: true }).catch(() => { /* multi-tab or unsupported, ignore */ });

/* ==================== UTILITÁRIOS ==================== */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}
function undoToast(msg, onUndo) {
  const el = document.getElementById('undoToast');
  const text = document.getElementById('undoText');
  const btn = document.getElementById('undoBtn');
  text.textContent = msg;
  el.classList.add('show');
  const cleanup = () => { el.classList.remove('show'); btn.onclick = null; };
  btn.onclick = () => { onUndo(); cleanup(); };
  clearTimeout(undoToast._t);
  undoToast._t = setTimeout(cleanup, 5200);
}
function brl(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// Valor que pertence à loja (exclui a taxa de entrega, que é do motoboy)
function valorLoja(v) {
  return (v.total || 0) - (v.taxaEntrega || 0);
}
function montarLinkWhatsApp(telefone) {
  let digits = (telefone || '').replace(/\D/g, '');
  if (digits.length <= 11) digits = '55' + digits; // adiciona o código do Brasil se ainda não tiver
  const msg = encodeURIComponent('Sou entregador do Disk Dourado, estou indo no seu endereço 🛵');
  return `https://wa.me/${digits}?text=${msg}`;
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ==================== MÓDULO: AUTENTICAÇÃO POR PIN ==================== */
const Auth = (() => {
  let currentUser = null; // { nome, pin, role }
  let pinBuffer = '';
  const DEFAULT_OWNER = { nome: 'Dono', pin: '912579', role: 'dono', id: 'default-owner' };

  function getUsers() { return [DEFAULT_OWNER, ...Users.cache]; }

  function updateDots() {
    const dots = document.querySelectorAll('#pinDots span');
    dots.forEach((d, i) => d.classList.toggle('filled', i < pinBuffer.length));
  }

  function showError(msg) {
    const el = document.getElementById('pinError');
    el.textContent = msg;
    setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 1800);
  }

  function tryLogin() {
    if (pinBuffer === '000000') {
      currentUser = { nome: 'Cozinha', pin: '000000', role: 'cozinha', id: 'cozinha' };
      pinBuffer = '';
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      document.getElementById('userChip').textContent = '🍳 Cozinha';
      Nav.applyRole('cozinha');
      Nav.goTo('comanda');
      toast('Modo Cozinha ativado 🍳');
      return;
    }
    const users = getUsers();
    const found = users.find(u => u.pin === pinBuffer);
    if (found) {
      currentUser = found;
      pinBuffer = '';
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      const roleLabel = { dono: 'Dono', atendente: 'Atendente', entregador: 'Entregador' }[found.role] || found.role;
      document.getElementById('userChip').textContent = `${found.nome} · ${roleLabel}`;
      Nav.applyRole(found.role);
      Nav.goTo(found.role === 'entregador' ? 'entrega' : 'venda');
      toast(`Bem-vindo(a), ${found.nome}!`);
    } else {
      showError('PIN incorreto.');
      pinBuffer = '';
      updateDots();
    }
  }

  function press(key) {
    if (key === 'clear') { pinBuffer = ''; updateDots(); return; }
    if (key === 'back') { pinBuffer = pinBuffer.slice(0, -1); updateDots(); return; }
    if (pinBuffer.length >= 6) return;
    pinBuffer += key;
    updateDots();
    if (pinBuffer.length >= 4) {
      // tenta login automaticamente a cada dígito a partir de 4
      const users = getUsers();
      if (users.some(u => u.pin === pinBuffer)) tryLogin();
      else if (pinBuffer.length === 6) tryLogin();
    }
  }

  function logout() {
    currentUser = null;
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    pinBuffer = '';
    updateDots();
  }

  function init() {
    document.querySelectorAll('.pin-key').forEach(btn => {
      btn.addEventListener('click', () => press(btn.dataset.key));
    });
    document.getElementById('logoutBtn').addEventListener('click', logout);
  }

  function getCurrentUser() { return currentUser; }
  function isDono() { return currentUser && currentUser.role === 'dono'; }

  return { init, getCurrentUser, isDono, logout, DEFAULT_OWNER };
})();

/* ==================== MÓDULO: USUÁRIOS (Firestore) ==================== */
const Users = (() => {
  let cache = [];

  function watch() {
    fdb.collection('usuarios').onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderList();
    }, () => {});
  }

  function add(nome, pin, role) {
    if (!nome || !/^\d{4,6}$/.test(pin)) { toast('Preencha nome e um PIN de 4 a 6 dígitos.'); return; }
    fdb.collection('usuarios').add({ nome, pin, role, criadoEm: new Date().toISOString() });
    toast('Usuário adicionado ✅');
  }

  function remove(id) {
    fdb.collection('usuarios').doc(id).delete();
    toast('Usuário removido.');
  }

  function renderList() {
    const container = document.getElementById('cfg-user-list');
    if (!container) return;
    container.innerHTML = '';
    const all = [Auth.DEFAULT_OWNER, ...cache];
    all.forEach(u => {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.innerHTML = `<span>${u.nome} <span class="user-role-badge">${u.role}</span></span>
        <span>${u.id === 'default-owner' ? '' : `<button class="li-icon-btn danger" data-del="${u.id}">🗑️</button>`}</span>`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => remove(b.dataset.del)));
  }

  return { watch, add, remove, get cache() { return cache; } };
})();

/* ==================== MÓDULO: BANCO DE DADOS (Firestore + cache local) ==================== */
const DB = (() => {
  const cache = { estoque: [], produtos: [], vendas: [] };
  const pendingDelete = {}; // ids ocultos otimisticamente até confirmação/expiração
  const listeners = [];

  function notify() { listeners.forEach(fn => { try { fn(); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); }

  function watchCollection(name, key) {
    fdb.collection(name).onSnapshot(snap => {
      cache[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      notify();
    }, err => {
      console.error(name, err);
      toast(`⚠️ Erro ao ler "${name}": ${err.code === 'permission-denied' ? 'sem permissão (verifique as Regras do Firestore)' : err.message}`);
    });
  }

  function reportError(action, err) {
    console.error(action, err);
    const msg = err.code === 'permission-denied'
      ? `⚠️ Sem permissão para ${action}. Verifique as Regras do Firestore (aba Regras → Publicar).`
      : `⚠️ Erro ao ${action}: ${err.message}`;
    toast(msg);
  }

  function init() {
    watchCollection('estoque', 'estoque');
    watchCollection('produtos', 'produtos');
    watchCollection('vendas', 'vendas');
  }

  function visible(list) { return list.filter(i => !pendingDelete[i.id]); }

  return {
    onChange,
    init,

    // ----- Estoque -----
    getEstoque: () => visible(cache.estoque).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)),
    addEstoqueItem(item) {
      item.criadoEm = new Date().toISOString();
      return fdb.collection('estoque').add(item).catch(err => reportError('salvar item no estoque', err));
    },
    updateEstoqueItem(id, patch) {
      return fdb.collection('estoque').doc(id).update(patch).catch(err => reportError('atualizar estoque', err));
    },
    deleteEstoqueItemWithUndo(id, label) {
      pendingDelete[id] = true; notify();
      const timer = setTimeout(() => {
        fdb.collection('estoque').doc(id).delete().catch(err => reportError('excluir item', err));
        delete pendingDelete[id];
      }, 5000);
      undoToast(`"${label}" excluído.`, () => { clearTimeout(timer); delete pendingDelete[id]; notify(); });
    },
    adjustEstoqueQtd(id, delta) {
      const item = cache.estoque.find(i => i.id === id);
      if (!item) {
        reportError(`baixar estoque (item vinculado não encontrado — id: ${id})`, { code: 'not-found', message: 'O produto pode ter sido excluído e recriado. Verifique o vínculo em Produtos/Adicionais.' });
        return { ok: false };
      }
      const antes = parseFloat(item.quantidade) || 0;
      const depois = Math.max(0, antes + delta);
      fdb.collection('estoque').doc(id).update({ quantidade: depois }).catch(err => reportError(`baixar estoque de "${item.nome}"`, err));
      return { ok: true, nome: item.nome, unidade: item.unidade, antes, depois };
    },

    // ----- Produtos -----
    getProdutos: () => visible(cache.produtos).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)),
    addProduto(p) {
      p.criadoEm = new Date().toISOString();
      return fdb.collection('produtos').add(p).catch(err => reportError('salvar produto', err));
    },
    updateProduto(id, patch) {
      return fdb.collection('produtos').doc(id).update(patch).catch(err => reportError('atualizar produto', err));
    },
    deleteProdutoWithUndo(id, label) {
      pendingDelete[id] = true; notify();
      const timer = setTimeout(() => {
        fdb.collection('produtos').doc(id).delete().catch(err => reportError('excluir produto', err));
        delete pendingDelete[id];
      }, 5000);
      undoToast(`"${label}" excluído.`, () => { clearTimeout(timer); delete pendingDelete[id]; notify(); });
    },

    // ----- Vendas -----
    getVendas: () => visible(cache.vendas).sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora)),
    addVenda(v) {
      v.dataHora = new Date().toISOString();
      return fdb.collection('vendas').add(v).catch(err => reportError('registrar venda', err));
    },
    deleteVenda(id) {
      return fdb.collection('vendas').doc(id).delete().catch(err => reportError('excluir venda', err));
    },
    updateVenda(id, patch) {
      return fdb.collection('vendas').doc(id).update(patch).catch(err => reportError('atualizar venda', err));
    },

    // ----- Backup / Restore -----
    exportAll() {
      return {
        exportadoEm: new Date().toISOString(),
        estoque: cache.estoque,
        produtos: cache.produtos,
        produtosAvulsos: ProdutosAvulsos.cache,
        categorias: ConfigGeral.cache.categorias || [],
        vendas: cache.vendas,
        extras: JSON.parse(localStorage.getItem('bs_extras') || '[]'),
        combos: JSON.parse(localStorage.getItem('bs_combos') || '[]')
      };
    },
    async importAll(data) {
      const batchAdd = async (colName, items) => {
        for (const item of (items || [])) {
          const clone = { ...item };
          delete clone.id;
          await fdb.collection(colName).add(clone);
        }
      };
      await batchAdd('estoque', data.estoque);
      await batchAdd('produtos', data.produtos);
      // produtosAvulsos: cada item referencia um estoqueId — se vier um "produtosCompletos"
      // (nome+preço+categoria+foto, sem estoqueId ainda), criamos o item de estoque primeiro
      // e ligamos os dois automaticamente.
      for (const item of (data.produtosCompletos || [])) {
        const ref = await fdb.collection('estoque').add({
          nome: item.nome, tipo: 'Produto pronto', unidade: 'Un', valor: 0,
          quantidade: 999999, estoqueIdeal: 0, estoqueMax: 999999,
          criadoEm: new Date().toISOString()
        });
        await fdb.collection('produtosAvulsos').add({
          estoqueId: ref.id, nome: item.nome, preco: item.preco,
          descricao: item.descricao || '', categoria: item.categoria || '',
          foto: item.foto || ''
        });
      }
      await batchAdd('produtosAvulsos', data.produtosAvulsos);
      await batchAdd('vendas', data.vendas);
      if (data.categorias && data.categorias.length) {
        const atuais = ConfigGeral.cache.categorias || [];
        const novas = [...new Set([...atuais, ...data.categorias])];
        await ConfigGeral.save({ categorias: novas });
      }
      if (data.extras) localStorage.setItem('bs_extras', JSON.stringify(data.extras));
      if (data.combos) localStorage.setItem('bs_combos', JSON.stringify(data.combos));
    }
  };
})();

/* ==================== NAVEGAÇÃO (com permissões por papel) ==================== */
/* ==================== MÓDULO: PRODUTOS AVULSOS (revenda direta, ex: Coca-Cola) ==================== */
const ProdutosAvulsos = (() => {
  let cache = [];

  function watch() {
    fdb.collection('produtosAvulsos').onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (typeof refreshCurrentScreen === 'function') refreshCurrentScreen(currentActiveTab());
    }, () => {});
  }

  function add(estoqueId, preco) {
    const item = DB.getEstoque().find(i => i.id === estoqueId);
    if (!item || !preco || preco <= 0) { toast('Escolha um item do estoque e informe o preço.'); return; }
    const custoUnit = item.quantidade > 0 ? (item.valor / item.quantidade) : 0;
    fdb.collection('produtosAvulsos').add({
      nome: item.nome, preco, estoqueId, custoUnit, criadoEm: new Date().toISOString()
    }).catch(err => toast('Erro ao adicionar produto: ' + err.message));
    toast('Produto avulso adicionado ✅');
  }

  function remove(id) {
    fdb.collection('produtosAvulsos').doc(id).delete();
    toast('Produto removido.');
  }

  function updateFoto(id, fotoBase64) {
    return fdb.collection('produtosAvulsos').doc(id).update({ foto: fotoBase64 })
      .catch(err => toast('Erro ao salvar foto: ' + err.message));
  }

  function update(id, patch) {
    return fdb.collection('produtosAvulsos').doc(id).update(patch)
      .catch(err => toast('Erro ao atualizar produto: ' + err.message));
  }

  return { watch, add, remove, updateFoto, update, get cache() { return cache; } };
})();

/* ==================== MÓDULO: CONFIGURAÇÕES GERAIS COMPARTILHADAS (Firestore) ====================
   Guarda dados que precisam ser vistos tanto pelo app da equipe quanto pela
   página do cliente (QR code): chave Pix e preços dos tamanhos do "Criar copo". */
const ConfigGeral = (() => {
  let cache = { chavePix: '', tamanhos: [
    { key: '300ml', label: '300ml', preco: 15 },
    { key: '500ml', label: '500ml', preco: 20 },
    { key: '700ml', label: '700ml', preco: 25 }
  ], lojaLocalizacao: null, faixasEntrega: [], taxaMinima: 0, telefoneLoja: '',
  taxaZeroAtiva: false, categorias: [] };
  const listeners = [];

  function watch() {
    fdb.collection('config').doc('geral').onSnapshot(snap => {
      if (snap.exists) cache = { ...cache, ...snap.data() };
      listeners.forEach(fn => { try { fn(); } catch (e) {} });
    }, () => {});
  }

  function onChange(fn) { listeners.push(fn); }

  function save(patch) {
    cache = { ...cache, ...patch };
    return fdb.collection('config').doc('geral').set(patch, { merge: true })
      .catch(err => toast('Erro ao salvar configuração: ' + err.message));
  }

  async function getNextOrderNumber() {
    const ref = fdb.collection('config').doc('geral');
    for (let tentativa = 0; tentativa < 25; tentativa++) {
      const candidato = Math.floor(Math.random() * 900) + 100; // sempre 3 dígitos: 100-999
      try {
        return await fdb.runTransaction(async (tx) => {
          const doc = await tx.get(ref);
          const usados = (doc.exists && doc.data().numerosPedidoUsados) || [];
          if (usados.includes(candidato)) throw new Error('colisao');
          const novos = usados.length >= 200 ? [...usados.slice(-150), candidato] : [...usados, candidato];
          tx.set(ref, { numerosPedidoUsados: novos }, { merge: true });
          return candidato;
        });
      } catch (e) {
        if (e.message !== 'colisao') { toast('Erro ao gerar número do pedido: ' + e.message); return null; }
        // colisão: tenta outro número aleatório
      }
    }
    return Math.floor(Math.random() * 900) + 100; // último recurso, muito improvável de chegar aqui
  }

  return { watch, onChange, save, getNextOrderNumber, get cache() { return cache; } };
})();

/* ==================== HELPER: DISTÂNCIA E TAXA DE ENTREGA ==================== */
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const toRad = v => v * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function calcularTaxaEntrega(km) {
  if (ConfigGeral.cache.taxaZeroAtiva) return 0;
  const faixas = (ConfigGeral.cache.faixasEntrega || []).slice().sort((a, b) => a.ateKm - b.ateKm);
  const faixa = faixas.find(f => km <= f.ateKm);
  const valor = faixa ? faixa.preco : (faixas.length ? faixas[faixas.length - 1].preco : 0);
  const minima = ConfigGeral.cache.taxaMinima || 0;
  return Math.max(valor, minima);
}

/* ==================== MÓDULO: PEDIDOS DO CLIENTE (via QR code) ==================== */
const PedidosCliente = (() => {
  let cache = [];

  function watch() {
    fdb.collection('pedidosCliente').onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (typeof refreshCurrentScreen === 'function') refreshCurrentScreen(currentActiveTab());
      if (typeof Historico !== 'undefined' && Historico.updateBadge) Historico.updateBadge();
    }, () => {});
  }

  function pendentes() { return cache.filter(p => p.status === 'pendente'); }

  function confirmarPagamento(id) {
    const pedido = cache.find(p => p.id === id);
    if (!pedido) return;

    const taxa = pedido.taxaEntrega || 0;
    const venda = {
      itens: pedido.itens, subtotal: pedido.total - taxa, desconto: 0, total: pedido.total,
      custoTotal: pedido.itens.reduce((s, i) => s + (i.custo || 0) * i.qtd, 0),
      lucro: 0, formaPagamento: pedido.formaPagamento,
      dataHora: new Date().toISOString(),
      atendente: (Auth.getCurrentUser() || {}).nome || 'N/A',
      origem: 'qrcode', nomeCliente: pedido.nome, telefoneCliente: pedido.telefone || '',
      pago: true, prontoCozinha: pedido.prontoCozinha === true,
      numeroPedido: pedido.numeroPedido || null,
      tipoEntrega: pedido.tipoEntrega || 'retirada', endereco: pedido.endereco || '',
      localizacao: pedido.localizacao || null, taxaEntrega: taxa, distanciaKm: pedido.distanciaKm || null,
      statusEntrega: pedido.tipoEntrega === 'entrega' ? (pedido.statusEntrega || 'pendente') : null,
      entregadorId: pedido.entregadorId || null,
      entregueEm: pedido.entregueEm || null,
      precisaTroco: pedido.precisaTroco || false, trocoPara: pedido.trocoPara || null
    };
    venda.lucro = venda.total - taxa - venda.custoTotal;
    DB.addVenda(venda);

    pedido.itens.forEach(item => {
      (item.composicao || []).forEach(c => {
        if (c.estoqueId) DB.adjustEstoqueQtd(c.estoqueId, -(c.porcaoQtd * item.qtd));
      });
    });

    fdb.collection('pedidosCliente').doc(id).delete();
    toast(`Pagamento de ${pedido.nome} confirmado ✅`);
  }

  function recusar(id) {
    fdb.collection('pedidosCliente').doc(id).delete();
    toast('Pedido removido.');
  }

  return { watch, pendentes, confirmarPagamento, recusar, get cache() { return cache; } };
})();


const Nav = (() => {
  // Sub-telas que vivem "dentro" da Gestão — usadas só pra destacar o botão certo no topo
  const SUBSCREEN_PARENT = { produtos: 'gestao', historico: 'gestao', usuarios: 'gestao', loja: 'gestao' };

  function applyRole(role) {
    document.querySelectorAll('[data-roles]').forEach(el => {
      const allowed = el.dataset.roles.split(',').map(r => r.trim());
      el.style.display = allowed.includes(role) ? '' : 'none';
    });
  }

  function goTo(tab) {
    const highlightTab = SUBSCREEN_PARENT[tab] || tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === highlightTab));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + tab);
    if (screen) screen.classList.add('active');
    refreshCurrentScreen(tab);
  }

  function init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => goTo(btn.dataset.tab));
    });
    // Linhas da tela de Gestão e links "← Voltar" — delegação de clique
    document.body.addEventListener('click', (e) => {
      const el = e.target.closest('[data-goto]');
      if (el) goTo(el.dataset.goto);
    });
  }

  return { init, applyRole, goTo };
})();

function refreshCurrentScreen(tab) {
  if (tab === 'venda') PDV.render();
  if (tab === 'produtos') { Categorias.render(); Config.renderProdutos(); }
  if (tab === 'historico') Historico.render();
  if (tab === 'comanda') Comanda.render();
  if (tab === 'entrega') Entrega.render();
  if (tab === 'usuarios') Users.renderList();
  if (tab === 'loja') Config.renderLoja();
}

function currentActiveTab() {
  const activeScreen = document.querySelector('.screen.active');
  if (activeScreen) return activeScreen.id.replace('screen-', '');
  const active = document.querySelector('.tab-btn.active');
  return active ? active.dataset.tab : 'venda';
}

/* ==================== MÓDULO 1: ENTRADA DE PRODUTOS ==================== */
const Entrada = (() => {
  const EMOJI_OPTIONS = ['🍫','🍓','🍇','🍌','🍍','🥝','🥥','🍒','🍑','🍋','🍊','🍉','🥜','🌰','🍪','🍬','🍭','🧁','🍦','🥛','🍼','🥤','🧃','🍯'];
  let selectedEmojis = [];
  let selectedTipo = 'Produto pronto';

  function renderEmojiPicker() {
    const container = document.getElementById('ent-emoji-picker');
    container.innerHTML = EMOJI_OPTIONS.map(e =>
      `<button type="button" class="emoji-pick ${selectedEmojis.includes(e) ? 'selected' : ''}" data-emoji="${e}">${e}</button>`
    ).join('');
    container.querySelectorAll('.emoji-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const e = btn.dataset.emoji;
        if (selectedEmojis.includes(e)) {
          selectedEmojis = selectedEmojis.filter(x => x !== e);
        } else {
          if (selectedEmojis.length >= 3) { toast('Máximo de 3 emojis por produto.'); return; }
          selectedEmojis.push(e);
        }
        renderEmojiPicker();
      });
    });
  }

  function clearForm() {
    ['ent-nome','ent-marca','ent-valor','ent-qtd','ent-fornecedor','ent-adicional-preco','ent-adicional-porcao'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ent-unidade').value = 'L';
    document.getElementById('ent-is-adicional').checked = false;
    document.getElementById('ent-adicional-fields').style.display = 'none';
    selectedEmojis = [];
    renderEmojiPicker();
    selectedTipo = 'Produto pronto';
    document.querySelectorAll('.tipo-chip').forEach(c => c.classList.toggle('active', c.dataset.tipo === selectedTipo));
  }

  function add() {
    const nome = document.getElementById('ent-nome').value.trim();
    const marca = document.getElementById('ent-marca').value.trim();
    const valor = parseFloat(document.getElementById('ent-valor').value) || 0;
    const unidade = document.getElementById('ent-unidade').value;
    const qtd = parseFloat(document.getElementById('ent-qtd').value) || 0;
    const tipo = selectedTipo;
    const fornecedor = document.getElementById('ent-fornecedor').value.trim();
    const isAdicional = document.getElementById('ent-is-adicional').checked;
    const precoAdicional = parseFloat(document.getElementById('ent-adicional-preco').value) || 0;
    const porcaoQtd = parseFloat(document.getElementById('ent-adicional-porcao').value) || 0;

    if (!nome || qtd <= 0) { toast('Preencha nome e quantidade.'); return; }
    if (isAdicional && (precoAdicional <= 0 || porcaoQtd <= 0)) {
      toast('Informe o preço de venda e a quantidade por porção do adicional.'); return;
    }

    DB.addEstoqueItem({
      nome, marca, valor, unidade, quantidade: qtd, tipo, fornecedor,
      estoqueMax: qtd * 2, estoqueIdeal: qtd,
      isAdicional, precoAdicional: isAdicional ? precoAdicional : 0, porcaoQtd: isAdicional ? porcaoQtd : 0,
      emojis: [...selectedEmojis]
    });
    clearForm();
    toast('Produto adicionado ao estoque ✅' + (isAdicional ? ' (disponível no Criar copo)' : ''));
  }

  function render(filter = '') {
    const list = DB.getEstoque().filter(i => !filter || i.nome.toLowerCase().includes(filter.toLowerCase()));
    const container = document.getElementById('ent-list');
    container.innerHTML = '';
    if (!list.length) { container.innerHTML = '<div class="empty-note">Nenhum item cadastrado ainda.</div>'; return; }
    list.forEach(item => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `
        <div>
          <div class="li-main">${(item.emojis && item.emojis.length) ? item.emojis.join('') + ' ' : ''}${item.nome} ${item.marca ? '· ' + item.marca : ''}</div>
          <div class="li-sub">${brl(item.valor)} · ${item.quantidade}${item.unidade} · ${item.fornecedor || 'sem fornecedor'}</div>
          <div class="li-sub">${fmtDateTime(item.criadoEm)}</div>
        </div>
        <div class="li-actions">
          <button class="li-icon-btn" data-edit="${item.id}">✏️</button>
          <button class="li-icon-btn danger" data-del="${item.id}" data-label="${item.nome}">🗑️</button>
        </div>`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      DB.deleteEstoqueItemWithUndo(b.dataset.del, b.dataset.label);
    }));
    container.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editItem(b.dataset.edit)));
  }

  function editItem(id) {
    const item = DB.getEstoque().find(i => i.id === id);
    if (!item) return;
    const novoValor = prompt('Novo valor de compra (R$):', item.valor);
    const novaQtd = prompt('Nova quantidade (' + item.unidade + '):', item.quantidade);
    const patch = {};
    if (novoValor !== null) patch.valor = parseFloat(novoValor) || item.valor;
    if (novaQtd !== null) patch.quantidade = parseFloat(novaQtd) || item.quantidade;
    DB.updateEstoqueItem(id, patch);
    toast('Item atualizado.');
  }

  function init() {
    document.getElementById('ent-add').addEventListener('click', add);
    document.getElementById('ent-search').addEventListener('input', e => render(e.target.value));
    document.getElementById('ent-is-adicional').addEventListener('change', e => {
      document.getElementById('ent-adicional-fields').style.display = e.target.checked ? 'flex' : 'none';
    });
    document.getElementById('ent-tipo-buttons').addEventListener('click', e => {
      const btn = e.target.closest('.tipo-chip'); if (!btn) return;
      document.querySelectorAll('.tipo-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      selectedTipo = btn.dataset.tipo;
    });
    renderEmojiPicker();
  }

  return { init, render };
})();

/* ==================== MÓDULO 2: CRIAÇÃO DE PRODUTOS ==================== */
const Criacao = (() => {
  // Produto simples: nome + categoria + preço + descrição. Sem receita/estoque manual.
  // Por baixo dos panos ainda criamos um registro interno (coleção "estoque") só pra
  // servir de referência ao produto avulso — com quantidade "infinita", sem tela de
  // gestão de estoque, sem alerta de quantidade mínima.

  function refreshCategoriaOptions() {
    const sel = document.getElementById('rev-categoria');
    if (!sel) return;
    const cats = ConfigGeral.cache.categorias || [];
    const atual = sel.value;
    sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('')
      || '<option value="">Cadastre uma categoria ao lado</option>';
    if (cats.includes(atual)) sel.value = atual;
  }

  function addRevenda() {
    const nome = document.getElementById('rev-nome').value.trim();
    const categoria = document.getElementById('rev-categoria').value;
    const preco = parseFloat(document.getElementById('rev-preco').value);
    const descricao = document.getElementById('rev-descricao').value.trim();
    if (!nome) { toast('Informe o nome do produto.'); return; }
    if (!preco || preco <= 0) { toast('Informe o preço de venda.'); return; }

    DB.addEstoqueItem({
      nome, tipo: 'Produto pronto', unidade: 'Un', valor: 0,
      quantidade: 999999, estoqueIdeal: 0, estoqueMax: 999999,
      criadoEm: new Date().toISOString()
    }).then(ref => {
      ProdutosAvulsos.add(ref.id, preco);
      setTimeout(() => {
        const criado = ProdutosAvulsos.cache.find(a => a.estoqueId === ref.id);
        if (criado) ProdutosAvulsos.update(criado.id, { descricao, categoria });
      }, 800);
    });

    document.getElementById('rev-nome').value = '';
    document.getElementById('rev-preco').value = '';
    document.getElementById('rev-descricao').value = '';
    toast('Produto adicionado ✅');
  }

  function init() {
    document.getElementById('rev-add').addEventListener('click', addRevenda);
    refreshCategoriaOptions();
  }

  function render() { refreshCategoriaOptions(); }

  return { init, render };
})();

/* ==================== MÓDULO: CATEGORIAS (ordem do cardápio) ==================== */
const Categorias = (() => {
  function list() { return ConfigGeral.cache.categorias || []; }

  function add() {
    const input = document.getElementById('cat-nome-input');
    const nome = input.value.trim();
    if (!nome) { toast('Digite o nome da categoria.'); return; }
    const cats = list();
    if (cats.includes(nome)) { toast('Essa categoria já existe.'); return; }
    ConfigGeral.save({ categorias: [...cats, nome] });
    input.value = '';
    render();
  }

  function remove(nome) {
    ConfigGeral.save({ categorias: list().filter(c => c !== nome) });
    render();
  }

  function move(nome, dir) {
    const cats = list().slice();
    const idx = cats.indexOf(nome);
    const novoIdx = idx + dir;
    if (idx === -1 || novoIdx < 0 || novoIdx >= cats.length) return;
    [cats[idx], cats[novoIdx]] = [cats[novoIdx], cats[idx]];
    ConfigGeral.save({ categorias: cats });
    render();
  }

  function render() {
    const container = document.getElementById('cat-list');
    if (!container) return;
    const cats = list();
    container.innerHTML = cats.map((c, i) => `
      <div class="list-item">
        <span class="li-main">${c}</span>
        <div class="li-actions">
          <button class="li-icon-btn" data-up="${c}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="li-icon-btn" data-down="${c}" ${i === cats.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="li-icon-btn danger" data-del="${c}">✕</button>
        </div>
      </div>`).join('') || '<div class="empty-note">Nenhuma categoria ainda. Crie a primeira acima.</div>';
    container.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => move(b.dataset.up, -1)));
    container.querySelectorAll('[data-down]').forEach(b => b.addEventListener('click', () => move(b.dataset.down, 1)));
    container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => remove(b.dataset.del)));
    Criacao.render();
  }

  function init() {
    document.getElementById('cat-add-btn').addEventListener('click', add);
    document.getElementById('cat-nome-input').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  }

  return { init, render, list };
})();

/* ==================== MÓDULO 3: PDV (VENDA) ==================== */
/* ==================== MÓDULO 3: PDV (VENDA) — v3 ==================== */
const PDV = (() => {
  let order = [];              // lista única (antes: sacola + comanda)
  let payment = 'Dinheiro';
  let tipoEntrega = 'retirada';
  let entregaLocalizacao = null; // {lat,lng}
  let entregaMap = null, entregaMarker = null;
  let selectedOrderIndex = -1;

  /* ---------- Grade de produtos ---------- */
  function renderProductGrid() {
    const grid = document.getElementById('pdv-product-grid');
    const adminRow = document.getElementById('pdv-produtos-admin');
    grid.innerHTML = '';

    adminRow.style.display = Auth.isDono() ? 'flex' : 'none';
    if (Auth.isDono()) renderAvulsoAdmin();
    const avulsos = ProdutosAvulsos.cache;
    if (!avulsos.length) { grid.innerHTML = '<div class="empty-note">Nenhum produto cadastrado ainda.</div>'; return; }
    avulsos.forEach(av => {
      const inOrder = order.find(o => o.refId === av.id && o.tipo === 'produto-avulso');
      const btn = document.createElement('button');
      btn.className = 'pdv-prod-btn';
      btn.innerHTML = `${av.foto ? `<img class="photo-thumb" src="${av.foto}">` : ''}<span>${emojiPrefix(av.estoqueId)}${av.nome}</span><span>${brl(av.preco)}</span>${inOrder ? `<span class="qty-badge">x${inOrder.qtd}</span>` : ''}`;
      if (Auth.isDono()) {
        const del = document.createElement('button');
        del.className = 'pdv-prod-del';
        del.textContent = '✕';
        del.addEventListener('click', (e) => { e.stopPropagation(); ProdutosAvulsos.remove(av.id); });
        btn.appendChild(del);
      }
      btn.addEventListener('click', () => { pulseBtn(btn); addAvulso(av); });
      grid.appendChild(btn);
    });
  }

  function emojiPrefix(estoqueId) {
    const item = DB.getEstoque().find(i => i.id === estoqueId);
    return (item && item.emojis && item.emojis.length) ? item.emojis.join('') + ' ' : '';
  }

  function pulseBtn(btn) {
    btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
  }

  function renderAvulsoAdmin() {
    const sel = document.getElementById('pdv-avulso-estoque');
    sel.innerHTML = DB.getEstoque().map(i => `<option value="${i.id}">${i.nome}</option>`).join('') || '<option value="">Cadastre no estoque primeiro</option>';
  }

  /* ---------- Adicionar itens simples ao pedido ---------- */
  let lastAddedIndex = -1;

  function addPreparado(p) {
    const existing = order.find(o => o.refId === p.id && o.tipo === 'preparado');
    if (existing) {
      existing.qtd++; selectedOrderIndex = order.indexOf(existing);
      syncObsBox();
    } else {
      const obsPrevia = document.getElementById('pdv-obs').value.trim();
      order.push({
        refId: p.id, tipo: 'preparado', nome: p.nome, preco: p.preco, qtd: 1, obs: obsPrevia, custo: p.custo || 0,
        composicao: (p.receita || []).map(r => ({ estoqueId: r.estoqueId, porcaoQtd: r.qtd }))
      });
      selectedOrderIndex = order.length - 1;
      document.getElementById('pdv-obs').value = '';
    }
    lastAddedIndex = selectedOrderIndex;
    renderAll();
  }

  function addAvulso(av) {
    const existing = order.find(o => o.refId === av.id && o.tipo === 'produto-avulso');
    if (existing) {
      existing.qtd++; selectedOrderIndex = order.indexOf(existing);
      syncObsBox();
    } else {
      const obsPrevia = document.getElementById('pdv-obs').value.trim();
      order.push({
        refId: av.id, tipo: 'produto-avulso', nome: av.nome, preco: av.preco, qtd: 1, obs: obsPrevia, custo: av.custoUnit || 0,
        composicao: [{ estoqueId: av.estoqueId, porcaoQtd: 1 }]
      });
      selectedOrderIndex = order.length - 1;
      document.getElementById('pdv-obs').value = '';
    }
    lastAddedIndex = selectedOrderIndex;
    renderAll();
  }

  function syncObsBox() {
    const box = document.getElementById('pdv-obs');
    box.value = (selectedOrderIndex >= 0 && order[selectedOrderIndex]) ? (order[selectedOrderIndex].obs || '') : '';
  }

  /* ---------- Lista única do pedido ---------- */
  function renderOrder() {
    const container = document.getElementById('pdv-order-list');
    container.innerHTML = '';
    if (!order.length) {
      container.innerHTML = '<div class="empty-note">Nenhum item no pedido. Toque em um produto.</div>';
      renderTotal();
      lastAddedIndex = -1;
      return;
    }
    order.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'list-item' + (idx === lastAddedIndex ? ' drop-in' : '');
      row.innerHTML = `
        <div class="order-select" data-select="${idx}" style="cursor:pointer; flex:1;">
          <div class="li-main">${item.nome}</div>
          ${item.obs ? `<div class="li-sub order-item-obs">"${item.obs}"</div>` : ''}
          <div class="li-sub">${brl(item.preco)} cada</div>
        </div>
        <div class="order-stepper">
          <button class="minus" data-minus="${idx}">−</button>
          <span class="li-main">${item.qtd}</span>
          <button class="plus" data-plus="${idx}">+</button>
        </div>`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-select]').forEach(el => el.addEventListener('click', () => {
      selectedOrderIndex = parseInt(el.dataset.select); syncObsBox();
    }));
    container.querySelectorAll('[data-plus]').forEach(b => b.addEventListener('click', () => { order[b.dataset.plus].qtd++; renderAll(); }));
    container.querySelectorAll('[data-minus]').forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.minus); order[i].qtd--;
      if (order[i].qtd <= 0) { order.splice(i, 1); if (selectedOrderIndex >= order.length) selectedOrderIndex = order.length - 1; syncObsBox(); }
      renderAll();
    }));
    renderTotal();
    lastAddedIndex = -1;
  }

  function getDesconto(total) {
    const tipo = document.getElementById('pdv-desc-tipo').value;
    const val = parseFloat(document.getElementById('pdv-desconto').value) || 0;
    if (val <= 0) return 0;
    return tipo === '%' ? total * (val / 100) : val;
  }

  function taxaAtual() {
    if (tipoEntrega !== 'entrega' || !entregaLocalizacao || !ConfigGeral.cache.lojaLocalizacao) return 0;
    const loja = ConfigGeral.cache.lojaLocalizacao;
    const km = calcularDistanciaKm(loja.lat, loja.lng, entregaLocalizacao.lat, entregaLocalizacao.lng);
    return calcularTaxaEntrega(km);
  }

  function distanciaAtualKm() {
    if (tipoEntrega !== 'entrega' || !entregaLocalizacao || !ConfigGeral.cache.lojaLocalizacao) return null;
    const loja = ConfigGeral.cache.lojaLocalizacao;
    return calcularDistanciaKm(loja.lat, loja.lng, entregaLocalizacao.lat, entregaLocalizacao.lng);
  }

  function renderTotal() {
    const subtotal = order.reduce((s, i) => s + i.preco * i.qtd, 0);
    const desconto = getDesconto(subtotal);
    const taxa = taxaAtual();
    const total = Math.max(0, subtotal - desconto + taxa);
    document.getElementById('pdv-total').textContent = brl(total);
    return { subtotal, desconto, taxa, total };
  }

  function renderAll() { renderProductGrid(); renderOrder(); }

  function printReceipt(venda) {
    const area = document.getElementById('printArea');
    const itensHtml = venda.itens.map(i => `
      <div class="p-line"><span>${i.qtd}x ${i.nome}</span><span>${brl(i.preco * i.qtd)}</span></div>
      ${i.obs ? `<div class="p-obs">obs: ${i.obs}</div>` : ''}`).join('');
    area.innerHTML = `
      <h2>DISK DOURADO</h2>
      ${venda.numeroPedido ? `<div class="p-line"><b>Pedido #${venda.numeroPedido}</b></div>` : ''}
      <div class="p-line"><span>${fmtDateTime(venda.dataHora)}</span></div>
      <hr>
      ${itensHtml}
      <hr>
      ${venda.desconto ? `<div class="p-line"><span>Subtotal</span><span>${brl(venda.subtotal)}</span></div><div class="p-line"><span>Desconto</span><span>-${brl(venda.desconto)}</span></div>` : ''}
      ${venda.taxaEntrega ? `<div class="p-line"><span>Taxa de entrega</span><span>${brl(venda.taxaEntrega)}</span></div>` : ''}
      <div class="p-line"><b>TOTAL</b><b>${brl(venda.total)}</b></div>
      <div class="p-line"><span>Pagamento</span><span>${venda.formaPagamento}</span></div>
      ${venda.tipoEntrega === 'entrega' ? `<div class="p-line"><span>Entrega</span><span>${venda.endereco || ''}</span></div>` : ''}
      <hr>
      <p style="text-align:center;">Obrigado pela preferência!</p>`;
    window.print();
  }

  async function finalize() {
    if (!order.length) { toast('Adicione itens antes de finalizar.'); return; }
    if (tipoEntrega === 'entrega' && !entregaLocalizacao) { toast('Marque no mapa onde fica o cliente antes de finalizar.'); return; }
    const { subtotal, desconto, taxa, total } = renderTotal();
    const custoTotal = order.reduce((s, i) => s + (i.custo || 0) * i.qtd, 0);
    const numeroPedido = await ConfigGeral.getNextOrderNumber();
    const venda = {
      itens: order, subtotal, desconto, total, custoTotal, lucro: (total - taxa) - custoTotal,
      formaPagamento: payment,
      dataHora: new Date().toISOString(),
      atendente: (Auth.getCurrentUser() || {}).nome || 'N/A',
      origem: 'pdv', pago: true, prontoCozinha: false,
      numeroPedido: numeroPedido,
      tipoEntrega, endereco: document.getElementById('pdv-entrega-endereco').value.trim(),
      nomeCliente: document.getElementById('pdv-entrega-nome').value.trim(),
      telefoneCliente: document.getElementById('pdv-entrega-telefone').value.trim(),
      localizacao: entregaLocalizacao, taxaEntrega: taxa, distanciaKm: distanciaAtualKm(),
      statusEntrega: tipoEntrega === 'entrega' ? 'pendente' : null, entregadorId: null
    };
    DB.addVenda(venda);

    const mudancas = [];
    order.forEach(item => {
      (item.composicao || []).forEach(c => {
        if (c.estoqueId) {
          const r = DB.adjustEstoqueQtd(c.estoqueId, -(c.porcaoQtd * item.qtd));
          if (r.ok) mudancas.push(`${r.nome} ${r.antes}→${r.depois}${r.unidade}`);
        }
      });
    });

    printReceipt(venda);
    order = [];
    selectedOrderIndex = -1;
    tipoEntrega = 'retirada'; entregaLocalizacao = null;
    document.getElementById('pdv-desconto').value = '';
    document.getElementById('pdv-obs').value = '';
    document.getElementById('pdv-entrega-endereco').value = '';
    document.getElementById('pdv-entrega-nome').value = '';
    document.getElementById('pdv-entrega-telefone').value = '';
    document.querySelectorAll('#pdv-tipo-entrega .chip').forEach(c => c.classList.toggle('active', c.dataset.tipo === 'retirada'));
    document.getElementById('pdv-entrega-fields').style.display = 'none';
    renderAll();
    const resumoEstoque = mudancas.length ? ' 📦 ' + mudancas.slice(0, 3).join(' · ') + (mudancas.length > 3 ? '...' : '') : '';
    toast(`Venda #${numeroPedido} finalizada ✅` + resumoEstoque);
  }

  function initEntregaMap() {
    if (entregaMap) { setTimeout(() => entregaMap.invalidateSize(), 200); return; }
    const loja = ConfigGeral.cache.lojaLocalizacao;
    const centro = loja ? [loja.lat, loja.lng] : [-23.5505, -46.6333];
    entregaMap = L.map('pdv-entrega-mapa').setView(centro, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(entregaMap);
    if (loja) L.marker(centro, { title: 'Loja' }).addTo(entregaMap);
    entregaMap.on('click', (e) => {
      entregaLocalizacao = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (entregaMarker) entregaMap.removeLayer(entregaMarker);
      entregaMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(entregaMap);
      const km = loja ? calcularDistanciaKm(loja.lat, loja.lng, e.latlng.lat, e.latlng.lng) : 0;
      const taxa = calcularTaxaEntrega(km);
      document.getElementById('pdv-entrega-status').textContent = `📍 ${km.toFixed(1)}km da loja · Taxa: ${brl(taxa)}`;
      renderTotal();
    });
    setTimeout(() => entregaMap.invalidateSize(), 200);
  }

  function init() {
    document.getElementById('pdv-avulso-add').addEventListener('click', () => {
      const estoqueId = document.getElementById('pdv-avulso-estoque').value;
      const preco = parseFloat(document.getElementById('pdv-avulso-preco').value);
      ProdutosAvulsos.add(estoqueId, preco);
      document.getElementById('pdv-avulso-preco').value = '';
    });
    document.getElementById('pdv-payment').addEventListener('click', e => {
      const btn = e.target.closest('.pay-chip'); if (!btn) return;
      document.querySelectorAll('.pay-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      payment = btn.dataset.pay;
    });
    document.getElementById('pdv-tipo-entrega').addEventListener('click', e => {
      const btn = e.target.closest('.chip'); if (!btn) return;
      document.querySelectorAll('#pdv-tipo-entrega .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      tipoEntrega = btn.dataset.tipo;
      const fields = document.getElementById('pdv-entrega-fields');
      fields.style.display = (tipoEntrega === 'entrega') ? 'block' : 'none';
      if (tipoEntrega === 'entrega') { initEntregaMap(); }
      else { entregaLocalizacao = null; }
      renderTotal();
    });
    document.getElementById('pdv-desconto').addEventListener('input', renderTotal);
    document.getElementById('pdv-desc-tipo').addEventListener('change', renderTotal);
    document.getElementById('pdv-del').addEventListener('click', () => {
      order.pop(); selectedOrderIndex = order.length - 1; syncObsBox(); renderAll();
    });
    document.getElementById('pdv-add-item').addEventListener('click', () => {
      if (selectedOrderIndex < 0 || !order[selectedOrderIndex]) { toast('Toque em um item do pedido para selecioná-lo.'); return; }
      order[selectedOrderIndex].obs = document.getElementById('pdv-obs').value.trim();
      renderOrder();
      toast('Observação salva ✅');
    });
    document.getElementById('pdv-finalizar').addEventListener('click', finalize);
  }

  function render() { renderAll(); }

  return { init, render, printReceipt };
})();

/* ==================== MÓDULO 4: ESTOQUE (com alerta crítico) ==================== */
const Estoque = (() => {
  let currentCat = 'Condimento';
  let alertDismissed = false;

  function checkAlert() {
    const banner = document.getElementById('alertBanner');
    if (currentActiveTab() !== 'entrada') { banner.style.display = 'none'; return; }
    const criticos = DB.getEstoque().filter(i => isCritico(i));
    if (criticos.length && !alertDismissed) {
      document.getElementById('alertText').textContent =
        `⚠️ ${criticos.length} item(ns) com estoque crítico: ${criticos.slice(0,3).map(i => i.nome).join(', ')}${criticos.length > 3 ? '...' : ''}`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  function isCritico(item) { return item.quantidade < item.estoqueIdeal; }

  function progressPct(item) {
    const max = item.estoqueMax || item.estoqueIdeal || 1;
    return Math.max(0, Math.min(100, (item.quantidade / max) * 100));
  }

  function renderList() {
    const container = document.getElementById('estoque-list');
    const list = DB.getEstoque().filter(i => (i.tipo || 'Condimento') === currentCat);
    container.innerHTML = '';
    if (!list.length) { container.innerHTML = '<div class="empty-note">Nenhum item nesta categoria.</div>'; return; }
    list.forEach(item => {
      const emojis = (item.emojis && item.emojis.length) ? item.emojis.join('') + ' ' : '🍇 ';
      const critico = isCritico(item);
      const row = document.createElement('div');
      row.className = 'stock-card';
      row.innerHTML = `
        <div class="stock-card-top">
          <span class="stock-emoji">${emojis}</span>
          <div class="stock-info">
            <p class="stock-nome">${item.nome}${critico ? '<span class="critico-badge">CRÍTICO</span>' : ''}</p>
            <p class="stock-sub">${item.quantidade}${item.unidade} · mínimo ${item.estoqueIdeal}${item.unidade}</p>
          </div>
          <div class="stock-stepper">
            <button data-minus="${item.id}">−</button>
            <button data-plus="${item.id}">+</button>
          </div>
        </div>
        <div class="stock-progress-track"><div class="stock-progress-fill ${critico ? 'critico' : ''}" style="width:${progressPct(item)}%"></div></div>`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-plus]').forEach(b => b.addEventListener('click', () => DB.adjustEstoqueQtd(b.dataset.plus, 1)));
    container.querySelectorAll('[data-minus]').forEach(b => b.addEventListener('click', () => DB.adjustEstoqueQtd(b.dataset.minus, -1)));
  }

  function editStock(id) {
    const item = DB.getEstoque().find(i => i.id === id);
    if (!item) return;
    const atual = prompt('Estoque atual:', item.quantidade);
    const ideal = prompt('Estoque mínimo (alerta):', item.estoqueIdeal);
    const max = prompt('Estoque máximo (usado na barra de progresso):', item.estoqueMax);
    const patch = {};
    if (atual !== null) patch.quantidade = parseFloat(atual) || item.quantidade;
    if (ideal !== null) patch.estoqueIdeal = parseFloat(ideal) || item.estoqueIdeal;
    if (max !== null) patch.estoqueMax = parseFloat(max) || item.estoqueMax;
    DB.updateEstoqueItem(id, patch);
    toast('Estoque atualizado.');
  }

  function renderValorTotal() {
    const el = document.getElementById('estoque-valor-total');
    if (!el) return;
    const total = DB.getEstoque().reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0);
    el.textContent = 'Valor em estoque: ' + brl(total);
  }

  function renderCompras() {
    const container = document.getElementById('estoque-compras');
    const list = DB.getEstoque().filter(i => i.quantidade < i.estoqueIdeal);
    container.innerHTML = '';
    if (!list.length) { container.innerHTML = '<div class="empty-note">Estoque em dia — nada a comprar.</div>'; return; }
    list.forEach(item => {
      const necessario = (item.estoqueIdeal - item.quantidade).toFixed(2);
      const emojis = (item.emojis && item.emojis.length) ? item.emojis.join('') + ' ' : '';
      const row = document.createElement('div');
      row.className = 'compra-row';
      row.innerHTML = `<span>${emojis}${item.nome}</span><span>repor ~${necessario}${item.unidade}</span>`;
      container.appendChild(row);
    });
  }

  function renderAll() { renderList(); renderValorTotal(); renderCompras(); checkAlert(); }

  function init() {
    document.getElementById('estoque-cat-toggle').addEventListener('click', e => {
      const btn = e.target.closest('.chip'); if (!btn) return;
      document.querySelectorAll('#estoque-cat-toggle .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      renderList();
    });
    document.getElementById('alertClose').addEventListener('click', () => {
      alertDismissed = true;
      document.getElementById('alertBanner').style.display = 'none';
    });
  }

  return { init, render: renderAll, checkAlert };
})();

/* ==================== MÓDULO 5: FINANCEIRO ==================== */
const Financeiro = (() => {
  let selectedSize = '300ml';
  let selectedMonthIdx = -1;

  function vendasEntre(inicio, fim) {
    return DB.getVendas().filter(v => {
      const d = new Date(v.dataHora);
      return d >= inicio && d <= fim;
    });
  }

  function resumoPeriodo(vendas) {
    const total = vendas.reduce((s, v) => s + valorLoja(v), 0);
    const lucro = vendas.reduce((s, v) => s + v.lucro, 0);
    return { total, lucro, count: vendas.length };
  }

  function renderPeriodCards() {
    const now = new Date();
    const inicioHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const fimHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const inicio7 = new Date(now.getTime() - 6 * 86400000);
    inicio7.setHours(0, 0, 0, 0);
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    const hoje = resumoPeriodo(vendasEntre(inicioHoje, fimHoje));
    const sete = resumoPeriodo(vendasEntre(inicio7, fimHoje));
    const mes = resumoPeriodo(vendasEntre(inicioMes, fimHoje));

    document.getElementById('fin-hoje-total').textContent = brl(hoje.total);
    document.getElementById('fin-hoje-sub').textContent = `Lucro ${brl(hoje.lucro)} · ${hoje.count} vendas`;
    document.getElementById('fin-7dias-total').textContent = brl(sete.total);
    document.getElementById('fin-7dias-sub').textContent = `Lucro ${brl(sete.lucro)} · ${sete.count} vendas`;
    document.getElementById('fin-mes-total').textContent = brl(mes.total);
    document.getElementById('fin-mes-sub').textContent = `Lucro ${brl(mes.lucro)} · ${mes.count} vendas`;
  }

  function renderChart() {
    const container = document.getElementById('fin-chart');
    const vendas = DB.getVendas();
    const dias = [];
    const nomesDia = ['dom.','seg.','ter.','qua.','qui.','sex.','sáb.'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push({ label: nomesDia[d.getDay()], date: d });
    }
    const valores = dias.map(d => vendas.filter(v => new Date(v.dataHora).toDateString() === d.date.toDateString()).reduce((s, v) => s + valorLoja(v), 0));
    const max = Math.max(1, ...valores);
    container.innerHTML = dias.map((d, i) => {
      const pct = Math.max(3, (valores[i] / max) * 100);
      return `<div class="week-bar-col">
        <span class="week-bar-value">${valores[i] > 0 ? brl(valores[i]) : ''}</span>
        <div class="week-bar-fill" style="height:${pct}%"></div>
        <span class="week-bar-label">${d.label}</span>
      </div>`;
    }).join('');
  }

  function renderPagamentos() {
    const now = new Date();
    const vendas = DB.getVendas().filter(v => {
      const d = new Date(v.dataHora);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const porForma = {};
    vendas.forEach(v => { porForma[v.formaPagamento] = (porForma[v.formaPagamento] || 0) + valorLoja(v); });
    const container = document.getElementById('fin-pagamentos');
    container.innerHTML = '';
    const entries = Object.entries(porForma);
    if (!entries.length) { container.innerHTML = '<div class="empty-note">Nenhuma venda este mês ainda.</div>'; return; }
    entries.sort((a, b) => b[1] - a[1]).forEach(([forma, valor]) => {
      const row = document.createElement('div');
      row.className = 'pagamento-row';
      row.innerHTML = `<span>${forma}</span><b>${brl(valor)}</b>`;
      container.appendChild(row);
    });
  }

  function renderSizeSummary() {
    const vendas = DB.getVendas();
    const container = document.getElementById('fin-size-summary');
    let qtd = 0, fat = 0, lucro = 0;
    vendas.forEach(v => v.itens.forEach(item => {
      const produto = DB.getProdutos().find(p => p.id === item.refId);
      if (produto && produto.tamanho === selectedSize) {
        qtd += item.qtd; fat += item.preco * item.qtd; lucro += (item.preco - (item.custo||0)) * item.qtd;
      }
    }));
    container.innerHTML = `
      <div class="size-row"><span>Quantidade vendida</span><b>${qtd}</b></div>
      <div class="size-row"><span>Faturamento</span><b>${brl(fat)}</b></div>
      <div class="size-row"><span>Lucro</span><b>${brl(lucro)}</b></div>`;
  }

  function renderMonths() {
    const container = document.getElementById('fin-months');
    const vendas = DB.getVendas();
    const meses = getLastMonths(6);
    container.innerHTML = '';
    meses.forEach(m => {
      const vendasMes = vendas.filter(v => sameMonth(v.dataHora, m.date));
      const total = vendasMes.reduce((s, v) => s + valorLoja(v), 0);
      const lucro = vendasMes.reduce((s, v) => s + v.lucro, 0);
      const nomeCompleto = m.date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const row = document.createElement('div');
      row.className = 'mes-row';
      row.innerHTML = `<span class="mes-nome">${nomeCompleto}</span><span class="mes-valores"><span class="mes-total">${brl(total)}</span><span class="mes-lucro">${brl(lucro)}</span></span>`;
      container.appendChild(row);
    });
  }

  function computeTotals() {
    const vendas = DB.getVendas();
    const totals = {};
    let grandTotal = 0;
    vendas.forEach(v => v.itens.forEach(item => {
      if (!totals[item.nome]) totals[item.nome] = { nome: item.nome, qtd: 0, fat: 0, lucro: 0 };
      totals[item.nome].qtd += item.qtd;
      totals[item.nome].fat += item.preco * item.qtd;
      totals[item.nome].lucro += (item.preco - (item.custo||0)) * item.qtd;
      grandTotal += item.preco * item.qtd;
    }));
    return { totals: Object.values(totals), grandTotal };
  }

  const MEDALS = ['🥇', '🥈', '🥉'];
  function rankLabel(idx) { return MEDALS[idx] || `${idx + 1}º`; }

  function renderTop() {
    const { totals } = computeTotals();
    const ranked = [...totals].sort((a, b) => b.fat - a.fat).slice(0, 6);
    const container = document.getElementById('fin-top');
    container.innerHTML = '';
    if (!ranked.length) { container.innerHTML = '<div class="empty-note">Nenhuma venda registrada ainda.</div>'; return; }
    ranked.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'mes-row';
      row.innerHTML = `<span class="mes-nome" style="text-transform:none;">${rankLabel(idx)} ${r.nome}</span><span class="mes-total" style="color:var(--yellow);">${brl(r.fat)}</span>`;
      container.appendChild(row);
    });

    const rankedLucro = [...totals].sort((a, b) => b.lucro - a.lucro).slice(0, 6);
    const containerLucro = document.getElementById('fin-top-lucro');
    containerLucro.innerHTML = '';
    if (!rankedLucro.length) { containerLucro.innerHTML = '<div class="empty-note">Sem dados ainda.</div>'; return; }
    rankedLucro.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'mes-row';
      row.innerHTML = `<span class="mes-nome" style="text-transform:none;">${rankLabel(idx)} ${r.nome}</span><span class="mes-lucro">${brl(r.lucro)}</span>`;
      containerLucro.appendChild(row);
    });
  }

  function exportPdf() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { toast('Biblioteca de PDF não carregou. Verifique sua conexão.'); return; }
    const doc = new jsPDF();
    const vendas = DB.getVendas();
    const bruta = vendas.reduce((s, v) => s + valorLoja(v), 0);
    const liquido = vendas.reduce((s, v) => s + v.lucro, 0);
    const { totals } = computeTotals();
    const ranked = [...totals].sort((a, b) => b.fat - a.fat).slice(0, 10);

    doc.setFontSize(18); doc.text('Disk Dourado — Relatório Financeiro', 14, 18);
    doc.setFontSize(10); doc.text('Gerado em ' + fmtDateTime(new Date().toISOString()), 14, 25);
    doc.setFontSize(12);
    doc.text('Venda Bruta (total): ' + brl(bruta), 14, 38);
    doc.text('Lucro Líquido (total): ' + brl(liquido), 14, 46);
    doc.text('Total de vendas: ' + vendas.length, 14, 54);

    doc.setFontSize(13); doc.text('Top Vendas', 14, 68);
    doc.setFontSize(10);
    let y = 76;
    ranked.forEach((r, idx) => {
      doc.text(`${idx+1}. ${r.nome} — ${r.qtd}x — ${brl(r.fat)} (lucro ${brl(r.lucro)})`, 14, y);
      y += 7;
    });

    doc.save('relatorio-disk-dourado.pdf');
    toast('Relatório PDF exportado 📄');
  }

  function renderAll() { renderPeriodCards(); renderChart(); renderPagamentos(); renderSizeSummary(); renderMonths(); renderTop(); }

  function init() {
    document.getElementById('fin-size-toggle').addEventListener('click', e => {
      const btn = e.target.closest('.chip'); if (!btn) return;
      document.querySelectorAll('#fin-size-toggle .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size;
      renderSizeSummary();
    });
    document.getElementById('fin-export-pdf').addEventListener('click', exportPdf);
  }

  return { init, render: renderAll };
})();

/* ==================== MÓDULO 6: HISTÓRICO DE VENDAS ==================== */
const Historico = (() => {
  function renderPendentes() {
    const pendentes = PedidosCliente.pendentes();
    const card = document.getElementById('hist-pendentes-card');
    const container = document.getElementById('hist-pendentes-list');
    card.style.display = 'block';
    if (!pendentes.length) { container.innerHTML = '<div class="empty-note">Nenhum pedido pendente do cardápio digital.</div>'; return; }
    container.innerHTML = '';
    pendentes.forEach(p => {
      const itensResumo = p.itens.map(i => `${i.qtd}x ${i.nome}`).join(', ');
      const waUrl = p.telefone ? montarLinkWhatsApp(p.telefone) : null;
      const row = document.createElement('div');
      row.className = 'list-item pending-item';
      row.innerHTML = `
        <div style="flex:1;">
          <div class="li-main">👤 ${p.nome} ${p.telefone ? '· ' + p.telefone : ''}</div>
          <div class="li-sub">${itensResumo}</div>
          <div class="li-sub">${brl(p.total)} · ${p.formaPagamento} · ${fmtDateTime(p.criadoEm)}</div>
          <div class="pending-actions">
            <button class="btn-tiny-confirm" data-confirm="${p.id}">✅ Confirmar pagamento</button>
            ${waUrl ? `<a href="${waUrl}" target="_blank" class="btn-whats">💬 WhatsApp</a>` : ''}
            <button class="btn-tiny-danger" data-recusar="${p.id}">✕ Recusar</button>
          </div>
        </div>`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-confirm]').forEach(b => b.addEventListener('click', () => PedidosCliente.confirmarPagamento(b.dataset.confirm)));
    container.querySelectorAll('[data-recusar]').forEach(b => b.addEventListener('click', () => {
      if (confirm('Recusar e remover este pedido?')) PedidosCliente.recusar(b.dataset.recusar);
    }));
  }

  function updateBadge() {
    const count = PedidosCliente.pendentes().length;
    ['histBadge', 'histBadge2'].forEach(id => {
      const badge = document.getElementById(id);
      if (!badge) return;
      if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; }
      else { badge.style.display = 'none'; }
    });
  }

  let expandedIds = new Set();

  function renderList() {
    renderPendentes();
    const de = document.getElementById('hist-de').value;
    const ate = document.getElementById('hist-ate').value;
    const pagamento = document.getElementById('hist-pagamento').value;
    let vendas = DB.getVendas();

    if (de) vendas = vendas.filter(v => new Date(v.dataHora) >= new Date(de + 'T00:00:00'));
    if (ate) vendas = vendas.filter(v => new Date(v.dataHora) <= new Date(ate + 'T23:59:59'));
    if (pagamento) vendas = vendas.filter(v => v.formaPagamento === pagamento);

    const container = document.getElementById('hist-list');
    container.innerHTML = '';
    if (!vendas.length) { container.innerHTML = '<div class="empty-note">Nenhuma venda encontrada para esse filtro.</div>'; return; }
    vendas.forEach(v => {
      const isOpen = expandedIds.has(v.id);
      const itensResumo = v.itens.map(i => `${i.qtd}x ${i.nome}`).join(', ');
      const row = document.createElement('div');
      row.className = 'hist-row';
      row.innerHTML = `
        <div class="hist-row-head" data-toggle="${v.id}">
          <div>
            <div class="li-main">${v.numeroPedido ? '#' + v.numeroPedido + ' · ' : ''}${fmtDateTime(v.dataHora)}</div>
            <div class="li-sub">${v.formaPagamento} ${v.atendente ? '· ' + v.atendente : ''} ${v.origem === 'qrcode' ? '· 📱 QR' : ''} · ${v.itens.length} item(ns)</div>
          </div>
          <div class="hist-row-right">
            <b>${brl(valorLoja(v))}</b>
            <span class="hist-chevron">${isOpen ? '▲' : '▼'}</span>
          </div>
        </div>
        ${isOpen ? `
        <div class="hist-row-detail">
          <div class="li-sub">${itensResumo}</div>
          ${v.taxaEntrega ? `<div class="li-sub">🛵 Taxa de entrega: <b style="color:var(--yellow);">${brl(v.taxaEntrega)}</b></div>` : ''}
          <div class="hist-row-detail-actions">
            <span class="li-sub">Lucro: <b style="color:var(--green);">${brl(v.lucro)}</b></span>
            <div>
              <button class="li-icon-btn" data-print="${v.id}">🖨️</button>
              <button class="li-icon-btn danger" data-delete="${v.id}">🗑️</button>
            </div>
          </div>
        </div>` : ''}`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-toggle]').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.toggle;
      if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
      renderList();
    }));
    container.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const venda = DB.getVendas().find(v => v.id === b.dataset.print);
      if (venda) PDV.printReceipt(venda);
    }));
    container.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      excluirVenda(b.dataset.delete);
    }));
  }

  function excluirVenda(id) {
    const venda = DB.getVendas().find(v => v.id === id);
    if (!venda) return;
    const ok = confirm(`Excluir a venda de ${brl(venda.total)} (${fmtDateTime(venda.dataHora)})?\n\nOs itens vendidos serão devolvidos automaticamente ao estoque.`);
    if (!ok) return;

    const restauros = [];
    venda.itens.forEach(item => {
      (item.composicao || []).forEach(c => {
        if (c.estoqueId) {
          const r = DB.adjustEstoqueQtd(c.estoqueId, +(c.porcaoQtd * item.qtd));
          if (r.ok) restauros.push(`${r.nome} ${r.antes}→${r.depois}${r.unidade}`);
        }
      });
    });
    DB.deleteVenda(id);

    const resumo = restauros.length ? ' 📦 ' + restauros.slice(0, 3).join(' · ') + (restauros.length > 3 ? '...' : '') : '';
    toast('Venda excluída, estoque restaurado ✅' + resumo);
  }

  function init() {
    document.getElementById('hist-filtrar').addEventListener('click', renderList);
  }

  return { init, render: renderList, updateBadge };
})();

/* ==================== MÓDULO: COMANDA (TELA DA COZINHA — PIN 000000) ==================== */
const Comanda = (() => {
  let knownIds = new Set();
  let initialized = false;

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(1180, ctx.currentTime + 0.13);
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start();
      o.stop(ctx.currentTime + 0.5);
    } catch (e) { /* áudio indisponível, ignora silenciosamente */ }
  }

  function render() {
    const container = document.getElementById('comanda-list');
    if (!container) return;
    container.innerHTML = '';

    const vendasAtivas = DB.getVendas().filter(v => !v.prontoCozinha);
    const pedidosAtivos = PedidosCliente.cache.filter(p => !p.prontoCozinha);

    const todos = [
      ...vendasAtivas.map(v => ({ tipo: 'venda', id: v.id, itens: v.itens, hora: v.dataHora, pago: v.pago !== false, nome: v.nomeCliente || null, numero: v.numeroPedido })),
      ...pedidosAtivos.map(p => ({ tipo: 'pedido', id: p.id, itens: p.itens, hora: p.criadoEm, pago: false, nome: p.nome, numero: p.numeroPedido }))
    ].sort((a, b) => new Date(a.hora) - new Date(b.hora));

    const currentIds = new Set(todos.map(t => t.tipo + ':' + t.id));
    if (initialized) {
      const novos = [...currentIds].filter(id => !knownIds.has(id));
      if (novos.length) playNotificationSound();
    }
    knownIds = currentIds;
    initialized = true;

    if (!todos.length) { container.innerHTML = '<div class="empty-note">Nenhum pedido em preparo no momento.</div>'; return; }

    todos.forEach(pedido => {
      const itensHtml = pedido.itens.map(i => `
        <div class="item-row">${i.qtd}x ${i.nome}${i.obs ? `<div class="item-obs">"${i.obs}"</div>` : ''}</div>`).join('');
      const card = document.createElement('div');
      card.className = 'comanda-card';
      card.innerHTML = `
        <div class="header-row">
          <span class="cliente-nome">${pedido.numero ? '#' + pedido.numero + ' · ' : ''}${pedido.nome ? '👤 ' + pedido.nome : 'Pedido no balcão'}</span>
          <span class="pago-badge ${pedido.pago ? 'sim' : 'nao'}">${pedido.pago ? 'Pago ✅' : 'Aguardando pagamento ⏳'}</span>
        </div>
        <div class="hora">${fmtDateTime(pedido.hora)}</div>
        ${itensHtml}
        <button class="btn-pronto" data-pronto="${pedido.tipo}:${pedido.id}">✅ Pronto</button>`;
      container.appendChild(card);
    });

    container.querySelectorAll('[data-pronto]').forEach(b => b.addEventListener('click', () => {
      const [tipo, id] = b.dataset.pronto.split(':');
      if (tipo === 'venda') DB.updateVenda(id, { prontoCozinha: true });
      else fdb.collection('pedidosCliente').doc(id).update({ prontoCozinha: true }).catch(() => {});
    }));
  }

  return { render };
})();

/* ==================== MÓDULO: PAINEL DE ENTREGA (MOTOBOY) ==================== */
const Entrega = (() => {
  function minhaRota() {
    const user = Auth.getCurrentUser();
    if (!user) return [];
    const vendas = DB.getVendas()
      .filter(v => v.entregadorId === user.id && v.statusEntrega && v.statusEntrega !== 'entregue')
      .map(v => ({ ...v, _origem: 'venda', _pago: true }));
    const pendentes = PedidosCliente.cache
      .filter(p => p.entregadorId === user.id)
      .map(p => ({ ...p, _origem: 'pedido', _pago: false }));
    return [...vendas, ...pendentes];
  }

  function adicionarPedido() {
    const input = document.getElementById('entrega-numero-input');
    const numero = parseInt(input.value.trim());
    if (!numero) { toast('Digite um número de pedido válido.'); return; }
    const user = Auth.getCurrentUser();

    const venda = DB.getVendas().find(v => v.numeroPedido === numero);
    if (venda) {
      if (venda.tipoEntrega !== 'entrega') { toast(`Pedido #${numero} não é uma entrega.`); return; }
      if (venda.entregadorId && venda.entregadorId !== user.id) { toast(`Pedido #${numero} já está com outro entregador.`); return; }
      DB.updateVenda(venda.id, { entregadorId: user.id, statusEntrega: 'em_rota' });
      input.value = '';
      document.getElementById('entrega-add-form').style.display = 'none';
      toast(`Pedido #${numero} adicionado à sua rota ✅`);
      return;
    }

    // Ainda não confirmado pelo Dono — pode ser puxado do mesmo jeito, fica marcado em amarelo até confirmar
    const pendente = PedidosCliente.cache.find(p => p.numeroPedido === numero);
    if (pendente) {
      if (pendente.tipoEntrega !== 'entrega') { toast(`Pedido #${numero} não é uma entrega.`); return; }
      if (pendente.entregadorId && pendente.entregadorId !== user.id) { toast(`Pedido #${numero} já está com outro entregador.`); return; }
      fdb.collection('pedidosCliente').doc(pendente.id).update({ entregadorId: user.id, statusEntrega: 'em_rota' });
      input.value = '';
      document.getElementById('entrega-add-form').style.display = 'none';
      toast(`Pedido #${numero} adicionado à sua rota ✅ (aguardando confirmação de pagamento)`);
      return;
    }

    toast(`Pedido #${numero} não encontrado.`);
  }

  function marcarEntregue(id, origem) {
    if (origem === 'pedido') {
      fdb.collection('pedidosCliente').doc(id).update({ statusEntrega: 'entregue', entregueEm: new Date().toISOString() });
    } else {
      DB.updateVenda(id, { statusEntrega: 'entregue', entregueEm: new Date().toISOString() });
    }
    toast('Pedido marcado como entregue ✅');
  }

  function minhasTaxasHoje() {
    const user = Auth.getCurrentUser();
    if (!user) return [];
    const hojeStr = new Date().toDateString();
    return DB.getVendas().filter(v =>
      v.entregadorId === user.id && v.statusEntrega === 'entregue' && v.entregueEm &&
      new Date(v.entregueEm).toDateString() === hojeStr
    ).sort((a, b) => new Date(a.entregueEm) - new Date(b.entregueEm));
  }

  function renderMoneyPanel() {
    const entregas = minhasTaxasHoje();
    const total = entregas.reduce((s, v) => s + (v.taxaEntrega || 0), 0);
    document.getElementById('entrega-money-total').textContent = brl(total) + ' hoje';
    const list = document.getElementById('entrega-money-list');
    list.innerHTML = '';
    if (!entregas.length) { list.innerHTML = '<div class="empty-note">Nenhuma entrega concluída hoje ainda.</div>'; return; }
    entregas.forEach(v => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `<span>Pedido #${v.numeroPedido || '—'}</span><span>${brl(v.taxaEntrega || 0)}</span>`;
      list.appendChild(row);
    });
  }

  function render() {
    const user = Auth.getCurrentUser();
    const nomeEl = document.getElementById('entrega-nome-entregador');
    if (nomeEl) nomeEl.textContent = user ? `Entregador: ${user.nome}` : '';

    const container = document.getElementById('entrega-rota-list');
    if (!container) return;
    const rota = minhaRota();
    container.innerHTML = '';
    if (!rota.length) { container.innerHTML = '<div class="empty-note">Nenhum pedido na rota ainda.<br>Toque no + e digite o número do pedido.</div>'; return; }
    rota.forEach(v => {
      const mapsUrl = v.localizacao ? `https://www.google.com/maps/dir/?api=1&destination=${v.localizacao.lat},${v.localizacao.lng}` : null;
      const waUrl = v.telefoneCliente ? montarLinkWhatsApp(v.telefoneCliente) : null;
      const itensResumo = v.itens.map(i => `${i.qtd}x ${i.nome}`).join(', ');
      const card = document.createElement('div');
      card.className = 'route-card';
      card.innerHTML = `
        <div class="route-head">
          <span class="route-num ${v._pago ? 'pago' : 'pendente'}">Pedido #${v.numeroPedido}</span>
          ${!v._pago ? '<span class="route-pendente-badge">⏳ aguardando pagamento</span>' : ''}
        </div>
        <div class="route-nome">👤 ${v.nomeCliente || 'Cliente'}</div>
        <div class="route-end">📍 ${v.endereco || 'Endereço não informado'}${v.distanciaKm ? ` · ${v.distanciaKm.toFixed(1)}km` : ''}</div>
        <div class="route-itens">${itensResumo}</div>
        ${v.formaPagamento === 'Dinheiro' ? `<div class="route-troco">💰 ${v.precisaTroco ? `Troco para ${brl(v.trocoPara)}` : 'Não precisa de troco'}</div>` : ''}
        <div class="route-actions">
          ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" class="btn-maps">🗺️ Google Maps</a>` : ''}
          ${waUrl ? `<a href="${waUrl}" target="_blank" class="btn-whats">💬 WhatsApp</a>` : ''}
        </div>
        <button class="btn-entregue" data-entregue="${v.id}" data-origem="${v._origem}">✅ Entregue</button>`;
      container.appendChild(card);
    });
    container.querySelectorAll('[data-entregue]').forEach(b => b.addEventListener('click', () => marcarEntregue(b.dataset.entregue, b.dataset.origem)));

    const moneyPanel = document.getElementById('entrega-money-panel');
    if (moneyPanel && moneyPanel.style.display === 'block') renderMoneyPanel();
  }

  function init() {
    document.getElementById('entrega-add-btn').addEventListener('click', () => {
      const form = document.getElementById('entrega-add-form');
      document.getElementById('entrega-money-panel').style.display = 'none';
      form.style.display = (form.style.display === 'none' || !form.style.display) ? 'block' : 'none';
    });
    document.getElementById('entrega-money-btn').addEventListener('click', () => {
      const panel = document.getElementById('entrega-money-panel');
      document.getElementById('entrega-add-form').style.display = 'none';
      const showing = (panel.style.display === 'none' || !panel.style.display);
      panel.style.display = showing ? 'block' : 'none';
      if (showing) renderMoneyPanel();
    });
    document.getElementById('entrega-add-confirm').addEventListener('click', adicionarPedido);
  }

  return { render, init };
})();

/* ==================== MÓDULO 7: CONFIGURAÇÕES (backup + usuários) ==================== */
const Config = (() => {
  function exportBackup() {
    const data = DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-disk-dourado-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup exportado ⬇️');
  }

  async function importBackup(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('Isso vai adicionar os dados do backup ao banco atual (sem apagar o que já existe). Continuar?')) return;
      await DB.importAll(data);
      toast('Backup restaurado ✅');
    } catch (e) {
      toast('Arquivo inválido.');
    }
  }

  function savePix() {
    const chave = document.getElementById('cfg-pix-key').value.trim();
    ConfigGeral.save({ chavePix: chave });
    toast('Chave Pix salva ✅');
  }

  function saveTelefoneLoja() {
    const tel = document.getElementById('cfg-telefone-loja').value.trim();
    ConfigGeral.save({ telefoneLoja: tel });
    toast('Telefone da loja salvo ✅');
  }

  /* ---------- Fotos dos produtos (compactadas, salvas como base64 no Firestore) ---------- */
  function listaFotoAlvos() {
    return ProdutosAvulsos.cache.map(a => ({ id: a.id, nome: a.nome, foto: a.foto, origem: 'produtosAvulsos' }));
  }

  function renderFotoSelect() {
    const sel = document.getElementById('cfg-foto-produto');
    const alvos = listaFotoAlvos();
    sel.innerHTML = alvos.map(a => `<option value="${a.origem}:${a.id}">${a.nome}${a.foto ? ' 📷' : ''}</option>`).join('')
      || '<option value="">Nenhum produto cadastrado ainda</option>';
  }

  function renderFotoList() {
    const container = document.getElementById('cfg-foto-list');
    const alvos = listaFotoAlvos().filter(a => a.foto);
    container.innerHTML = '';
    if (!alvos.length) { container.innerHTML = '<div class="empty-note">Nenhuma foto enviada ainda.</div>'; return; }
    alvos.forEach(a => {
      const row = document.createElement('div');
      row.className = 'foto-row';
      row.innerHTML = `<img class="foto-thumb" src="${a.foto}"><span class="nome">${a.nome}</span>
        <button class="li-icon-btn danger" data-remove-foto="${a.origem}:${a.id}">🗑️</button>`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-remove-foto]').forEach(b => b.addEventListener('click', () => {
      const [origem, id] = b.dataset.removeFoto.split(':');
      salvarFoto(origem, id, null);
    }));
  }

  function salvarFoto(origem, id, base64) {
    if (origem === 'produtosAvulsos') ProdutosAvulsos.updateFoto(id, base64);
    renderProdutos();
  }

  function comprimirImagem(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 720;
          let { width, height } = img;
          if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
          else if (height > MAX) { width *= MAX / height; height = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadFoto(file) {
    const alvo = document.getElementById('cfg-foto-produto').value;
    if (!alvo) { toast('Escolha um produto primeiro.'); return; }
    const [origem, id] = alvo.split(':');
    try {
      const base64 = await comprimirImagem(file);
      if (base64.length > 900000) { toast('Imagem ainda muito grande, tente outra foto.'); return; }
      salvarFoto(origem, id, base64);
      toast('Foto salva ✅');
    } catch (e) {
      toast('Não foi possível processar essa imagem.');
    }
  }

  function renderAvulsosList() {
    const container = document.getElementById('cfg-avulsos-list');
    const avulsos = ProdutosAvulsos.cache;
    container.innerHTML = '';
    if (!avulsos.length) { container.innerHTML = '<div class="empty-note">Nenhum produto avulso cadastrado ainda.</div>'; return; }
    avulsos.forEach(a => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `
        <div>
          <div class="li-main">${a.nome}</div>
          <div class="li-sub">${brl(a.preco)} · ${a.categoria || 'Sem categoria'}</div>
        </div>
        <div class="li-actions">
          <button class="li-icon-btn" data-edit-avulso="${a.id}">✏️</button>
          <button class="li-icon-btn danger" data-del-avulso="${a.id}">🗑️</button>
        </div>`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-edit-avulso]').forEach(b => b.addEventListener('click', () => editAvulso(b.dataset.editAvulso)));
    container.querySelectorAll('[data-del-avulso]').forEach(b => b.addEventListener('click', () => {
      if (confirm('Excluir este produto avulso?')) ProdutosAvulsos.remove(b.dataset.delAvulso);
    }));
  }

  function editAvulso(id) {
    const a = ProdutosAvulsos.cache.find(x => x.id === id);
    if (!a) return;
    const nome = prompt('Nome do produto:', a.nome);
    if (nome === null) return;
    const preco = prompt('Preço de venda (R$):', a.preco);
    if (preco === null) return;
    const descricao = prompt('Descrição (aparece no cardápio do cliente):', a.descricao || '');
    if (descricao === null) return;
    const cats = Categorias.list();
    const categoria = cats.length
      ? (prompt(`Categoria (${cats.join(', ')}):`, a.categoria || cats[0]) ?? a.categoria)
      : a.categoria;
    ProdutosAvulsos.update(id, {
      nome: nome.trim() || a.nome,
      preco: parseFloat(preco) || a.preco,
      descricao: descricao.trim(),
      categoria
    });
    toast('Produto atualizado ✅');
  }

  function renderProdutos() {
    renderFotoSelect();
    renderFotoList();
    renderAvulsosList();
  }

  let lojaMap = null, lojaMarker = null;

  function initLojaMap() {
    const loja = ConfigGeral.cache.lojaLocalizacao;
    const centro = loja ? [loja.lat, loja.lng] : [-23.5505, -46.6333];
    if (!lojaMap) {
      lojaMap = L.map('loja-mapa').setView(centro, loja ? 15 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(lojaMap);
      lojaMap.on('click', (e) => salvarLojaLocalizacao(e.latlng.lat, e.latlng.lng));
    } else {
      lojaMap.setView(centro, loja ? 15 : 12);
    }
    if (loja) {
      if (lojaMarker) lojaMap.removeLayer(lojaMarker);
      lojaMarker = L.marker(centro).addTo(lojaMap);
    }
    setTimeout(() => lojaMap.invalidateSize(), 200);
  }

  function salvarLojaLocalizacao(lat, lng) {
    ConfigGeral.save({ lojaLocalizacao: { lat, lng } });
    document.getElementById('loja-loc-status').textContent = `📍 Localização salva (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    toast('Localização da loja salva ✅');
    initLojaMap();
  }

  function usarGpsLoja() {
    if (!navigator.geolocation) { toast('Seu navegador não suporta localização.'); return; }
    toast('Buscando sua localização...');
    navigator.geolocation.getCurrentPosition(
      pos => salvarLojaLocalizacao(pos.coords.latitude, pos.coords.longitude),
      () => toast('Não foi possível obter sua localização.'),
      { timeout: 8000 }
    );
  }

  function saveTaxaMinima() {
    const valor = parseFloat(document.getElementById('taxa-minima').value) || 0;
    ConfigGeral.save({ taxaMinima: valor });
    toast('Taxa mínima salva ✅');
  }

  function renderTaxas() {
    const container = document.getElementById('taxas-list');
    const faixas = (ConfigGeral.cache.faixasEntrega || []).slice().sort((a, b) => a.ateKm - b.ateKm);
    container.innerHTML = '';
    if (!faixas.length) { container.innerHTML = '<div class="empty-note">Nenhuma faixa cadastrada — a entrega ficará sem taxa até você adicionar.</div>'; return; }
    faixas.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `<span>Até ${f.ateKm}km</span><span>${brl(f.preco)} <button class="li-icon-btn danger" data-rm-taxa="${idx}" style="margin-left:8px;">🗑️</button></span>`;
      container.appendChild(row);
    });
    container.querySelectorAll('[data-rm-taxa]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.dataset.rmTaxa);
      const novas = faixas.slice(); novas.splice(idx, 1);
      ConfigGeral.save({ faixasEntrega: novas });
      renderTaxas();
      toast('Faixa removida.');
    }));
  }

  function addTaxa() {
    const ateKm = parseFloat(document.getElementById('taxa-ate-km').value);
    const preco = parseFloat(document.getElementById('taxa-preco').value);
    if (isNaN(ateKm) || ateKm <= 0 || isNaN(preco) || preco < 0) { toast('Preencha os km e o preço.'); return; }
    const faixas = (ConfigGeral.cache.faixasEntrega || []).slice();
    faixas.push({ ateKm, preco });
    ConfigGeral.save({ faixasEntrega: faixas });
    document.getElementById('taxa-ate-km').value = '';
    document.getElementById('taxa-preco').value = '';
    renderTaxas();
    toast('Faixa de entrega adicionada ✅');
  }

  function renderLoja() {
    document.getElementById('cfg-pix-key').value = ConfigGeral.cache.chavePix || '';
    document.getElementById('cfg-telefone-loja').value = ConfigGeral.cache.telefoneLoja || '';
    document.getElementById('taxa-minima').value = ConfigGeral.cache.taxaMinima || '';
    const link = location.origin + location.pathname.replace(/index\.html$/, '') + 'cliente.html';
    document.getElementById('cfg-cliente-link').textContent = link;
    const qrEl = document.getElementById('cfg-qrcode');
    if (qrEl && typeof QRCode !== 'undefined') {
      qrEl.innerHTML = '';
      new QRCode(qrEl, { text: link, width: 180, height: 180, colorDark: '#2b1150', colorLight: '#ffffff' });
    }
    if (ConfigGeral.cache.lojaLocalizacao) {
      const l = ConfigGeral.cache.lojaLocalizacao;
      document.getElementById('loja-loc-status').textContent = `📍 Localização salva (${l.lat.toFixed(5)}, ${l.lng.toFixed(5)})`;
    } else {
      document.getElementById('loja-loc-status').innerHTML = '⚠️ <b style="color:var(--danger);">Localização ainda não definida — os pedidos de entrega vão travar até você marcar.</b>';
    }
    initLojaMap();
    renderTaxas();
    const taxaZero = document.getElementById('cfg-taxa-zero');
    if (taxaZero) taxaZero.checked = !!ConfigGeral.cache.taxaZeroAtiva;
  }

  function init() {
    document.getElementById('cfg-export').addEventListener('click', exportBackup);
    document.getElementById('cfg-import').addEventListener('click', () => document.getElementById('cfg-import-file').click());
    document.getElementById('cfg-import-file').addEventListener('change', e => {
      if (e.target.files[0]) importBackup(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('cfg-user-add').addEventListener('click', () => {
      const nome = document.getElementById('cfg-user-nome').value.trim();
      const role = document.getElementById('cfg-user-role').value;
      const pin = document.getElementById('cfg-user-pin').value.trim();
      Users.add(nome, pin, role);
      document.getElementById('cfg-user-nome').value = '';
      document.getElementById('cfg-user-pin').value = '';
    });
    document.getElementById('cfg-pix-save').addEventListener('click', savePix);
    document.getElementById('cfg-telefone-loja-save').addEventListener('click', saveTelefoneLoja);
    document.getElementById('cfg-foto-upload').addEventListener('click', () => document.getElementById('cfg-foto-file').click());
    document.getElementById('cfg-foto-file').addEventListener('change', e => {
      if (e.target.files[0]) uploadFoto(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('cfg-copy-link').addEventListener('click', () => {
      const link = document.getElementById('cfg-cliente-link').textContent;
      navigator.clipboard.writeText(link).then(() => toast('Link copiado ✅')).catch(() => toast('Não foi possível copiar.'));
    });
    document.getElementById('loja-loc-gps').addEventListener('click', usarGpsLoja);
    document.getElementById('taxa-add').addEventListener('click', addTaxa);
    document.getElementById('taxa-minima-save').addEventListener('click', saveTaxaMinima);
    document.getElementById('cfg-taxa-zero').addEventListener('change', e => {
      ConfigGeral.save({ taxaZeroAtiva: e.target.checked });
      toast(e.target.checked ? 'Taxa zero ativada para o cliente ✅' : 'Taxa zero desativada.');
    });
  }

  return { init, renderProdutos, renderLoja };
})();

/* ==================== HELPERS: MESES & GRÁFICO CANVAS ==================== */
function getLastMonths(n = 4) {
  const meses = [];
  const now = new Date();
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.unshift({ label: nomes[d.getMonth()], date: d });
  }
  return meses.reverse().slice(0, n).reverse();
}
function sameMonth(iso, date) {
  const d = new Date(iso);
  return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
}

function drawBarChart(canvas, labels, series) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.parentElement.clientWidth - 36;
  const cssHeight = 180;
  canvas.width = cssWidth * dpr; canvas.height = cssHeight * dpr;
  canvas.style.width = cssWidth + 'px'; canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const allVals = series.flatMap(s => s.data);
  const max = Math.max(1, ...allVals) * 1.15;
  const padding = { top: 10, bottom: 24, left: 6, right: 6 };
  const chartH = cssHeight - padding.top - padding.bottom;
  const groupW = (cssWidth - padding.left - padding.right) / Math.max(1, labels.length);
  const barW = Math.min(18, groupW / (series.length + 1.5));

  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  for (let g = 0; g <= 3; g++) {
    const y = padding.top + chartH - (g / 3) * chartH;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(cssWidth - padding.right, y); ctx.stroke();
  }

  labels.forEach((label, i) => {
    const groupX = padding.left + i * groupW + groupW / 2;
    series.forEach((s, si) => {
      const val = s.data[i] || 0;
      const h = (val / max) * chartH;
      const x = groupX + (si - series.length / 2) * (barW + 4);
      const y = padding.top + chartH - h;
      ctx.fillStyle = s.color;
      roundRect(ctx, x, y, barW, h, 4);
    });
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, groupX, cssHeight - 6);
  });
}
function roundRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  r = Math.min(r, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

/* ==================== INICIALIZAÇÃO GERAL ==================== */
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
  Nav.init();
  Criacao.init();
  Categorias.init();
  PDV.init();
  Historico.init();
  Config.init();
  Entrega.init();

  Users.watch();
  ProdutosAvulsos.watch();
  ConfigGeral.watch();
  PedidosCliente.watch();

  DB.init();
  DB.onChange(() => {
    refreshCurrentScreen(currentActiveTab());
  });
  ConfigGeral.onChange(() => {
    if (currentActiveTab() === 'venda') PDV.render();
  });

  // status de sincronização na tela de login
  fdb.collection('estoque').limit(1).get()
    .then(() => { document.getElementById('syncStatus').textContent = '✅ Conectado à nuvem'; })
    .catch((err) => {
      const msg = err.code === 'permission-denied'
        ? '🚫 Sem permissão (publique as Regras do Firestore)'
        : '⚠️ Offline — dados salvos localmente';
      document.getElementById('syncStatus').textContent = msg;
    });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      // Verifica periodicamente se existe uma versão nova publicada
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => {
          if (novo.state === 'installed' && navigator.serviceWorker.controller) {
            toast('🔄 Nova versão disponível, atualizando...');
          }
        });
      });
      // Checagem ativa a cada 60s enquanto o app estiver aberto
      setInterval(() => reg.update().catch(() => {}), 60000);
    }).catch(() => {});

    // Quando o novo Service Worker assume o controle, recarrega a página sozinho
    let jaRecarregou = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (jaRecarregou) return;
      jaRecarregou = true;
      window.location.reload();
    });
  }
});
