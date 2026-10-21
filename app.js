(function () {
  'use strict';

  var CFG = window.DERS_SISTEMA || {};
  var DEMO = /[?&]demo\b/.test(location.search) || !!window.DERS_FORCAR_DEMO;
  var FUSO = CFG.fuso || 'America/Sao_Paulo';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ---------- Textos de apoio ---------- */
  var STATUS = {
    novo: 'Novo', remarcar: 'Remarcar horário', aguardando_cliente: 'Aguardando cliente', reuniao_ok: 'Reunião confirmada',
    em_criacao: 'Em criação', para_revisar: 'Para revisar', ajuste: 'Ajuste pedido', enviado: 'Enviado',
    fechado: 'Fechou', perdido: 'Não fechou', recusado: 'Recusado'
  };
  var GRUPOS = {
    agir: ['novo', 'remarcar', 'reuniao_ok', 'para_revisar'],
    andamento: ['aguardando_cliente', 'em_criacao', 'ajuste', 'enviado'],
    encerrados: ['fechado', 'perdido', 'recusado']
  };
  var ROTULOS = {
    origem: 'Como conheceu', segmento: 'Ramo', cidade: 'Cidade', uf: 'UF', tempo: 'Tempo de empresa', equipe: 'Equipe',
    atendimento: 'Como atende', instagram: 'Instagram', siteAtual: 'Site atual', google: 'Google Maps', tipoSite: 'Tipo de site',
    objetivo: 'Objetivo', oQueVende: 'O que vende', publico: 'Clientes', cores: 'Cores', estilo: 'Estilo', referencias: 'Referências',
    dominio: 'Domínio', fotos: 'Fotos', funcionalidades: 'Precisa ter', prazo: 'Prazo', observacoes: 'Observações', email: 'E-mail'
  };

  /* ---------- Utilidades ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(d, op) { return new Intl.DateTimeFormat('pt-BR', Object.assign({ timeZone: FUSO }, op)).format(new Date(d)); }
  function diaHora(d) { return fmt(d, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') + ' às ' + fmt(d, { hour: '2-digit', minute: '2-digit' }); }
  function diaExtenso(d) { return fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }); }
  function hora(d) { return fmt(d, { hour: '2-digit', minute: '2-digit' }); }
  function chaveDia(d) { return fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
  function fone(n) { var d = String(n || '').replace(/\D/g, ''); return d.length <= 11 ? '55' + d : d; }
  function foneBonito(n) { var d = String(n || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7) : d.length === 10 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6) : n; }
  function linkSeguro(u) { return /^https:\/\//i.test(String(u || '')) ? u : ''; }
  function avisar(t) { var a = $('#aviso'); a.textContent = t; a.classList.add('mostrar'); clearTimeout(avisar.t); avisar.t = setTimeout(function () { a.classList.remove('mostrar'); }, 3200); }
  function abrirWhats(numero, texto) { window.open('https://wa.me/' + fone(numero) + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  function erroAmigavel(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e);
    var mapa = { horario_ocupado: 'Esse horário já está ocupado. Escolha outro.', sem_permissao: 'Sem permissão. Entre de novo.', sem_proposta: 'Não há proposta aberta para este pedido.' };
    for (var k in mapa) if (m.indexOf(k) >= 0) return mapa[k];
    if (/duplicate key|reunioes_um_aprovado/.test(m)) return 'Já existe uma reunião aprovada nesse horário.';
    if (/Invalid login/i.test(m)) return 'Usuário ou senha incorretos.';
    return 'Não deu certo agora. Confira a internet e tente de novo.';
  }

  /* ---------- Mensagens de WhatsApp (um toque) ---------- */
  var MSG = {
    analise: function (p) { return 'Oi, ' + primeiroNome(p.nome) + '! Aqui é a Thaynara, da DERS. Recebi o seu pedido do site da ' + p.empresa + ' e ele já está em análise. Em breve te mando o protótipo e o vídeo por aqui. 💜'; },
    confirmado: function (p, r) { return 'Oi, ' + primeiroNome(p.nome) + '! Nossa conversa sobre o site da ' + p.empresa + ' está confirmada para ' + diaExtenso(r.inicio) + ', às ' + hora(r.inicio) + '. Vou te ligar neste número. Até lá!'; },
    proposta: function (p, r) { return 'Oi, ' + primeiroNome(p.nome) + '! Aqui é a Thaynara, da DERS. O horário que você escolheu já estava reservado. Posso te ligar ' + diaExtenso(r.inicio) + ', às ' + hora(r.inicio) + '? Confirme ou peça outro horário por este link: ' + CFG.formsUrl + '/horario/?t=' + r.token; },
    recusa: function (p) { return 'Oi, ' + primeiroNome(p.nome) + '! Obrigada pelo interesse na DERS. Neste momento não vamos conseguir seguir com o pedido do site da ' + p.empresa + '. Se precisar de algo no futuro, é só chamar por aqui.'; },
    envio: function (p, r) {
      var t = 'Oi, ' + primeiroNome(p.nome) + '! O protótipo do site da ' + p.empresa + ' ficou pronto: ' + p.link_prototipo;
      if (p.link_video) t += '\n\nE este vídeo mostra como ele funciona: ' + p.link_video;
      t += r && r.status === 'aprovada' ? '\n\nNa nossa conversa de ' + diaExtenso(r.inicio) + ', às ' + hora(r.inicio) + ', te explico tudo e você me diz o que quer mudar.' : '\n\nMe conta o que achou!';
      return t;
    },
    materiais: function (p) { return 'Que bom ter você com a gente, ' + primeiroNome(p.nome) + '! Para montar o site final da ' + p.empresa + ', preciso dos seus materiais (fotos, textos, contatos). É só preencher aqui, leva poucos minutos: ' + CFG.formsUrl + '/materiais/'; }
  };

  /* ---------- Camada de dados ---------- */
  var api = DEMO ? window.DERS_DEMO_API : criarApiSupabase();

  function criarApiSupabase() {
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) return null;
    var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    function ok(r) { if (r.error) throw r.error; return r.data; }
    return {
      sessao: function () { return sb.auth.getSession().then(function (r) { return r.data.session; }); },
      entrar: function (usuario, senha) {
        var email = usuario.indexOf('@') > 0 ? usuario : usuario.trim().toLowerCase() + '@' + CFG.dominioLogin;
        return sb.auth.signInWithPassword({ email: email.toLowerCase(), password: senha }).then(ok);
      },
      sair: function () { return sb.auth.signOut(); },
      trocarSenha: function (s) { return sb.auth.updateUser({ password: s }).then(ok); },
      ehAdmin: function () { return sb.rpc('e_admin').then(ok); },
      pedidos: function () { return sb.from('pedidos').select('*, reunioes(*)').order('criado_em', { ascending: false }).limit(500).then(ok); },
      historico: function (id) { return sb.from('historico').select('*').eq('pedido_id', id).order('quando', { ascending: false }).then(ok); },
      atualizar: function (id, campos) { return sb.from('pedidos').update(campos).eq('id', id).then(ok); },
      registrar: function (id, evento, detalhe) { return sb.from('historico').insert({ pedido_id: id, evento: evento, detalhe: detalhe || null }).then(ok); },
      cancelarReunioes: function (id) { return sb.from('reunioes').update({ status: 'cancelada' }).eq('pedido_id', id).in('status', ['pendente', 'proposta']).then(ok); },
      aprovarReuniao: function (rid) { return sb.rpc('aprovar_reuniao', { p_reuniao: rid }).then(ok); },
      proporHorario: function (id, inicio) { return sb.rpc('propor_horario', { p_pedido: id, p_inicio: inicio }).then(ok); },
      confirmarProposta: function (id) { return sb.rpc('confirmar_proposta', { p_pedido: id }).then(ok); },
      slots: function () { return sb.rpc('agenda_slots').then(ok); },
      logoUrl: function (path) { return path ? sb.storage.from('logos').getPublicUrl(path).data.publicUrl : ''; },
      assinar: function (cb) {
        sb.channel('mudancas').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, cb)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reunioes' }, cb).subscribe();
      }
    };
  }

  /* ---------- Estado ---------- */
  var estado = { pedidos: [], filtro: 'agir', busca: '', aberto: null, slots: null };

  function reuniaoAtual(p) {
    var rs = (p.reunioes || []).filter(function (r) { return r.status !== 'cancelada'; });
    var ordem = { aprovada: 0, proposta: 1, pendente: 2, recusada: 3 };
    rs.sort(function (a, b) { return (ordem[a.status] - ordem[b.status]) || (new Date(b.criado_em) - new Date(a.criado_em)); });
    return rs[0] || null;
  }
  function conflitoDe(p, r) {
    if (!r || r.status !== 'pendente') return null;
    var t = new Date(r.inicio).getTime();
    for (var i = 0; i < estado.pedidos.length; i++) {
      var o = estado.pedidos[i]; if (o.id === p.id) continue;
      var achou = (o.reunioes || []).some(function (x) { return (x.status === 'aprovada' || x.status === 'proposta') && new Date(x.inicio).getTime() === t; });
      if (achou) return o;
    }
    return null;
  }
  function concorrentes(p, r) {
    if (!r || r.status !== 'pendente') return 0;
    var t = new Date(r.inicio).getTime();
    return estado.pedidos.filter(function (o) { return o.id !== p.id && (o.reunioes || []).some(function (x) { return x.status === 'pendente' && new Date(x.inicio).getTime() === t; }); }).length;
  }

  /* ---------- Entrada ---------- */
  function mostrarEntrada() {
    $('#app').hidden = true; $('#entrada').hidden = false;
    if (DEMO) { $('#demo-aviso').hidden = false; $('#entrada-lead').textContent = 'Veja como funciona o painel que organiza pedidos, reuniões e entregas.'; }
    if (!api) { $('#entrada-erro').textContent = 'O sistema ainda não foi ligado ao banco de dados.'; $('#entrar').disabled = true; }
    setTimeout(function () { $('#usuario').focus(); }, 300);
  }
  $('#ver-senha').addEventListener('click', function () { var s = $('#senha'); s.type = s.type === 'password' ? 'text' : 'password'; this.textContent = s.type === 'password' ? 'ver' : 'ocultar'; });
  $('#form-entrada').addEventListener('submit', function (e) {
    e.preventDefault();
    var b = $('#entrar'); b.disabled = true; b.textContent = 'Entrando...'; $('#entrada-erro').textContent = '';
    api.entrar($('#usuario').value, $('#senha').value)
      .then(function () { return api.ehAdmin(); })
      .then(function (adm) { if (!adm) { api.sair(); throw new Error('sem_permissao'); } $('#senha').value = ''; iniciarApp(); })
      .catch(function (err) { $('#entrada-erro').textContent = erroAmigavel(err); })
      .then(function () { b.disabled = false; b.textContent = 'Entrar'; });
  });

  /* ---------- App ---------- */
  var assinado = false;
  function iniciarApp() {
    $('#entrada').hidden = true; $('#app').hidden = false; $('#selo-demo').hidden = !DEMO;
    $('#lista').innerHTML = '<li class="carregando"><span></span></li>';
    carregar();
    if (!assinado && api.assinar) { assinado = true; api.assinar(function () { clearTimeout(iniciarApp.t); iniciarApp.t = setTimeout(carregar, 400); }); }
  }
  function carregar() {
    return api.pedidos().then(function (ps) {
      estado.pedidos = ps || [];
      desenharLista(); desenharAgenda();
      if (estado.aberto) { var p = acharPedido(estado.aberto); if (p) desenharDetalhe(p); }
    }).catch(function (e) { avisar(erroAmigavel(e)); });
  }
  function acharPedido(id) { for (var i = 0; i < estado.pedidos.length; i++) if (estado.pedidos[i].id === id) return estado.pedidos[i]; return null; }

  $$('.aba').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.aba').forEach(function (x) { x.classList.toggle('ativa', x === b); });
      $$('.vista').forEach(function (v) { v.classList.toggle('ativa', v.id === 'vista-' + b.dataset.aba); });
    });
  });
  $('#filtros').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    estado.filtro = c.dataset.filtro;
    $$('#filtros .chip').forEach(function (x) { x.classList.toggle('ativo', x === c); });
    desenharLista();
  });
  $('#busca').addEventListener('input', function () { estado.busca = this.value.trim().toLowerCase(); desenharLista(); });

  function desenharLista() {
    var agir = estado.pedidos.filter(function (p) { return GRUPOS.agir.indexOf(p.status) >= 0; }).length;
    var cont = $('#cont-agir'); cont.hidden = !agir; cont.textContent = agir;
    var lista = estado.pedidos.filter(function (p) {
      if (estado.filtro !== 'todos' && GRUPOS[estado.filtro].indexOf(p.status) < 0) return false;
      if (!estado.busca) return true;
      return [p.empresa, p.nome, p.codigo, p.whatsapp].join(' ').toLowerCase().indexOf(estado.busca) >= 0;
    });
    if (!lista.length) {
      $('#lista').innerHTML = '<li class="vazio"><b>' + (estado.filtro === 'agir' ? 'Tudo em dia' : 'Nada por aqui') + '</b>' +
        (estado.filtro === 'agir' ? 'Quando chegar um pedido novo pelo formulário, ele aparece aqui.' : 'Nenhum pedido nesta lista.') + '</li>';
      return;
    }
    $('#lista').innerHTML = lista.map(function (p, i) {
      var r = reuniaoAtual(p), conf = conflitoDe(p, r), tags = '';
      if (r) {
        var cls = r.status === 'aprovada' ? 'ok' : conf ? 'alerta' : r.status === 'recusada' ? 'alerta' : 'espera';
        var pre = r.status === 'aprovada' ? 'Reunião ' : r.status === 'proposta' ? 'Proposto ' : r.status === 'recusada' ? 'Cliente pediu outro horário · ' : 'Pediu ';
        tags += '<span class="etiqueta ' + cls + '">' + pre + esc(diaHora(r.inicio)) + '</span>';
        if (conf) tags += '<span class="etiqueta alerta">Conflito</span>';
      }
      if (p.tipo_site) tags += '<span class="etiqueta">' + esc(p.tipo_site) + '</span>';
      return '<li class="item st-' + p.status + '" data-id="' + p.id + '" style="animation-delay:' + Math.min(i * 40, 400) + 'ms" tabindex="0">' +
        '<div class="item-linha"><div><h3>' + esc(p.empresa) + '</h3><p>' + esc(p.nome) + ' · ' + esc(p.segmento || 'Ramo não informado') + '</p></div>' +
        '<span class="status">' + esc(STATUS[p.status] || p.status) + '</span></div>' +
        '<div class="quando">' + tags + '</div></li>';
    }).join('');
  }
  $('#lista').addEventListener('click', function (e) { var li = e.target.closest('.item'); if (li) abrir(li.dataset.id); });
  $('#lista').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var li = e.target.closest('.item'); if (li) abrir(li.dataset.id); } });

  /* ---------- Agenda ---------- */
  function desenharAgenda() {
    var agora = Date.now(), limite = agora + 14 * 864e5, itens = [];
    estado.pedidos.forEach(function (p) {
      (p.reunioes || []).forEach(function (r) {
        var t = new Date(r.inicio).getTime();
        if (t >= agora - 3600e3 && t <= limite && ['aprovada', 'pendente', 'proposta'].indexOf(r.status) >= 0) itens.push({ p: p, r: r, t: t });
      });
    });
    if (!itens.length) { $('#agenda').innerHTML = '<div class="vazio"><b>Agenda livre</b>Nenhuma reunião pedida para os próximos dias.</div>'; return; }
    itens.sort(function (a, b) { return a.t - b.t; });
    var aprovados = {}; itens.forEach(function (x) { if (x.r.status === 'aprovada') aprovados[x.t] = true; });
    var html = '', dia = '';
    itens.forEach(function (x) {
      var k = chaveDia(x.r.inicio);
      if (k !== dia) { if (dia) html += '</div>'; dia = k; html += '<div class="agenda-dia"><h3>' + esc(diaExtenso(x.r.inicio)) + '</h3>'; }
      var conf = x.r.status === 'pendente' && aprovados[x.t];
      var et = x.r.status === 'aprovada' ? '<span class="etiqueta ok">Confirmada</span>' : x.r.status === 'proposta' ? '<span class="etiqueta espera">Proposta</span>' : conf ? '<span class="etiqueta alerta">Conflito</span>' : '<span class="etiqueta espera">A aprovar</span>';
      html += '<div class="agenda-item' + (conf ? ' conflito' : '') + '" data-id="' + x.p.id + '"><time>' + hora(x.r.inicio) + '</time><div><b>' + esc(x.p.empresa) + '</b><br><small>' + esc(x.p.nome) + '</small></div>' + et + '</div>';
    });
    $('#agenda').innerHTML = html + '</div>';
  }
  $('#agenda').addEventListener('click', function (e) { var it = e.target.closest('.agenda-item'); if (it) abrir(it.dataset.id); });

  /* ---------- Detalhe ---------- */
  function abrir(id) {
    var p = acharPedido(id); if (!p) return;
    estado.aberto = id; estado.escolhendo = false; estado.slots = null;
    $('#detalhe').hidden = false; document.body.style.overflow = 'hidden';
    desenharDetalhe(p);
    $('.folha-caixa', $('#detalhe')).scrollTop = 0;
  }
  function fecharFolhas() { $$('.folha').forEach(function (f) { f.hidden = true; }); document.body.style.overflow = ''; estado.aberto = null; }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-fechar]')) fecharFolhas(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharFolhas(); });

  function passo(n, titulo, corpo, cls) { return '<section class="bloco ' + (cls || '') + '"><h4><span class="passo">' + n + '</span>' + titulo + '</h4>' + corpo + '</section>'; }

  function desenharDetalhe(p) {
    var r = reuniaoAtual(p), conf = conflitoDe(p, r), st = p.status;
    $('#det-empresa').textContent = p.empresa;
    $('#det-sub').textContent = (STATUS[st] || st) + ' · ' + p.codigo + ' · chegou ' + diaHora(p.criado_em);
    var logo = api.logoUrl(p.logo_path), h = '';

    // Contato
    h += '<section class="bloco"><div class="contato">' + (logo ? '<span class="logo-cliente" style="background-image:url(\'' + esc(logo) + '\')" role="img" aria-label="Logo"></span>' : '') +
      '<div><b>' + esc(p.nome) + '</b><span>' + esc(foneBonito(p.whatsapp)) + (p.email ? ' · ' + esc(p.email) : '') + '</span></div></div>' +
      '<div class="acoes" style="margin-top:14px">' +
      '<button class="btn secundario pequeno" data-acao="whats-analise">' + icWhats() + ' Avisar "em análise"</button>' +
      '<a class="btn fantasma pequeno" href="https://wa.me/' + fone(p.whatsapp) + '" target="_blank" rel="noopener">Abrir conversa</a></div></section>';

    // 1. Reunião
    var c1 = '', feito1 = r && r.status === 'aprovada';
    if (!r) {
      c1 = '<p>A pessoa não escolheu horário. Proponha um para ela.</p>' + blocoPropor(p);
    } else if (r.status === 'aprovada') {
      c1 = '<p class="destaque-hora">' + esc(diaExtenso(r.inicio)) + ', ' + hora(r.inicio) + '</p>' +
        '<div class="acoes"><button class="btn secundario pequeno" data-acao="whats-confirmado">' + icWhats() + ' Avisar o cliente</button>' +
        '<button class="btn fantasma pequeno" data-acao="propor">Mudar horário</button></div>' + (estado.escolhendo ? blocoPropor(p) : '');
    } else if (r.status === 'proposta') {
      c1 = '<p>Você propôs <b>' + esc(diaHora(r.inicio)) + '</b>. Falta o cliente aceitar pelo link.</p>' +
        '<div class="acoes"><button class="btn secundario pequeno" data-acao="whats-proposta">' + icWhats() + ' Reenviar proposta</button>' +
        '<button class="btn fantasma pequeno" data-acao="confirmar-proposta">Ele aceitou por mensagem</button>' +
        '<button class="btn fantasma pequeno" data-acao="propor">Propor outro</button></div>' + (estado.escolhendo ? blocoPropor(p) : '');
    } else if (r.status === 'recusada') {
      c1 = '<div class="alerta-caixa">O cliente pediu outro horário no lugar de ' + esc(diaHora(r.inicio)) + '.</div>' + blocoPropor(p);
    } else {
      var n = concorrentes(p, r);
      c1 = '<p>Pediu para conversar em</p><p class="destaque-hora">' + esc(diaExtenso(r.inicio)) + ', ' + hora(r.inicio) + '</p>' +
        (conf ? '<div class="alerta-caixa">Esse horário já está reservado para <b>' + esc(conf.empresa) + '</b>. Proponha outro horário.</div>' :
          n ? '<div class="info-caixa">Mais ' + n + (n > 1 ? ' pessoas pediram' : ' pessoa pediu') + ' este horário. Quem você aprovar primeiro fica com ele.</div>' : '') +
        '<div class="acoes"><button class="btn principal pequeno" data-acao="aprovar-reuniao"' + (conf ? ' disabled' : '') + '>Aprovar horário</button>' +
        '<button class="btn fantasma pequeno" data-acao="propor">Propor outro</button></div>' + (estado.escolhendo ? blocoPropor(p) : '');
    }
    if (['recusado', 'perdido', 'fechado'].indexOf(st) < 0) h += passo(feito1 ? '✓' : 1, 'Reunião', c1, feito1 ? 'feito' : (['novo', 'remarcar'].indexOf(st) >= 0 ? 'atual' : ''));

    // 2. Repositório e aprovação
    var feito2 = ['em_criacao', 'para_revisar', 'ajuste', 'enviado', 'fechado'].indexOf(st) >= 0, c2;
    if (feito2) {
      c2 = '<p>Repositório <b>' + esc(p.repositorio || '') + '</b>.' + (st === 'em_criacao' ? ' Estou criando o site e o vídeo. Quando terminar, ele aparece aqui para você revisar.' : '') + '</p>' +
        (st === 'em_criacao' ? '<div class="acoes"><button class="btn fantasma pequeno" data-acao="cancelar-producao">Cancelar a criação</button></div>' : '');
    } else {
      var sug = p.repositorio || slug(p.empresa);
      c2 = '<p>Crie o repositório vazio no GitHub, cole o nome aqui e aprove. Aí eu começo o protótipo e o vídeo.</p>' +
        '<label class="campo"><span>Nome do repositório</span><input id="repo" value="' + esc(sug) + '" autocapitalize="none" spellcheck="false" inputmode="url"></label>' +
        '<div class="acoes"><a class="btn fantasma pequeno" id="criar-repo" href="https://github.com/new?name=' + encodeURIComponent(sug) + '&owner=' + encodeURIComponent(CFG.github || '') + '&visibility=public" target="_blank" rel="noopener">Criar no GitHub</a>' +
        '<button class="btn principal pequeno" data-acao="aprovar-producao">Aprovar e criar site + vídeo</button></div>' +
        (r && r.status === 'aprovada' ? '' : '<p class="miudo">Dica: o ideal é aprovar depois de confirmar a reunião, mas você pode adiantar.</p>');
    }
    if (['recusado', 'perdido'].indexOf(st) < 0) h += passo(feito2 ? '✓' : 2, 'Repositório e aprovação', c2, feito2 ? 'feito' : (st === 'reuniao_ok' ? 'atual' : ''));

    // 3. Revisão
    if (['para_revisar', 'ajuste', 'enviado', 'fechado'].indexOf(st) >= 0) {
      var site = linkSeguro(p.link_prototipo), video = linkSeguro(p.link_video), c3 = '';
      if (st === 'ajuste') c3 += '<div class="info-caixa">Ajuste pedido: ' + esc(p.ajuste || '') + '<br>Estou refazendo. Volta para cá quando estiver pronto.</div>';
      c3 += site ? '<div class="acoes"><a class="btn secundario pequeno" href="' + esc(site) + '" target="_blank" rel="noopener">Abrir o site</a>' + (video ? '<a class="btn fantasma pequeno" href="' + esc(video) + '" target="_blank" rel="noopener">Baixar o vídeo</a>' : '') + '</div>' : '';
      if (video) c3 += '<video class="video-revisao" src="' + esc(video) + '" controls playsinline preload="metadata"></video>';
      if (p.notas) c3 += '<p class="miudo">Notas: ' + esc(p.notas) + '</p>';
      if (st === 'para_revisar') {
        c3 += '<label class="campo" style="margin-top:12px"><span>Quer mudar algo?</span><textarea id="ajuste" placeholder="Ex.: trocar a cor do botão, aumentar a logo, mudar a música do vídeo"></textarea></label>' +
          '<div class="acoes"><button class="btn principal pequeno" data-acao="enviar-cliente">' + icWhats() + ' Aprovar e enviar ao cliente</button>' +
          '<button class="btn fantasma pequeno" data-acao="pedir-ajuste">Pedir ajuste</button></div>';
      } else if (st === 'enviado' || st === 'fechado') {
        c3 += '<div class="acoes" style="margin-top:8px"><button class="btn fantasma pequeno" data-acao="whats-envio">' + icWhats() + ' Reenviar ao cliente</button></div>';
      }
      h += passo(st === 'enviado' || st === 'fechado' ? '✓' : 3, 'Revisão e envio', c3, st === 'para_revisar' ? 'atual' : (st === 'enviado' || st === 'fechado' ? 'feito' : ''));
    }

    // 4. Resultado
    if (st === 'enviado') {
      h += passo(4, 'Depois da reunião', '<p>Fechou o site? Se sim, eu já preparo a mensagem com o formulário de materiais.</p>' +
        '<div class="acoes"><button class="btn verde pequeno" data-acao="fechou">Fechou!</button><button class="btn fantasma pequeno" data-acao="perdeu">Não fechou</button></div>', 'atual');
    }
    if (st === 'fechado') h += '<section class="bloco"><h4>Cliente fechado 🎉</h4><div class="acoes"><button class="btn secundario pequeno" data-acao="whats-materiais">' + icWhats() + ' Mandar formulário de materiais</button></div></section>';
    if (st === 'recusado' || st === 'perdido') h += '<section class="bloco"><h4>' + (st === 'recusado' ? 'Pedido recusado' : 'Não fechou') + '</h4><div class="acoes"><button class="btn fantasma pequeno" data-acao="reabrir">Reabrir pedido</button></div></section>';

    // Respostas
    var resp = p.respostas || {}, linhas = '';
    Object.keys(ROTULOS).forEach(function (k) {
      var v = resp[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      linhas += '<dt>' + esc(ROTULOS[k]) + '</dt><dd>' + esc(Array.isArray(v) ? v.join(', ') : v) + '</dd>';
    });
    h += '<section class="bloco"><details class="respostas"' + (st === 'novo' ? ' open' : '') + '><summary>Respostas do formulário</summary><dl class="dl">' + (linhas || '<dt>—</dt><dd>Sem respostas detalhadas.</dd>') + '</dl></details></section>';

    // Notas internas
    h += '<section class="bloco"><h4>Anotações</h4><label class="campo" style="margin:8px 0 10px"><textarea id="notas-internas" placeholder="Só você vê isto">' + esc(resp._anotacoes || '') + '</textarea></label>' +
      '<button class="btn fantasma pequeno" data-acao="salvar-notas">Salvar anotações</button></section>';

    // Histórico
    h += '<section class="bloco"><h4>Histórico</h4><ul class="historico" id="historico"><li><span></span><span class="miudo">Carregando...</span></li></ul></section>';

    if (['recusado', 'perdido', 'fechado'].indexOf(st) < 0) h += '<button class="btn perigo largo" data-acao="recusar">Recusar pedido</button>';

    $('#det-corpo').innerHTML = h;
    api.historico(p.id).then(function (hs) {
      var ul = $('#historico'); if (!ul) return;
      ul.innerHTML = (hs || []).map(function (x) { return '<li><time>' + esc(fmt(x.quando, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</time><span>' + esc(x.evento) + (x.detalhe ? '<br><small class="miudo">' + esc(x.detalhe) + '</small>' : '') + '</span></li>'; }).join('') || '<li><span></span><span class="miudo">Nada ainda.</span></li>';
    });
    if (estado.escolhendo || (!r && st !== 'recusado') || (r && r.status === 'recusada')) carregarSlots(p);
  }

  function icWhats() { return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>'; }

  /* ---------- Escolher horário para propor ---------- */
  function blocoPropor(p) { return '<div id="propor-area" style="margin-top:12px"><div class="carregando"><span></span></div></div>'; }
  function carregarSlots(p) {
    var pronto = function (slots) {
      estado.slots = slots;
      var ocupados = {};
      estado.pedidos.forEach(function (o) { (o.reunioes || []).forEach(function (x) { if (x.status === 'aprovada' || x.status === 'proposta') ocupados[new Date(x.inicio).getTime()] = o.empresa; }); });
      var porDia = {}, ordem = [];
      slots.forEach(function (s) { var k = chaveDia(s); if (!porDia[k]) { porDia[k] = []; ordem.push(k); } porDia[k].push(s); });
      var area = $('#propor-area'); if (!area) return;
      if (!ordem.length) { area.innerHTML = '<p class="miudo">Nenhum horário disponível nos próximos dias.</p>'; return; }
      var diaSel = estado.diaSel && porDia[estado.diaSel] ? estado.diaSel : ordem[0];
      area.innerHTML = '<p class="miudo">Escolha o dia e a hora para propor:</p><div class="dias">' + ordem.map(function (k) {
        var d = porDia[k][0];
        return '<button type="button" class="dia' + (k === diaSel ? ' ativo' : '') + '" data-dia="' + k + '"><small>' + esc(fmt(d, { weekday: 'short' }).replace('.', '')) + '</small><b>' + fmt(d, { day: '2-digit' }) + '</b></button>';
      }).join('') + '</div><div class="horas">' + porDia[diaSel].map(function (s) {
        var t = new Date(s).getTime(), oc = ocupados[t];
        return '<button type="button" class="hora" data-slot="' + esc(s) + '"' + (oc ? ' disabled title="Ocupado: ' + esc(oc) + '"' : '') + '>' + hora(s) + '</button>';
      }).join('') + '</div><button class="btn principal largo" data-acao="enviar-proposta" disabled>' + icWhats() + ' Propor e mandar no WhatsApp</button>';
    };
    if (estado.slots) pronto(estado.slots); else api.slots().then(pronto).catch(function (e) { avisar(erroAmigavel(e)); });
  }
  $('#det-corpo').addEventListener('click', function (e) {
    var d = e.target.closest('.dia'); if (d) { estado.diaSel = d.dataset.dia; estado.slotSel = null; var p0 = acharPedido(estado.aberto); carregarSlots(p0); return; }
    var hb = e.target.closest('.hora'); if (hb && !hb.disabled) { estado.slotSel = hb.dataset.slot; $$('.hora').forEach(function (x) { x.classList.toggle('ativo', x === hb); }); $('[data-acao="enviar-proposta"]').disabled = false; return; }
    var b = e.target.closest('[data-acao]'); if (!b || b.disabled) return;
    var p = acharPedido(estado.aberto); if (!p) return;
    acao(b.dataset.acao, p, b);
  });
  $('#det-corpo').addEventListener('input', function (e) {
    if (e.target.id === 'repo') {
      var v = slug(e.target.value); var a = $('#criar-repo');
      if (a) a.href = 'https://github.com/new?name=' + encodeURIComponent(v) + '&owner=' + encodeURIComponent(CFG.github || '') + '&visibility=public';
    }
  });

  /* ---------- Ações ---------- */
  function trabalhando(b, sim) { if (!b) return; b.disabled = sim; if (sim) { b.dataset.t = b.innerHTML; b.textContent = 'Um momento...'; } else if (b.dataset.t) b.innerHTML = b.dataset.t; }
  function depois(promessa, b, msg) {
    trabalhando(b, true);
    return promessa.then(function (x) { if (msg) avisar(msg); return carregar().then(function () { return x; }); })
      .catch(function (e) { avisar(erroAmigavel(e)); trabalhando(b, false); throw e; });
  }

  function acao(nome, p, b) {
    var r = reuniaoAtual(p);
    switch (nome) {
      case 'whats-analise':
        abrirWhats(p.whatsapp, MSG.analise(p)); api.registrar(p.id, 'Mensagem "em análise" aberta no WhatsApp'); break;
      case 'whats-confirmado': abrirWhats(p.whatsapp, MSG.confirmado(p, r)); api.registrar(p.id, 'Confirmação da reunião aberta no WhatsApp'); break;
      case 'whats-proposta': abrirWhats(p.whatsapp, MSG.proposta(p, r)); break;
      case 'whats-envio': abrirWhats(p.whatsapp, MSG.envio(p, r)); break;
      case 'whats-materiais': abrirWhats(p.whatsapp, MSG.materiais(p)); api.registrar(p.id, 'Formulário de materiais enviado'); break;
      case 'propor': estado.escolhendo = true; estado.slotSel = null; desenharDetalhe(p); setTimeout(function () { var a = $('#propor-area'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); break;
      case 'aprovar-reuniao':
        depois(api.aprovarReuniao(r.id), b, 'Horário aprovado').then(function () {
          var p2 = acharPedido(p.id); var r2 = reuniaoAtual(p2);
          if (r2 && confirm('Horário aprovado. Avisar o cliente no WhatsApp agora?')) abrirWhats(p2.whatsapp, MSG.confirmado(p2, r2));
        }); break;
      case 'enviar-proposta':
        if (!estado.slotSel) return;
        depois(api.proporHorario(p.id, estado.slotSel), b, 'Proposta criada').then(function () {
          estado.escolhendo = false; estado.slots = null;
          var p2 = acharPedido(p.id), r2 = reuniaoAtual(p2);
          if (r2) abrirWhats(p2.whatsapp, MSG.proposta(p2, r2));
        }); break;
      case 'confirmar-proposta': depois(api.confirmarProposta(p.id), b, 'Reunião confirmada'); break;
      case 'aprovar-producao':
        var repo = slug($('#repo').value);
        if (!repo) { avisar('Coloque o nome do repositório.'); $('#repo').focus(); return; }
        if (!confirm('Você já criou o repositório "' + repo + '" no GitHub?')) return;
        depois(api.atualizar(p.id, { status: 'em_criacao', repositorio: repo }).then(function () { return api.registrar(p.id, 'Aprovado para criar site + vídeo', 'Repositório: ' + repo); }), b, 'Aprovado! Já vou criar.'); break;
      case 'cancelar-producao':
        if (!confirm('Cancelar a criação deste site?')) return;
        depois(api.atualizar(p.id, { status: r && r.status === 'aprovada' ? 'reuniao_ok' : 'novo' }).then(function () { return api.registrar(p.id, 'Criação cancelada'); }), b, 'Criação cancelada'); break;
      case 'pedir-ajuste':
        var aj = ($('#ajuste').value || '').trim();
        if (!aj) { avisar('Escreva o que quer mudar.'); $('#ajuste').focus(); return; }
        depois(api.atualizar(p.id, { status: 'ajuste', ajuste: aj }).then(function () { return api.registrar(p.id, 'Ajuste pedido', aj); }), b, 'Ajuste enviado para mim'); break;
      case 'enviar-cliente':
        abrirWhats(p.whatsapp, MSG.envio(p, r));
        depois(api.atualizar(p.id, { status: 'enviado' }).then(function () { return api.registrar(p.id, 'Protótipo e vídeo enviados ao cliente'); }), b, 'Marcado como enviado'); break;
      case 'fechou':
        depois(api.atualizar(p.id, { status: 'fechado' }).then(function () { return api.registrar(p.id, 'Cliente fechou o site'); }), b, 'Parabéns! 🎉').then(function () {
          if (confirm('Mandar agora o formulário de materiais no WhatsApp?')) { abrirWhats(p.whatsapp, MSG.materiais(p)); api.registrar(p.id, 'Formulário de materiais enviado'); }
        }); break;
      case 'perdeu': depois(api.atualizar(p.id, { status: 'perdido' }).then(function () { return api.registrar(p.id, 'Não fechou'); }), b, 'Anotado'); break;
      case 'reabrir': depois(api.atualizar(p.id, { status: 'novo' }).then(function () { return api.registrar(p.id, 'Pedido reaberto'); }), b, 'Pedido reaberto'); break;
      case 'recusar':
        if (!confirm('Recusar o pedido da ' + p.empresa + '? O horário dele fica livre de novo.')) return;
        depois(api.cancelarReunioes(p.id).then(function () { return api.atualizar(p.id, { status: 'recusado' }); }).then(function () { return api.registrar(p.id, 'Pedido recusado'); }), b, 'Pedido recusado').then(function () {
          if (confirm('Mandar uma mensagem educada de recusa no WhatsApp?')) abrirWhats(p.whatsapp, MSG.recusa(p));
        }); break;
      case 'salvar-notas':
        var resp = Object.assign({}, p.respostas || {}); resp._anotacoes = $('#notas-internas').value;
        depois(api.atualizar(p.id, { respostas: resp }), b, 'Anotações salvas'); break;
    }
  }

  /* ---------- Menu ---------- */
  $('#btn-menu').addEventListener('click', function () { $('#menu').hidden = false; });
  $('#sair').addEventListener('click', function () { api.sair().then(function () { fecharFolhas(); mostrarEntrada(); }); });
  $('#form-senha').addEventListener('submit', function (e) {
    e.preventDefault();
    var s = $('#nova-senha').value;
    if (s.length < 8) { $('#senha-msg').textContent = 'Use pelo menos 8 caracteres.'; return; }
    api.trocarSenha(s).then(function () { $('#senha-msg').textContent = 'Senha trocada.'; $('#nova-senha').value = ''; })
      .catch(function (err) { $('#senha-msg').textContent = erroAmigavel(err); });
  });

  /* ---------- Início ---------- */
  if (!api) { mostrarEntrada(); return; }
  api.sessao().then(function (s) {
    if (!s) return mostrarEntrada();
    return api.ehAdmin().then(function (adm) { if (adm) iniciarApp(); else { api.sair(); mostrarEntrada(); } });
  }).catch(mostrarEntrada);
})();
