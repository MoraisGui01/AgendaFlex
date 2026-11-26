import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { EMAILS_PERMITIDOS, FIREBASE_PROJECT_ID } from './config.ts';

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: Usuario;
    }
  }
}

// Chaves públicas do Google usadas para assinar os ID Tokens do Firebase
const CHAVES_GOOGLE = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/** Exige um ID Token válido do Firebase em "Authorization: Bearer ..." */
export async function exigirLogin(req: Request, res: Response, next: NextFunction) {
  const cabecalho = req.header('authorization') ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado. Faça login com sua conta Google.' });
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, CHAVES_GOOGLE, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    }));
  } catch {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente com o Google.' });
  }

  const email = typeof payload.email === 'string' ? payload.email : '';
  if (EMAILS_PERMITIDOS.size > 0) {
    const liberado = payload.email_verified === true && EMAILS_PERMITIDOS.has(email.toLowerCase());
    if (!liberado) {
      return res.status(403).json({ error: 'Esta conta Google não tem acesso ao AgendaFlex. Peça liberação ao administrador.' });
    }
  }

  req.usuario = {
    uid: String(payload.sub ?? ''),
    email,
    nome: typeof payload.name === 'string' ? payload.name : '',
  };
  return next();
}

/** Nome exibido nos logs de auditoria: "Nome (email)" */
export function operador(req: Request): string {
  const u = req.usuario;
  if (!u) return 'Sistema';
  const texto = u.nome && u.email ? `${u.nome} (${u.email})` : u.nome || u.email || u.uid;
  return texto.slice(0, 120);
}
