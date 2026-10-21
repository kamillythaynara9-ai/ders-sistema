# DERS · Sistema interno

Painel com login onde chegam os pedidos do formulário da DERS: reunião (aprovar, propor outro horário, recusar),
repositório + aprovação da produção, revisão do site e do vídeo, envio ao cliente pelo WhatsApp (um toque).

- Site estático (sem build). Publica na Vercel sem configuração.
- Banco: Supabase. Estrutura e regras em `banco.sql` (colar no SQL Editor do Supabase).
- `config.js`: URL do Supabase e chave anon (pública; a proteção está nas regras do banco).
- Demonstração para o portfólio: abra com `?demo` (usuário `demo`, senha `demo`). Nada é salvo.
- Cabeçalhos de segurança em `vercel.json`.
