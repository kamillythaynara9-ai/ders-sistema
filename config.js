// Configuração do sistema DERS.
// supabaseUrl e supabaseAnonKey vêm de Supabase > Project Settings > API.
// A chave "anon"/"publishable" é pública por natureza: a segurança fica nas regras do banco (banco.sql).
window.DERS_SISTEMA = {
  supabaseUrl: 'https://shgvmnslmnekmgozfjtc.supabase.co',
  supabaseAnonKey: 'sb_publishable_LH0JvrC3pToxvJ-wnpLm4Q_Bvu4FDVK',
  // Login: o usuário digitado vira <usuario>@<dominioLogin> por dentro (ex.: DERS2026 -> ders2026@ders.com.br).
  dominioLogin: 'ders.com.br',
  // Onde ficam o formulário e a página em que o cliente responde à proposta de horário.
  formsUrl: 'https://ders-forms-s43d.vercel.app',
  // Dono dos repositórios no GitHub (para o atalho "criar repositório").
  github: 'kamillythaynara9-ai',
  fuso: 'America/Sao_Paulo'
};
