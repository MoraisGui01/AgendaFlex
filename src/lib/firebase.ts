import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence, signInWithPopup, signOut } from 'firebase/auth';
import configuracao from '../../firebase-applet-config.json';

const app = initializeApp(configuracao);
export const auth = getAuth(app);

// Mantém a sessão depois de recarregar a página
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Alguns navegadores bloqueiam o armazenamento dentro de iframes; o login continua funcionando na aba
});

const provedorGoogle = new GoogleAuthProvider();
provedorGoogle.setCustomParameters({ prompt: 'select_account' });

export const entrarComGoogle = () => signInWithPopup(auth, provedorGoogle);
export const sairDoGoogle = () => signOut(auth);

export async function tokenAtual(renovar = false): Promise<string | null> {
  return auth.currentUser ? auth.currentUser.getIdToken(renovar) : null;
}
