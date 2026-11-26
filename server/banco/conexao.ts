import path from 'node:path';

/**
 * Acesso ao banco com a mesma interface para SQLite (desenvolvimento) e PostgreSQL (produção).
 * As consultas usam "?" como parâmetro; no PostgreSQL eles viram $1, $2...
 */
export interface Banco {
  readonly tipo: 'sqlite' | 'postgres';
  um<T = Linha>(sql: string, parametros?: unknown[]): Promise<T | undefined>;
  todos<T = Linha>(sql: string, parametros?: unknown[]): Promise<T[]>;
  executar(sql: string, parametros?: unknown[]): Promise<void>;
  script(sql: string): Promise<void>;
  /** Executa `fn` numa transação. Escritas concorrentes ficam em fila. */
  transacao<T>(fn: (tx: Banco) => Promise<T>): Promise<T>;
}

export type Linha = Record<string, any>;

/** Troca "?" por "$n", ignorando interrogações dentro de textos entre aspas simples. */
export function paraParametrosPostgres(sql: string): string {
  let resultado = '';
  let contador = 0;
  let dentroDeTexto = false;
  for (const caractere of sql) {
    if (caractere === "'") dentroDeTexto = !dentroDeTexto;
    if (caractere === '?' && !dentroDeTexto) {
      contador += 1;
      resultado += `$${contador}`;
    } else {
      resultado += caractere;
    }
  }
  return resultado;
}

/** Fila simples: garante que só uma transação de escrita rode por vez neste processo. */
function criarFila() {
  let ultima: Promise<unknown> = Promise.resolve();
  return <T>(tarefa: () => Promise<T>): Promise<T> => {
    const proxima = ultima.then(tarefa, tarefa);
    ultima = proxima.catch(() => undefined);
    return proxima;
  };
}

async function abrirSqlite(arquivo: string): Promise<Banco> {
  const { default: Database } = await import('better-sqlite3');
  const sqlite = new Database(arquivo);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const naFila = criarFila();

  const banco: Banco = {
    tipo: 'sqlite',
    async um(sql, parametros = []) {
      return sqlite.prepare(sql).get(...parametros) as any;
    },
    async todos(sql, parametros = []) {
      return sqlite.prepare(sql).all(...parametros) as any[];
    },
    async executar(sql, parametros = []) {
      sqlite.prepare(sql).run(...parametros);
    },
    async script(sql) {
      sqlite.exec(sql);
    },
    transacao(fn) {
      return naFila(async () => {
        sqlite.exec('BEGIN IMMEDIATE');
        try {
          const resultado = await fn(banco);
          sqlite.exec('COMMIT');
          return resultado;
        } catch (erro) {
          if (sqlite.inTransaction) sqlite.exec('ROLLBACK');
          throw erro;
        }
      });
    },
  };
  return banco;
}

async function abrirPostgres(url: string): Promise<Banco> {
  const { default: pg } = await import('pg');
  const local = /localhost|127\.0\.0\.1/.test(url) || /sslmode=disable/.test(url);
  const pool = new pg.Pool({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: 5,
  });
  const naFila = criarFila();

  type Cliente = { query: (sql: string, parametros?: unknown[]) => Promise<{ rows: any[] }> };

  const sobre = (cliente: Cliente, emTransacao: boolean): Banco => {
    const banco: Banco = {
      tipo: 'postgres',
      async um(sql, parametros = []) {
        const { rows } = await cliente.query(paraParametrosPostgres(sql), parametros);
        return rows[0];
      },
      async todos(sql, parametros = []) {
        const { rows } = await cliente.query(paraParametrosPostgres(sql), parametros);
        return rows;
      },
      async executar(sql, parametros = []) {
        await cliente.query(paraParametrosPostgres(sql), parametros);
      },
      async script(sql) {
        await cliente.query(sql);
      },
      transacao(fn) {
        // Transação dentro de transação: reaproveita a conexão atual
        if (emTransacao) return fn(banco);
        return naFila(async () => {
          const conexao = await pool.connect();
          try {
            await conexao.query('BEGIN');
            // Trava consultiva: impede que duas instâncias do servidor gravem ao mesmo tempo
            // (evita dois agendamentos no mesmo horário em instâncias diferentes do Cloud Run)
            await conexao.query('SELECT pg_advisory_xact_lock(4242)');
            const resultado = await fn(sobre(conexao, true));
            await conexao.query('COMMIT');
            return resultado;
          } catch (erro) {
            await conexao.query('ROLLBACK').catch(() => undefined);
            throw erro;
          } finally {
            conexao.release();
          }
        });
      },
    };
    return banco;
  };

  return sobre(pool, false);
}

export function abrirBanco(url: string | null): Promise<Banco> {
  return url ? abrirPostgres(url) : abrirSqlite(path.resolve(process.cwd(), 'agendaflex.db'));
}

/** Para testes: banco SQLite em memória. */
export function abrirBancoMemoria(): Promise<Banco> {
  return abrirSqlite(':memory:');
}
