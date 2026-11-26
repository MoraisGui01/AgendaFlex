# AgendaFlex

Sistema web de gestão de clínicas: cadastro de **locais, profissionais, clientes e procedimentos**,
**agenda sem conflitos de horário**, controle do **atendimento**, **lista de espera**, confirmação
pelo **WhatsApp** (simulada), **relatórios** e **auditoria** em conformidade com a **LGPD**.

## Funcionalidades

| Módulo | Rota | O que faz |
| --- | --- | --- |
| Visão geral | `/admin` | Indicadores do dia e do mês, agenda de hoje e lista de espera |
| Agenda | `/agenda` | Agenda por dia com filtros, novo agendamento, confirmação e cancelamento, encaixe da lista de espera |
| Atendimento | `/atendimento` | Conclusão, falta ou cancelamento, procedimentos extras e histórico do cliente |
| Relatórios | `/relatorios` | Ocupação diária, desfecho dos agendamentos, procedimentos mais procurados e log de auditoria |
| Locais | `/admin/locais` | Salas com horário de funcionamento, intervalo e dias da semana |
| Profissionais | `/admin/profissionais` | Equipe e procedimentos que cada profissional realiza |
| Clientes | `/admin/clientes` | Dados de contato e consentimento da LGPD |
| Procedimentos | `/admin/procedimentos` | Duração, valor e orientações ao cliente |

### Regras da agenda

- Um profissional não pode ter dois atendimentos ao mesmo tempo, e uma sala também não.
- O horário precisa estar dentro do expediente do local, fora do intervalo e em um dia de funcionamento.
- Só é possível agendar procedimentos vinculados ao profissional. Profissional sem vínculos atende todos.
- A tela de agendamento só mostra horários livres, de 30 em 30 minutos.
- Um procedimento extra soma valor e tempo ao atendimento, desde que não invada o próximo horário.
- Ao reativar um agendamento cancelado, o sistema confere se o horário continua livre.
- As verificações e a gravação acontecem na mesma transação, então dois usuários não conseguem
  reservar o mesmo horário ao mesmo tempo.

### LGPD e segurança

- Login com conta Google (Firebase Authentication). O servidor valida o token em todas as rotas `/api`.
- `ALLOWED_EMAILS` limita o acesso às contas autorizadas.
- O consentimento do cliente é registrado com data.
- Nada é apagado de verdade: registros arquivados recebem `deleted_at` e o histórico é preservado.
- Toda alteração gera um registro em `logs_auditoria` (usuário, ação, entidade e data).
- Os dados enviados são validados com Zod no servidor.

## Tecnologias

- **Front-end:** React 19, TypeScript, Vite, Tailwind CSS 4, Recharts, Lucide e Sonner
- **Back-end:** Node.js, Express, Zod e jose (validação dos tokens do Firebase)
- **Banco:** PostgreSQL em produção (`pg`) e SQLite no desenvolvimento (`better-sqlite3`)
- **Testes:** `node:test` + Supertest

## Estrutura

```text
server.ts                 inicialização (banco, API, Vite ou arquivos do build)
server/
  app.ts                  monta a API Express
  config.ts               variáveis de ambiente
  auth.ts                 validação do login Google
  horarios.ts             regras de horário (expediente, intervalo, horários livres)
  agenda.ts               choques entre agendamentos e cadastros ativos
  validacao.ts            esquemas Zod
  auditoria.ts            gravação do log de auditoria
  banco/                  conexão SQLite/PostgreSQL, tabelas e dados de demonstração
  rotas/                  cadastros, agendamentos, lista de espera, WhatsApp, relatórios e sessão
src/
  paginas/                telas
  layout/                 menu lateral, cabeçalho e painel do WhatsApp
  ui/                     componentes visuais
  auth/  lib/             login, chamadas à API e formatação
tests/                    testes das regras de horário e da API
supabase/                 modelo do banco com RLS e webhook do WhatsApp para produção
```

## Como rodar

Pré-requisitos: Node.js 22 ou superior.

```bash
npm install
cp .env.example .env      # no PowerShell: Copy-Item .env.example .env
npm run dev               # http://localhost:3000
```

Sem `DATABASE_URL`, o servidor cria o arquivo `agendaflex.db` (SQLite) com dados de demonstração.
O login usa o projeto Firebase definido em `firebase-applet-config.json`. Para usar outro domínio,
adicione-o em **Firebase Console → Authentication → Settings → Authorized domains**.

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (ex.: Neon). Obrigatória em produção, pois o disco do Cloud Run é apagado a cada reinício. |
| `ALLOWED_EMAILS` | E-mails Google liberados, separados por vírgula. Vazio libera qualquer conta. |

No Google AI Studio, configure as duas variáveis no painel **Secrets**.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor com Vite em modo desenvolvimento |
| `npm run build` | Gera o front-end em `dist/` |
| `npm start` | Servidor (com `NODE_ENV=production`, serve o `dist/`) |
| `npm test` | Testes das regras de horário e da API |
| `npm run lint` | Verificação de tipos (TypeScript) |

## Autor

Desenvolvido por **[MoraisGui01](https://github.com/MoraisGui01)**.
