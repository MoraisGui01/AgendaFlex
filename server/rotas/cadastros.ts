import crypto from 'node:crypto';
import { Router } from 'express';
import type { ZodObject, ZodRawShape } from 'zod';
import { operador } from '../auth.ts';
import { auditar } from '../auditoria.ts';
import type { Banco, Linha } from '../banco/conexao.ts';
import { CLINICA_ID } from '../config.ts';
import { naoEncontrado, rota, validar } from '../http.ts';
import { clienteSchema, localSchema, procedimentoSchema, profissionalSchema } from '../validacao.ts';

/**
 * Os quatro cadastros (locais, profissionais, clientes e procedimentos) seguem o mesmo fluxo:
 * listar com busca e filtro de status, criar, editar, ativar/inativar e arquivar (exclusão lógica).
 * Cada um é descrito por uma configuração e as rotas são geradas a partir dela.
 */
interface Cadastro {
  caminho: string;
  tabela: string;
  /** Sufixo das ações de auditoria: CRIACAO_LOCAL, ATUALIZACAO_LOCAL... */
  sigla: string;
  artigo: 'o' | 'a';
  nome: string;
  esquema: ZodObject<ZodRawShape>;
  /** Colunas gravadas a partir do corpo da requisição */
  colunas: string[];
  /** Colunas guardadas como texto JSON */
  colunasJson?: string[];
  /** Colunas guardadas como 0/1 */
  colunasBooleanas?: string[];
  /** Campos usados na busca por texto */
  camposBusca: string[];
  acaoArquivar?: string;
}

const CADASTROS: Cadastro[] = [
  {
    caminho: '/locais',
    tabela: 'locais',
    sigla: 'LOCAL',
    artigo: 'o',
    nome: 'Local',
    esquema: localSchema as any,
    colunas: ['nome', 'endereco', 'horario_func', 'status'],
    colunasJson: ['horario_func'],
    camposBusca: ['nome', 'endereco'],
  },
  {
    caminho: '/profissionais',
    tabela: 'profissionais',
    sigla: 'PROFISSIONAL',
    artigo: 'o',
    nome: 'Profissional',
    esquema: profissionalSchema as any,
    colunas: ['nome', 'cpf', 'registro_conselho', 'especialidade', 'procedimentos_vinculados', 'status'],
    colunasJson: ['procedimentos_vinculados'],
    camposBusca: ['nome', 'especialidade', 'cpf'],
  },
  {
    caminho: '/clientes',
    tabela: 'clientes',
    sigla: 'CLIENTE',
    artigo: 'o',
    nome: 'Cliente',
    esquema: clienteSchema as any,
    colunas: ['nome', 'whatsapp', 'nascimento', 'lgpd_consentimento', 'status'],
    colunasBooleanas: ['lgpd_consentimento'],
    camposBusca: ['nome', 'whatsapp'],
    acaoArquivar: 'SOFT_DELETE_CLIENTE_LGPD',
  },
  {
    caminho: '/procedimentos',
    tabela: 'procedimentos',
    sigla: 'PROCEDIMENTO',
    artigo: 'o',
    nome: 'Procedimento',
    esquema: procedimentoSchema as any,
    colunas: ['nome', 'duracao_min', 'valor', 'orientacoes', 'status'],
    camposBusca: ['nome', 'orientacoes'],
  },
];

/** Converte a linha do banco para o formato da API (JSON e booleanos). */
function deLinha(cadastro: Cadastro, linha: Linha): Linha {
  const saida: Linha = { ...linha };
  for (const coluna of cadastro.colunasJson ?? []) saida[coluna] = JSON.parse(String(linha[coluna] || '[]'));
  for (const coluna of cadastro.colunasBooleanas ?? []) saida[coluna] = Boolean(Number(linha[coluna]));
  if ('valor' in saida) saida.valor = Number(saida.valor);
  if ('duracao_min' in saida) saida.duracao_min = Number(saida.duracao_min);
  return saida;
}

/** Converte um valor da API para o formato gravado no banco. */
function paraBanco(cadastro: Cadastro, coluna: string, valor: unknown): unknown {
  if (cadastro.colunasJson?.includes(coluna)) return JSON.stringify(valor);
  if (cadastro.colunasBooleanas?.includes(coluna)) return valor ? 1 : 0;
  return valor;
}

function registrar(router: Router, banco: Banco, cadastro: Cadastro) {
  const { caminho, tabela, sigla } = cadastro;
  const mensagemNaoEncontrado = `${cadastro.nome} não encontrad${cadastro.artigo}.`;

  const buscarAtivo = async (id: string) => {
    const linha = await banco.um(`SELECT * FROM ${tabela} WHERE id = ? AND clinica_id = ? AND deleted_at IS NULL`, [id, CLINICA_ID]);
    if (!linha) throw naoEncontrado(mensagemNaoEncontrado);
    return linha;
  };

  router.get(
    caminho,
    rota(async (req, res) => {
      const busca = String(req.query.search ?? '').trim().toLowerCase();
      const status = String(req.query.status ?? 'todos');
      const linhas = await banco.todos(
        `SELECT * FROM ${tabela} WHERE clinica_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
        [CLINICA_ID],
      );
      const filtradas = linhas
        .filter((l) => status === 'todos' || l.status === status)
        .filter((l) => !busca || cadastro.camposBusca.some((campo) => String(l[campo] ?? '').toLowerCase().includes(busca)))
        .map((l) => deLinha(cadastro, l));
      res.json(filtradas);
    }),
  );

  router.post(
    caminho,
    rota(async (req, res) => {
      const dados = validar(cadastro.esquema, req.body) as Linha;
      const id = crypto.randomUUID();
      const agora = new Date().toISOString();
      const colunas = ['id', 'clinica_id', ...cadastro.colunas, 'created_at'];
      const valores = [id, CLINICA_ID, ...cadastro.colunas.map((c) => paraBanco(cadastro, c, dados[c])), agora];
      if (tabela === 'clientes') {
        colunas.push('lgpd_consentimento_em');
        valores.push(agora);
      }

      await banco.transacao(async (tx) => {
        await tx.executar(
          `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
          valores,
        );
        await auditar(tx, {
          usuario: operador(req),
          acao: `CRIACAO_${sigla}`,
          entidade: tabela,
          entidade_id: id,
          detalhes: { nome: dados.nome },
        });
      });

      res.status(201).json(deLinha(cadastro, await buscarAtivo(id)));
    }),
  );

  router.put(
    `${caminho}/:id`,
    rota(async (req, res) => {
      const dados = validar(cadastro.esquema.partial(), req.body) as Linha;
      const atual = await buscarAtivo(req.params.id);
      // Só grava o que veio no corpo: valores padrão do esquema não podem sobrescrever o cadastro
      const enviados = new Set(Object.keys(req.body ?? {}));
      const alteradas = cadastro.colunas.filter((c) => enviados.has(c) && dados[c] !== undefined);
      const mudouStatus = alteradas.includes('status') && dados.status !== atual.status;

      await banco.transacao(async (tx) => {
        if (alteradas.length > 0) {
          const sets = alteradas.map((c) => `${c} = ?`);
          const valores = alteradas.map((c) => paraBanco(cadastro, c, dados[c]));
          // LGPD: guarda a data em que o consentimento foi dado novamente
          if (alteradas.includes('lgpd_consentimento') && dados.lgpd_consentimento === true && !Number(atual.lgpd_consentimento)) {
            sets.push('lgpd_consentimento_em = ?');
            valores.push(new Date().toISOString());
          }
          await tx.executar(`UPDATE ${tabela} SET ${sets.join(', ')} WHERE id = ?`, [...valores, req.params.id]);
        }
        await auditar(tx, {
          usuario: operador(req),
          acao: mudouStatus ? `STATUS_${sigla}_${String(dados.status).toUpperCase()}` : `ATUALIZACAO_${sigla}`,
          entidade: tabela,
          entidade_id: req.params.id,
          detalhes: { nome: dados.nome ?? atual.nome, campos: alteradas },
        });
      });

      res.json(deLinha(cadastro, await buscarAtivo(req.params.id)));
    }),
  );

  router.delete(
    `${caminho}/:id`,
    rota(async (req, res) => {
      const atual = await buscarAtivo(req.params.id);
      const agora = new Date().toISOString();

      await banco.transacao(async (tx) => {
        await tx.executar(`UPDATE ${tabela} SET deleted_at = ?, status = 'inativo' WHERE id = ?`, [agora, req.params.id]);
        await auditar(tx, {
          usuario: operador(req),
          acao: cadastro.acaoArquivar ?? `SOFT_DELETE_${sigla}`,
          entidade: tabela,
          entidade_id: req.params.id,
          detalhes: { nome: atual.nome, deleted_at: agora },
        });
      });

      res.json({ ok: true, deleted_at: agora });
    }),
  );
}

export function rotasCadastros(banco: Banco): Router {
  const router = Router();
  for (const cadastro of CADASTROS) registrar(router, banco, cadastro);
  return router;
}
