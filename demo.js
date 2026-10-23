// Modo demonstração (portfólio): dados de exemplo só na memória do navegador. Nada é salvo.
(function () {
  'use strict';
  if (!/[?&]demo\b/.test(location.search) && !window.DERS_FORCAR_DEMO) return;

  var H = 3600e3, agora = Date.now();
  function slotEm(dias, horaLocal) {
    // horário de São Paulo (UTC-3) em "dias" a partir de hoje
    var d = new Date(agora + dias * 864e5);
    var y = d.getUTCFullYear(), m = d.getUTCMonth(), dd = d.getUTCDate();
    return new Date(Date.UTC(y, m, dd, horaLocal + 3, 0, 0)).toISOString();
  }
  function id() { return 'demo-' + Math.random().toString(36).slice(2, 10); }
  function reuniao(inicio, status, por) { return { id: id(), inicio: inicio, fim: new Date(new Date(inicio).getTime() + H).toISOString(), status: status, criado_por: por || 'cliente', token: id(), criado_em: new Date(agora - 2 * H).toISOString() }; }
  function pedido(o) {
    return Object.assign({ id: id(), codigo: 'D' + String(Math.random()).slice(2, 8) + '-DEMO', criado_em: new Date(agora - (o.horas || 1) * H).toISOString(), status: 'novo', email: '', respostas: {}, reunioes: [], logo_path: null }, o);
  }

  var amanha10 = slotEm(1, 10), amanha15 = slotEm(1, 15), depois11 = slotEm(2, 11);
  var dados = [
    pedido({ empresa: 'Doce Encanto Confeitaria', nome: 'Mariana Alves', whatsapp: '11900000001', segmento: 'Alimentação', tipo_site: 'Site com Catálogo', status: 'novo', horas: 1,
      logo_path: 'simbolo.png', respostas: { origem: 'Instagram', segmento: 'Alimentação', cidade: 'São Paulo', uf: 'SP', tempo: '3 a 10 anos', equipe: '2 a 5', atendimento: ['WhatsApp', 'Entrega'], instagram: '@doceencanto', siteAtual: 'Não tenho', google: 'Sim', tipoSite: 'Site com Catálogo', objetivo: 'Receber pedidos pelo WhatsApp', oQueVende: 'Bolos de festa, doces finos e kits de presente', publico: 'Mães da região e empresas', cores: '#E86A92 #F7D6E0 #5A2E3A', estilo: 'Delicado', referencias: 'Gosto do perfil https://instagram.com/exemplo', fotos: 'Tenho fotos de celular', dominio: 'Ainda não', prazo: 'Neste mês', funcionalidades: ['Catálogo de produtos', 'Galeria de fotos'], observacoes: 'Queria que o cliente montasse o kit de presente escolhendo os doces.' },
      reunioes: [reuniao(amanha10, 'pendente')] }),
    pedido({ empresa: 'Studio Bella Forma', nome: 'Carla Souza', whatsapp: '11900000002', segmento: 'Beleza e estética', tipo_site: 'Site para Empresa', status: 'novo', horas: 3,
      respostas: { origem: 'Indicação', cidade: 'Guarulhos', objetivo: 'Agendamento de horários', oQueVende: 'Estética facial e corporal', prazo: 'O quanto antes', funcionalidades: ['Agendamento'] },
      reunioes: [reuniao(amanha15, 'pendente')] }),
    pedido({ empresa: 'Pet Amigo Banho e Tosa', nome: 'Rafael Lima', whatsapp: '11900000003', segmento: 'Pet', tipo_site: 'Site para Empresa', status: 'reuniao_ok', horas: 20,
      respostas: { origem: 'Google', cidade: 'Osasco', objetivo: 'Agendamento de horários', oQueVende: 'Banho, tosa e táxi pet' },
      reunioes: [reuniao(amanha15, 'aprovada')] }),
    pedido({ empresa: 'Oficina Turbo Car', nome: 'Diego Martins', whatsapp: '11900000004', segmento: 'Automotivo', tipo_site: 'Página de Divulgação', status: 'para_revisar', horas: 26, repositorio: 'turbo-car',
      link_prototipo: 'https://detalhe-perfeito.vercel.app/', link_video: '', notas: 'Telefone e endereço são de exemplo.',
      respostas: { origem: 'WhatsApp', cidade: 'Santo André', objetivo: 'Divulgar uma promoção', oQueVende: 'Revisão completa e troca de óleo' },
      reunioes: [reuniao(depois11, 'aprovada')] }),
    pedido({ empresa: 'Festa Mágica Brinquedos', nome: 'Juliana Rocha', whatsapp: '11900000005', segmento: 'Festas e eventos', tipo_site: 'Site com Catálogo', status: 'enviado', horas: 50, repositorio: 'festa-magica',
      link_prototipo: 'https://sonhar-e-brincar.vercel.app/', respostas: { origem: 'Instagram', cidade: 'São Paulo', oQueVende: 'Aluguel de brinquedos para festas' },
      reunioes: [reuniao(slotEm(0, 20), 'aprovada')] }),
    pedido({ empresa: 'Ateliê Flor de Lis', nome: 'Paula Nunes', whatsapp: '11900000006', segmento: 'Moda', tipo_site: 'Site para Empresa', status: 'fechado', horas: 80, repositorio: 'flor-de-lis',
      link_prototipo: 'https://sonhar-e-brincar.vercel.app/', respostas: { origem: 'Indicação', cidade: 'São Paulo', oQueVende: 'Vestidos sob medida' },
      reunioes: [reuniao(slotEm(-3, 16), 'aprovada'), Object.assign(reuniao(slotEm(2, 14), 'aprovada', 'ders'), { tipo: 'acompanhamento', titulo: 'Mostrar a primeira versão' })] })
  ];
  // Agenda de exemplo: uma aula toda semana e uma tarde livre bloqueada.
  var serieAula = 'demo-serie-aula';
  var aTer = (9 - new Date(agora - 3 * H).getUTCDay()) % 7 || 7; // próxima terça
  var bloqueios = [0, 1, 2, 3].map(function (k) { return { id: id(), inicio: slotEm(aTer + k * 7, 19), fim: slotEm(aTer + k * 7, 21), titulo: 'Aula de inglês', tipo: 'compromisso', serie: serieAula }; });
  bloqueios.push({ id: id(), inicio: slotEm(3, 13), fim: slotEm(3, 17), titulo: 'Dentista', tipo: 'indisponivel', serie: null });
  function bloqueado(ini, fim) { return bloqueios.some(function (b) { return new Date(b.inicio) < fim && new Date(b.fim) > ini; }); }

  var hist = {};
  dados.forEach(function (p) { hist[p.id] = [{ quando: p.criado_em, evento: 'Pedido recebido pelo formulário' }]; });

  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  function resolve(x) { return new Promise(function (r) { setTimeout(function () { r(copia(x)); }, 180); }); }
  function acha(pid) { return dados.filter(function (p) { return p.id === pid; })[0]; }
  function reg(pid, evento, detalhe) { (hist[pid] = hist[pid] || []).push({ quando: new Date().toISOString(), evento: evento, detalhe: detalhe || null }); }
  var logado = false;

  window.DERS_DEMO_API = {
    sessao: function () { return resolve(logado ? {} : null); },
    entrar: function (u, s) { if (u.trim().toLowerCase() === 'demo' && s === 'demo') { logado = true; return resolve(true); } return Promise.reject(new Error('Invalid login')); },
    sair: function () { logado = false; return resolve(true); },
    trocarSenha: function () { return resolve(true); },
    ehAdmin: function () { return resolve(logado); },
    pedidos: function () { return resolve(dados); },
    historico: function (pid) { return resolve((hist[pid] || []).slice().reverse()); },
    atualizar: function (pid, campos) { Object.assign(acha(pid), campos); if (campos.status === 'em_criacao') setTimeout(function () { var p = acha(pid); if (p.status === 'em_criacao') { p.status = 'para_revisar'; p.link_prototipo = 'https://detalhe-perfeito.vercel.app/'; reg(pid, 'Site e vídeo prontos para revisar'); } }, 6000); return resolve(true); },
    registrar: function (pid, e, d) { reg(pid, e, d); return resolve(true); },
    cancelarReunioes: function (pid) { acha(pid).reunioes.forEach(function (r) { if (r.status === 'pendente' || r.status === 'proposta') r.status = 'cancelada'; }); return resolve(true); },
    aprovarReuniao: function (rid) {
      var alvo, dono;
      dados.forEach(function (p) { p.reunioes.forEach(function (r) { if (r.id === rid) { alvo = r; dono = p; } }); });
      var ocupado = dados.some(function (p) { return p.reunioes.some(function (r) { return r.status === 'aprovada' && r.inicio === alvo.inicio; }); });
      if (ocupado) return Promise.reject(new Error('reunioes_um_aprovado'));
      alvo.status = 'aprovada'; dono.reunioes.forEach(function (r) { if (r !== alvo && (r.status === 'pendente' || r.status === 'proposta')) r.status = 'cancelada'; });
      if (['novo', 'remarcar', 'aguardando_cliente'].indexOf(dono.status) >= 0) dono.status = 'reuniao_ok';
      reg(dono.id, 'Horário da reunião aprovado'); return resolve(true);
    },
    proporHorario: function (pid, inicio) {
      var p = acha(pid);
      p.reunioes.forEach(function (r) { if (r.status === 'pendente' || r.status === 'proposta') r.status = 'cancelada'; });
      var r = reuniao(new Date(inicio).toISOString(), 'proposta', 'ders'); p.reunioes.push(r); p.status = 'aguardando_cliente';
      reg(pid, 'Novo horário proposto ao cliente'); return resolve(r.token);
    },
    confirmarProposta: function (pid) { var p = acha(pid); var r = p.reunioes.filter(function (x) { return x.status === 'proposta'; })[0]; return r ? this.aprovarReuniao(r.id) : Promise.reject(new Error('sem_proposta')); },
    slots: function () {
      var out = [], semana = { 0: [10, 17], 1: [8, 22], 2: [8, 22], 3: [8, 22], 4: [8, 22], 5: [8, 22], 6: [10, 17] };
      for (var i = 0; i <= 14; i++) {
        var base = new Date(agora - 3 * H + i * 864e5), dow = base.getUTCDay(), f = semana[dow];
        for (var h = f[0]; h + 1 <= f[1]; h++) { var s = slotEm(i, h), t = new Date(s).getTime(); if (t >= Date.now() + 2 * H && !bloqueado(new Date(t), new Date(t + H))) out.push(s); }
      }
      return resolve(out);
    },
    bloqueios: function () { return resolve(bloqueios.slice().sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; })); },
    criarBloqueios: function (lista) { lista.forEach(function (b) { bloqueios.push(Object.assign({ id: id() }, b)); }); return resolve(true); },
    apagarBloqueio: function (bid) { bloqueios = bloqueios.filter(function (b) { return b.id !== bid; }); return resolve(true); },
    apagarSerie: function (serie, desde) { bloqueios = bloqueios.filter(function (b) { return !(b.serie === serie && b.inicio >= desde); }); return resolve(true); },
    marcarReuniao: function (pid, inicio, minutos, tipo, titulo) {
      var t0 = new Date(inicio), t1 = new Date(t0.getTime() + minutos * 60e3);
      if (bloqueado(t0, t1)) return Promise.reject(new Error('horario_bloqueado'));
      var bate = dados.some(function (p) { return p.reunioes.some(function (r) { return (r.status === 'aprovada' || r.status === 'proposta') && new Date(r.inicio) < t1 && new Date(r.fim) > t0; }); });
      if (bate) return Promise.reject(new Error('horario_ocupado'));
      var r = reuniao(t0.toISOString(), 'aprovada', 'ders'); r.fim = t1.toISOString(); r.tipo = tipo; r.titulo = titulo || null;
      acha(pid).reunioes.push(r); reg(pid, 'Reunião marcada', titulo || ''); return resolve(r.id);
    },
    cancelarReuniao: function (rid) { dados.forEach(function (p) { p.reunioes.forEach(function (r) { if (r.id === rid) r.status = 'cancelada'; }); }); return resolve(true); },
    logoUrl: function (path) { return path || ''; }
  };
})();
