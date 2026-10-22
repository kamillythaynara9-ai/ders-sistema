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
    var mapa = { horario_ocupado: 'Esse horário já está ocupado. Escolha outro.', sem_permissao: 'Sem permissão. Entre de novo.', sem_proposta: 'Não há proposta aberta para este pedido.', horario_bloqueado: 'Esse horário está marcado como indisponível na sua agenda.' };
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
      bloqueios: function () { return sb.from('bloqueios').select('*').gte('fim', new Date(Date.now() - 62 * 864e5).toISOString()).order('inicio').limit(2000).then(ok); },
      criarBloqueios: function (lista) { return sb.from('bloqueios').insert(lista).then(ok); },
      apagarBloqueio: function (id) { return sb.from('bloqueios').delete().eq('id', id).then(ok); },
      apagarSerie: function (serie, desde) { return sb.from('bloqueios').delete().eq('serie', serie).gte('inicio', desde).then(ok); },
      logoUrl: function (path) { return path ? sb.storage.from('logos').getPublicUrl(path).data.publicUrl : ''; },
      assinar: function (cb) {
        sb.channel('mudancas').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, cb)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reunioes' }, cb)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bloqueios' }, cb).subscribe();
      }
    };
  }

  /* ---------- Estado ---------- */
  var estado = { pedidos: [], bloqueios: [], filtro: 'agir', busca: '', aberto: null, slots: null };

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
    // Se a tabela de bloqueios ainda não existe no banco, o resto continua funcionando.
    var bl = api.bloqueios().then(function (x) { estado.semAgenda = false; return x || []; }, function () { estado.semAgenda = true; return []; });
    return Promise.all([api.pedidos(), bl]).then(function (res) {
      var ps = res[0]; estado.bloqueios = res[1];
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
        else if (r.status !== 'recusada' && bloqueioDa(r)) tags += '<span class="etiqueta alerta">Na sua indisponibilidade</span>';
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
  // São Paulo não tem horário de verão desde 2019: o fuso é sempre -03:00.
  var OFFSET = CFG.offset || '-03:00';
  // Expediente (0 = domingo): o mesmo de config "agenda" no banco.
  var SEMANA = CFG.semana || { 0: [10, 17], 1: [8, 22], 2: [8, 22], 3: [8, 22], 4: [8, 22], 5: [8, 22], 6: [10, 17] };
  function isoDia(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d)); }
  function somaDias(iso, n) { var q = iso.split('-'); return new Date(Date.UTC(+q[0], q[1] - 1, +q[2] + n)).toISOString().slice(0, 10); }
  function diaSemana(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
  function momento(iso, hm) { return new Date(iso + 'T' + (hm || '00:00') + ':00' + OFFSET); }
  function hh(h) { return (h < 10 ? '0' : '') + h + ':00'; }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function sobrepoe(a0, a1, b0, b1) { return a0 < b1 && a1 > b0; }
  function bloqueiosEntre(t0, t1) { return estado.bloqueios.filter(function (b) { return sobrepoe(+new Date(b.inicio), +new Date(b.fim), t0, t1); }); }
  function bloqueioDa(r) { var t = +new Date(r.inicio); return bloqueiosEntre(t, r.fim ? +new Date(r.fim) : t + 3600e3)[0] || null; }
  function reunioesAtivas() {
    var out = [];
    estado.pedidos.forEach(function (p) {
      (p.reunioes || []).forEach(function (r) {
        if (['aprovada', 'pendente', 'proposta'].indexOf(r.status) >= 0) { var t0 = +new Date(r.inicio); out.push({ p: p, r: r, t0: t0, t1: r.fim ? +new Date(r.fim) : t0 + 3600e3 }); }
      });
    });
    return out;
  }
  function periodo(b) {
    var a = new Date(b.inicio), z = new Date(b.fim);
    if (hora(a) === '00:00' && hora(z) === '00:00') {
      var ult = somaDias(isoDia(z), -1);
      return isoDia(a) === ult ? cap(diaExtenso(a)) + ', dia inteiro' : cap(diaExtenso(a)) + ' até ' + diaExtenso(momento(ult, '12:00')) + ', dias inteiros';
    }
    if (isoDia(a) === isoDia(z)) return cap(diaExtenso(a)) + ', das ' + hora(a) + ' às ' + hora(z);
    return cap(diaHora(a)) + ' até ' + diaHora(z);
  }
  // Dia "fechado" = todas as horas do expediente estão bloqueadas.
  function diaFechado(d) {
    var f = SEMANA[diaSemana(d)]; if (!f) return false;
    for (var h = f[0]; h < f[1]; h++) { var s = +momento(d, hh(h)); if (!bloqueiosEntre(s, s + 3600e3).length) return false; }
    return true;
  }

  function desenharAgenda() {
    var hoje = isoDia(Date.now());
    if (!estado.mes) { estado.mes = hoje.slice(0, 7); estado.diaAg = hoje; }
    $('#agenda-aviso').hidden = !estado.semAgenda;
    $('#novo-bloqueio').disabled = !!estado.semAgenda;
    desenharCalendario(hoje); desenharDia(); desenharProximas();
  }

  function desenharCalendario(hoje) {
    var m = estado.mes, primeiro = m + '-01', ini = somaDias(primeiro, -diaSemana(primeiro)), ativas = reunioesAtivas();
    var seta = function (d) { return '<svg viewBox="0 0 24 24" width="20" height="20"><path d="' + d + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'; };
    var h = '<div class="cal-cab"><button class="icone" type="button" data-mes="-1" aria-label="Mês anterior"' + (m <= hoje.slice(0, 7) ? ' disabled' : '') + '>' + seta('M15 5l-7 7 7 7') + '</button>' +
      '<h3>' + esc(fmt(momento(primeiro, '12:00'), { month: 'long', year: 'numeric' })) + '</h3>' +
      '<button class="icone" type="button" data-mes="1" aria-label="Próximo mês">' + seta('M9 5l7 7-7 7') + '</button></div><div class="cal-grade">' +
      ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function (x) { return '<span class="cal-sem" aria-hidden="true">' + x + '</span>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = somaDias(ini, i);
      if (i % 7 === 0 && i && d.slice(0, 7) > m) break;
      var t0 = +momento(d), t1 = +momento(somaDias(d, 1));
      var rs = ativas.filter(function (x) { return x.t0 >= t0 && x.t0 < t1; });
      var fechado = diaFechado(d), temBloq = !fechado && bloqueiosEntre(t0, t1).length > 0;
      var ok = rs.some(function (x) { return x.r.status === 'aprovada'; }), espera = rs.some(function (x) { return x.r.status !== 'aprovada'; });
      var cls = 'cal-dia' + (d.slice(0, 7) !== m ? ' fora' : '') + (d < hoje ? ' passado' : '') + (d === hoje ? ' hoje' : '') + (d === estado.diaAg ? ' sel' : '') + (fechado ? ' fechado' : '') + (SEMANA[diaSemana(d)] ? '' : ' sem-expediente');
      var rot = cap(diaExtenso(momento(d, '12:00'))) + (rs.length ? ', ' + rs.length + (rs.length > 1 ? ' reuniões' : ' reunião') : '') + (fechado ? ', indisponível' : temBloq ? ', com bloqueio' : '');
      h += '<button type="button" class="' + cls + '" data-dia="' + d + '" aria-label="' + esc(rot) + '"' + (d === estado.diaAg ? ' aria-pressed="true"' : '') + '><b>' + (+d.slice(8)) + '</b><span class="pontos">' +
        (ok ? '<i class="pt ok"></i>' : '') + (espera ? '<i class="pt espera"></i>' : '') + (temBloq ? '<i class="pt bloq"></i>' : '') + '</span></button>';
    }
    h += '</div><div class="cal-legenda"><span><i class="pt ok"></i>Reunião confirmada</span><span><i class="pt espera"></i>A aprovar</span><span><i class="pt bloq"></i>Bloqueio</span><span><i class="pt fechado"></i>Dia indisponível</span></div>';
    $('#cal').innerHTML = h;
  }

  function desenharDia() {
    var d = estado.diaAg, f = SEMANA[diaSemana(d)], ini = +momento(d), fim = +momento(somaDias(d, 1)), agora = Date.now(), itens = [];
    estado.bloqueios.forEach(function (b) {
      var b0 = +new Date(b.inicio), b1 = +new Date(b.fim);
      if (sobrepoe(b0, b1, ini, fim)) itens.push({ tipo: 'bloq', t: Math.max(b0, ini), ordem: 0, b: b, b0: b0, b1: b1 });
    });
    reunioesAtivas().forEach(function (x) { if (x.t0 >= ini && x.t0 < fim) itens.push({ tipo: 'reun', t: x.t0, ordem: 1, x: x }); });
    if (f) for (var h = f[0]; h < f[1]; h++) {
      var s = +momento(d, hh(h)), e = s + 3600e3;
      if (e <= agora) continue;
      var ocupado = itens.some(function (i) { return i.tipo === 'bloq' ? sobrepoe(i.b0, i.b1, s, e) : i.tipo === 'reun' && i.x.t0 === s; });
      if (!ocupado) itens.push({ tipo: 'livre', t: s, ordem: 2, h: h });
    }
    itens.sort(function (a, b) { return (a.t - b.t) || (a.ordem - b.ordem); });

    var passado = fim <= agora;
    var html = '<div class="dia-cab"><div><h3>' + esc(cap(diaExtenso(momento(d, '12:00')))) + '</h3><p class="miudo">' +
      (f ? 'Atendimento das ' + f[0] + 'h às ' + f[1] + 'h' : 'Sem atendimento neste dia') + '</p></div>' +
      (passado || !f || estado.semAgenda ? '' : '<button class="btn fantasma pequeno" type="button" data-bloquear-dia="' + d + '">Bloquear o dia</button>') + '</div>';
    if (!itens.length) html += '<p class="miudo">' + (passado ? 'Nada marcado neste dia.' : 'Nenhum horário para mostrar.') + '</p>';
    html += '<div class="linha-tempo">' + itens.map(function (i) {
      if (i.tipo === 'bloq') {
        var todo = i.b0 <= ini && i.b1 >= fim;
        var faixa = todo ? 'Dia todo' : (i.b0 < ini ? '00:00' : hora(i.b0)) + '–' + (i.b1 >= fim ? '24:00' : hora(i.b1));
        return '<div class="lt-item bloq' + (i.b.tipo === 'compromisso' ? ' compromisso' : '') + '"><time>' + faixa + '</time><div><b>' + esc(i.b.titulo) + '</b><small>' +
          (i.b.tipo === 'compromisso' ? 'Compromisso' : 'Indisponível') + (i.b.serie ? ' · repete toda semana' : '') + '</small></div>' +
          '<button class="icone mini" type="button" data-bloqueio="' + esc(i.b.id) + '" aria-label="Apagar ' + esc(i.b.titulo) + '"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>';
      }
      if (i.tipo === 'reun') {
        var r = i.x.r, bq = bloqueiosEntre(i.x.t0, i.x.t1)[0];
        var et = bq ? '<span class="etiqueta alerta">Bloqueado</span>' : r.status === 'aprovada' ? '<span class="etiqueta ok">Confirmada</span>' : r.status === 'proposta' ? '<span class="etiqueta espera">Proposta</span>' : '<span class="etiqueta espera">A aprovar</span>';
        return '<div class="lt-item reun' + (bq ? ' conflito' : '') + '" data-id="' + i.x.p.id + '" tabindex="0"><time>' + hora(r.inicio) + '</time><div><b>' + esc(i.x.p.empresa) + '</b><small>' + esc(i.x.p.nome) + '</small></div>' + et + '</div>';
      }
      return '<div class="lt-item livre"><time>' + hh(i.h) + '</time><div><span>Livre</span></div>' +
        (estado.semAgenda ? '' : '<button class="btn fantasma mini" type="button" data-bloquear-hora="' + i.h + '">Bloquear</button>') + '</div>';
    }).join('') + '</div>';
    $('#dia-painel').innerHTML = html;
  }

  function desenharProximas() {
    var agora = Date.now(), limite = agora + 14 * 864e5;
    var itens = reunioesAtivas().filter(function (x) { return x.t0 >= agora - 3600e3 && x.t0 <= limite; });
    if (!itens.length) { $('#agenda').innerHTML = '<div class="vazio"><b>Sem reuniões</b>Nenhuma reunião pedida para os próximos 14 dias.</div>'; return; }
    itens.sort(function (a, b) { return a.t0 - b.t0; });
    var aprovados = {}; itens.forEach(function (x) { if (x.r.status === 'aprovada') aprovados[x.t0] = true; });
    var html = '', dia = '';
    itens.forEach(function (x) {
      var k = chaveDia(x.r.inicio);
      if (k !== dia) { if (dia) html += '</div>'; dia = k; html += '<div class="agenda-dia"><h3>' + esc(diaExtenso(x.r.inicio)) + '</h3>'; }
      var conf = x.r.status === 'pendente' && aprovados[x.t0], bq = bloqueiosEntre(x.t0, x.t1).length > 0;
      var et = conf ? '<span class="etiqueta alerta">Conflito</span>' : bq ? '<span class="etiqueta alerta">Bate com bloqueio</span>' : x.r.status === 'aprovada' ? '<span class="etiqueta ok">Confirmada</span>' : x.r.status === 'proposta' ? '<span class="etiqueta espera">Proposta</span>' : '<span class="etiqueta espera">A aprovar</span>';
      html += '<div class="agenda-item' + (conf || bq ? ' conflito' : '') + '" data-id="' + x.p.id + '" tabindex="0"><time>' + hora(x.r.inicio) + '</time><div><b>' + esc(x.p.empresa) + '</b><br><small>' + esc(x.p.nome) + '</small></div>' + et + '</div>';
    });
    $('#agenda').innerHTML = html + '</div>';
  }

  $('#vista-agenda').addEventListener('click', function (e) {
    var b = e.target.closest('button, .agenda-item, .lt-item.reun'); if (!b || b.disabled) return;
    if (b.dataset.mes) {
      var q = estado.mes.split('-'), n = new Date(Date.UTC(+q[0], q[1] - 1 + (+b.dataset.mes), 1)).toISOString().slice(0, 7);
      estado.mes = n; var hoje = isoDia(Date.now());
      estado.diaAg = n === hoje.slice(0, 7) ? hoje : n + '-01';
      desenharAgenda(); return;
    }
    if (b.dataset.dia) { estado.diaAg = b.dataset.dia; if (b.dataset.dia.slice(0, 7) !== estado.mes) estado.mes = b.dataset.dia.slice(0, 7); desenharAgenda(); $('#dia-painel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    if (b.id === 'novo-bloqueio') return abrirFormBloqueio({});
    if (b.dataset.bloquearDia) return abrirFormBloqueio({ dia: b.dataset.bloquearDia, todo: true });
    if (b.dataset.bloquearHora) return abrirFormBloqueio({ dia: estado.diaAg, h: +b.dataset.bloquearHora });
    if (b.dataset.bloqueio) return abrirApagar(b.dataset.bloqueio);
    if (b.dataset.id) abrir(b.dataset.id);
  });
  $('#vista-agenda').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var it = e.target.closest('[data-id]'); if (it) abrir(it.dataset.id); } });

  /* ---------- Marcar e apagar bloqueios ---------- */
  function novoId() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return (Math.random() * 16 | 0).toString(16); }); }
  function abrirFolhaBloqueio(html) { $('#fb-caixa').onclick = null; $('#fb-caixa').innerHTML = html; $('#folha-bloqueio').hidden = false; document.body.style.overflow = 'hidden'; }

  function abrirFormBloqueio(pre) {
    var hoje = isoDia(Date.now()), d = pre.dia || estado.diaAg || hoje; if (d < hoje) d = hoje;
    var de = pre.h != null ? hh(pre.h) : '12:00', ate = pre.h != null ? hh(pre.h + 1) : '13:00';
    abrirFolhaBloqueio('<h3 id="fb-titulo">Marcar na agenda</h3><p class="miudo fb-sub">Nesse período ninguém consegue marcar reunião pelo formulário.</p>' +
      '<form id="form-bloqueio" novalidate>' +
      '<div class="filtros" role="radiogroup" aria-label="Tipo"><button type="button" class="chip ativo" role="radio" aria-checked="true" data-tipo="indisponivel">Indisponível</button><button type="button" class="chip" role="radio" aria-checked="false" data-tipo="compromisso">Compromisso</button></div>' +
      '<label class="campo"><span>O que é (opcional)</span><input id="fb-nome" maxlength="80" placeholder="Ex.: dentista, viagem, aula"></label>' +
      '<div class="duas"><label class="campo"><span>Começa no dia</span><input id="fb-dia" type="date" min="' + hoje + '" value="' + d + '"></label>' +
      '<label class="campo"><span>Termina no dia</span><input id="fb-ate-dia" type="date" min="' + hoje + '" value="' + d + '"></label></div>' +
      '<label class="chave-linha"><input type="checkbox" id="fb-todo"' + (pre.todo ? ' checked' : '') + '><span>Dia inteiro</span></label>' +
      '<div class="duas" id="fb-horas"' + (pre.todo ? ' hidden' : '') + '><label class="campo"><span>Das</span><input id="fb-de" type="time" step="900" value="' + de + '"></label>' +
      '<label class="campo"><span>Até</span><input id="fb-ate" type="time" step="900" value="' + ate + '"></label></div>' +
      '<label class="campo"><span>Repetir</span><select id="fb-rep"><option value="0">Não repetir</option><option value="4">Toda semana, por 1 mês</option><option value="8">Toda semana, por 2 meses</option><option value="13">Toda semana, por 3 meses</option><option value="26">Toda semana, por 6 meses</option></select></label>' +
      '<p class="erro-msg" id="fb-erro" role="alert"></p>' +
      '<button class="btn principal largo" type="submit">Salvar na agenda</button>' +
      '<button class="btn fantasma largo fb-voltar" type="button" data-fechar>Voltar</button></form>');
    var dia = $('#fb-dia'), ateDia = $('#fb-ate-dia');
    // O fim acompanha o começo, a não ser que ela tenha escolhido outro dia de fim.
    var diaAntes = dia.value;
    dia.addEventListener('change', function () { if (!ateDia.value || ateDia.value === diaAntes || ateDia.value < dia.value) ateDia.value = dia.value; ateDia.min = dia.value; diaAntes = dia.value; });
    $('#fb-todo').addEventListener('change', function () { $('#fb-horas').hidden = this.checked; });
    $('#form-bloqueio .filtros').addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      $$('.chip', this).forEach(function (x) { x.classList.toggle('ativo', x === c); x.setAttribute('aria-checked', x === c ? 'true' : 'false'); });
    });
    $('#form-bloqueio').addEventListener('submit', salvarBloqueio);
    setTimeout(function () { $('#fb-nome').focus(); }, 250);
  }

  function salvarBloqueio(e) {
    e.preventDefault();
    var erro = function (t) { $('#fb-erro').textContent = t; };
    var tipo = $('#form-bloqueio .chip.ativo').dataset.tipo, nome = $('#fb-nome').value.trim();
    var d = $('#fb-dia').value, ad = $('#fb-ate-dia').value || d, todo = $('#fb-todo').checked;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(ad)) return erro('Escolha o dia.');
    if (!todo && (!$('#fb-de').value || !$('#fb-ate').value)) return erro('Escolha os horários.');
    var i0 = todo ? momento(d) : momento(d, $('#fb-de').value), i1 = todo ? momento(somaDias(ad, 1)) : momento(ad, $('#fb-ate').value);
    if (!(i1 > i0)) return erro('O fim precisa ser depois do começo.');
    if (i1 - i0 > 62 * 864e5) return erro('Período longo demais. Marque até 2 meses de cada vez.');
    if (+i1 <= Date.now()) return erro('Esse horário já passou.');
    var rep = +$('#fb-rep').value, serie = rep ? novoId() : null, lista = [];
    for (var k = 0; k < Math.max(rep, 1); k++) {
      lista.push({ inicio: new Date(+i0 + k * 7 * 864e5).toISOString(), fim: new Date(+i1 + k * 7 * 864e5).toISOString(),
        titulo: nome || (tipo === 'compromisso' ? 'Compromisso' : 'Indisponível'), tipo: tipo, serie: serie });
    }
    var batem = reunioesAtivas().filter(function (x) { return lista.some(function (b) { return sobrepoe(x.t0, x.t1, +new Date(b.inicio), +new Date(b.fim)); }); });
    if (batem.length && !confirm('Já tem ' + (batem.length > 1 ? batem.length + ' reuniões' : 'reunião') + ' nesse período (' + batem.slice(0, 3).map(function (x) { return x.p.empresa + ', ' + diaHora(x.r.inicio); }).join('; ') +
      '). Marcar mesmo assim? As reuniões não são canceladas sozinhas: remarque pelo pedido.')) return;
    var b = $('#form-bloqueio [type="submit"]');
    depois(api.criarBloqueios(lista), b, rep ? 'Marcado nas próximas ' + rep + ' semanas. Saiu do formulário.' : 'Marcado. Esse horário saiu do formulário.').then(function () {
      estado.diaAg = d; estado.mes = d.slice(0, 7); estado.slots = null; fecharFolhas(); desenharAgenda();
    }).catch(function () {});
  }

  function abrirApagar(id) {
    var b = estado.bloqueios.filter(function (x) { return x.id === id; })[0]; if (!b) return;
    var futuras = b.serie ? estado.bloqueios.filter(function (x) { return x.serie === b.serie && x.inicio >= b.inicio; }).length : 0;
    abrirFolhaBloqueio('<h3 id="fb-titulo">' + esc(b.titulo) + '</h3><p class="lead pequeno">' + esc(periodo(b)) + '</p>' +
      '<div class="acoes coluna"><button class="btn perigo largo" type="button" data-apagar="um">Apagar' + (futuras > 1 ? ' só este' : '') + '</button>' +
      (futuras > 1 ? '<button class="btn perigo largo" type="button" data-apagar="serie">Apagar este e as próximas repetições (' + futuras + ')</button>' : '') +
      '<button class="btn fantasma largo" type="button" data-fechar>Voltar</button></div>' +
      '<p class="miudo">Ao apagar, o horário volta a aparecer no formulário.</p>');
    $('#fb-caixa').onclick = function (e) {
      var bt = e.target.closest('[data-apagar]'); if (!bt) return;
      $('#fb-caixa').onclick = null;
      var pr = bt.dataset.apagar === 'serie' ? api.apagarSerie(b.serie, b.inicio) : api.apagarBloqueio(b.id);
      depois(pr, bt, 'Apagado. O horário voltou para o formulário.').then(function () { estado.slots = null; fecharFolhas(); desenharAgenda(); }).catch(function () {});
    };
  }

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

  /* ---------- O que o cliente quer ---------- */
  var GRUPOS_RESP = [
    ['O site', ['funcionalidades', 'estilo', 'cores', 'referencias', 'prazo']],
    ['O negócio', ['segmento', 'publico', 'cidade', 'tempo', 'equipe', 'atendimento']],
    ['Hoje na internet', ['instagram', 'siteAtual', 'google', 'dominio', 'fotos']],
    ['Mais', ['origem', 'email']]
  ];
  function vazio(v) { return v == null || v === '' || (Array.isArray(v) && !v.length); }
  function valorResp(k, v, resp) {
    if (Array.isArray(v)) return v.map(function (x) { return '<span class="etiqueta">' + esc(x) + '</span>'; }).join(' ');
    var t = String(v);
    if (k === 'cidade') return esc(t + (resp.uf ? ' / ' + resp.uf : ''));
    if (k === 'cores') {
      var hex = t.match(/#[0-9a-f]{6}\b/gi);
      return hex ? hex.map(function (c) { return '<span class="cor-amostra" style="background:' + c + '" title="' + c + '"></span><code>' + c + '</code>'; }).join(' ') : esc(t);
    }
    if (k === 'instagram') { var u = t.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, ''); return /^[\w.]{1,30}$/.test(u) ? '<a href="https://instagram.com/' + encodeURIComponent(u) + '" target="_blank" rel="noopener">@' + esc(u) + '</a>' : esc(t); }
    return esc(t).replace(/https?:\/\/[^\s<)]+/g, function (m) { return '<a href="' + m + '" target="_blank" rel="noopener">' + m + '</a>'; }).replace(/\n/g, '<br>');
  }
  function blocoPedido(p, logo) {
    var resp = Object.assign({}, p.respostas || {});
    ['segmento', 'tipoSite', 'objetivo'].forEach(function (k) { if (vazio(resp[k]) && p[k === 'tipoSite' ? 'tipo_site' : k]) resp[k] = p[k === 'tipoSite' ? 'tipo_site' : k]; });
    var usados = { oQueVende: true, tipoSite: true, objetivo: true }, corpo = '';
    GRUPOS_RESP.forEach(function (g) {
      var linhas = '';
      g[1].forEach(function (k) { usados[k] = true; if (vazio(resp[k])) return; linhas += '<dt>' + esc(ROTULOS[k] || k) + '</dt><dd>' + valorResp(k, resp[k], resp) + '</dd>'; });
      if (linhas) corpo += '<h5>' + g[0] + '</h5><dl class="dl">' + linhas + '</dl>';
    });
    // qualquer resposta nova do formulário que não esteja nos grupos
    var outros = '';
    Object.keys(resp).forEach(function (k) {
      if (usados[k] || k.charAt(0) === '_' || /^(nome|whatsapp|empresa|uf|observacoes|horario|logo_path|armadilha|aceite)$/.test(k) || vazio(resp[k]) || typeof resp[k] === 'object' && !Array.isArray(resp[k])) return;
      outros += '<dt>' + esc(ROTULOS[k] || k) + '</dt><dd>' + valorResp(k, resp[k], resp) + '</dd>';
    });
    if (outros) corpo += '<h5>Outras respostas</h5><dl class="dl">' + outros + '</dl>';
    var obs = !vazio(resp.observacoes) ? '<div class="obs-cliente"><b>O que ele escreveu</b>' + valorResp('observacoes', resp.observacoes, resp) + '</div>' : '';
    var vende = !vazio(resp.oQueVende) ? '<p class="pedido-resumo">' + esc(resp.oQueVende) + '</p>' : '';
    var topo = '<div class="pedido-topo">' +
      (logo ? '<a class="logo-grande" href="' + esc(logo) + '" target="_blank" rel="noopener" title="Abrir a logo em tamanho real"><img src="' + esc(logo) + '" alt="Logo da ' + esc(p.empresa) + '"></a>'
        : '<div class="logo-grande sem"><span>Sem logo</span></div>') +
      '<div><span class="rotulo-mini">Pediu</span><b class="pedido-tipo">' + esc(resp.tipoSite || 'Tipo não informado') + '</b>' +
      (resp.objetivo ? '<span class="pedido-obj">' + esc(resp.objetivo) + '</span>' : '') +
      (logo ? '<a class="miudo" href="' + esc(logo) + '" download target="_blank" rel="noopener">Baixar logo</a>' : '') + '</div></div>';
    return '<section class="bloco pedido-cliente"><h4>O que o cliente quer</h4>' + topo + vende + obs + corpo + '</section>';
  }

  function desenharDetalhe(p) {
    var r = reuniaoAtual(p), conf = conflitoDe(p, r), st = p.status;
    $('#det-empresa').textContent = p.empresa;
    $('#det-sub').textContent = (STATUS[st] || st) + ' · ' + p.codigo + ' · chegou ' + diaHora(p.criado_em);
    var logo = api.logoUrl(p.logo_path), h = '';

    // Contato
    h += '<section class="bloco"><div class="contato">' +
      '<div><b>' + esc(p.nome) + '</b><span>' + esc(foneBonito(p.whatsapp)) + (p.email ? ' · ' + esc(p.email) : '') + '</span></div></div>' +
      '<div class="acoes" style="margin-top:14px">' +
      '<button class="btn secundario pequeno" data-acao="whats-analise">' + icWhats() + ' Avisar "em análise"</button>' +
      '<a class="btn fantasma pequeno" href="https://wa.me/' + fone(p.whatsapp) + '" target="_blank" rel="noopener">Abrir conversa</a></div></section>';

    // O que o cliente quer (respostas + logo), logo no começo para decidir se aceita
    h += blocoPedido(p, logo);

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
      var n = concorrentes(p, r), bq = bloqueioDa(r);
      c1 = '<p>Pediu para conversar em</p><p class="destaque-hora">' + esc(diaExtenso(r.inicio)) + ', ' + hora(r.inicio) + '</p>' +
        (bq && !conf ? '<div class="alerta-caixa">Você marcou <b>' + esc(bq.titulo) + '</b> na agenda nesse horário. Proponha outro ou apague o bloqueio.</div>' : '') +
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

    var resp = p.respostas || {};

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
