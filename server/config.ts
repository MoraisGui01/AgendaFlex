import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

// Configurações lidas do ambiente (.env no desenvolvimento, Secrets no AI Studio / Cloud Run)

// Porta fixa: é a que o AI Studio / Cloud Run espera para este app
export const PORTA = 3000;
export const PRODUCAO = process.env.NODE_ENV === 'production';

// Sem DATABASE_URL o sistema usa SQLite local (agendaflex.db)
export const DATABASE_URL = process.env.DATABASE_URL?.trim() || null;

// Contas Google liberadas. Lista vazia = qualquer conta Google autenticada entra.
export const EMAILS_PERMITIDOS = new Set(
  (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

// O projeto Firebase é o mesmo usado pelo front-end
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8'),
) as { projectId: string };

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

// Todas as tabelas guardam a clínica; o sistema atende uma clínica por instalação
export const CLINICA_ID = 'clinica-paulista-01';
