# 📅 AgendaFlex

**Plataforma web para organizar locais, profissionais, clientes, procedimentos, agendamentos e atendimentos.**

[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

## 📖 Sobre o projeto

O **AgendaFlex** é um sistema web de gestão de agendamentos e atendimentos. O projeto reúne recursos administrativos para cadastro e organização dos locais de atendimento, profissionais, clientes e procedimentos, além de telas específicas para agenda, execução de atendimentos e relatórios.

O sistema foi estruturado com interface em React e uma API em Node.js/Express, utilizando autenticação com Firebase e persistência local via SQLite.

> 🚧 **Projeto em desenvolvimento.** As telas e rotas identificadas no código não significam, necessariamente, que todos os fluxos estejam finalizados ou validados em produção.

## ✨ Módulos do sistema

| Módulo | Rota | Objetivo |
| --- | --- | --- |
| Visão geral | `/admin` | Painel administrativo |
| Locais | `/admin/locais` | Cadastro e gestão de locais de atendimento |
| Profissionais | `/admin/profissionais` | Cadastro e gestão dos profissionais |
| Clientes | `/admin/clientes` | Cadastro e consulta de clientes |
| Procedimentos | `/admin/procedimentos` | Organização dos serviços e procedimentos |
| Agenda | `/agenda` | Consulta e gerenciamento de agendamentos |
| Atendimento | `/atendimento` | Acompanhamento dos atendimentos |
| Relatórios | `/relatorios` | Visualização de informações gerenciais |

A aplicação também inclui uma tela de login e controle de autenticação.

## 🛠️ Tecnologias

**Interface**
- React 19 e TypeScript
- Vite 8
- Tailwind CSS 4
- Radix UI e Lucide React
- Recharts, Motion e Sonner

**Servidor e dados**
- Node.js com Express
- SQLite com `better-sqlite3`
- Zod para validação de dados
- Firebase para autenticação
- Estrutura de integração/migrações do Supabase presente no repositório

**Outras dependências**
- SDK `@google/genai` para integração com recursos de IA

## 📁 Estrutura do repositório

```text
AgendaFlex/
├── src/
│   ├── components/     # Componentes de interface
│   ├── contexts/       # Contextos, incluindo autenticação
│   ├── lib/            # Utilitários e integrações
│   ├── pages/          # Telas administrativas, agenda e relatórios
│   ├── App.tsx         # Navegação e composição da aplicação
│   └── main.tsx        # Entrada do front-end
├── server/
│   └── db.ts           # Acesso e operações de banco de dados
├── supabase/           # Funções e migrações
├── server.ts           # Servidor Express e integração com Vite
├── firebase-applet-config.json
├── .env.example
├── package.json
├── bun.lock
├── tsconfig.json
└── vite.config.ts
```

## 🚀 Executando localmente

### Pré-requisitos

- Node.js instalado
- npm (ou Bun, caso prefira utilizar o arquivo de lock existente)
- Configuração de autenticação Firebase compatível com o projeto

### 1. Clone o repositório

```bash
git clone https://github.com/MoraisGui01/AgendaFlex.git
cd AgendaFlex
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o ambiente

Crie um arquivo `.env` com base no exemplo fornecido:

```bash
cp .env.example .env
```

No Windows PowerShell, utilize:

```powershell
Copy-Item .env.example .env
```

O arquivo de exemplo documenta as variáveis `GEMINI_API_KEY` e `APP_URL`. Configure os valores conforme o ambiente utilizado. Confira também a configuração do Firebase em `firebase-applet-config.json` e os serviços necessários à autenticação.

**Segurança:** não publique tokens, chaves privadas ou credenciais reais no repositório.

### 4. Inicie o ambiente de desenvolvimento

```bash
npm run dev
```

O script inicia o servidor definido em `server.ts`, que utiliza a porta **3000**. Acesse:

```text
http://localhost:3000
```

> A execução completa depende de as credenciais e integrações necessárias estarem corretamente configuradas.

## 📜 Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor por `tsx server.ts` |
| `npm start` | Inicia o mesmo servidor |
| `npm run build` | Gera o build do front-end com Vite |
| `npm run preview` | Executa a pré-visualização do build |
| `npm run lint` | Verifica os tipos com `tsc --noEmit` |

## 🔐 Autenticação e segurança

O back-end valida tokens de autenticação do Firebase em rotas protegidas. O projeto também utiliza esquemas Zod para validar dados enviados à API.

Antes de publicar a aplicação em produção, recomenda-se revisar permissões, configuração de ambiente, armazenamento de segredos, regras de acesso e testes de integração.

## 🗺️ Próximos passos

- Validar os fluxos completos de cadastro e agendamento.
- Ampliar a cobertura de testes.
- Documentar os endpoints da API.
- Revisar permissões e perfis de acesso.
- Refinar relatórios e indicadores.
- Preparar o processo de implantação em produção.

## 👨‍💻 Autor

Desenvolvido por **[MoraisGui01](https://github.com/MoraisGui01)**.

Repositório: **[github.com/MoraisGui01/AgendaFlex](https://github.com/MoraisGui01/AgendaFlex)**

## 📄 Licença

Nenhum arquivo de licença foi identificado na raiz do repositório na preparação deste README. Defina uma licença antes de permitir reutilização e redistribuição do código por terceiros.

---

**AgendaFlex — organização e flexibilidade para cada atendimento.**
