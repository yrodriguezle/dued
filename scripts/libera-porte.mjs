// Libera le porte dei server di sviluppo **prima** che questi partano.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// PERCHÉ ESISTE
//
// Un server rimasto acceso da una sessione precedente non si annuncia: `npm run dev` muore
// con «address already in use», e nel caso peggiore — quando a restare acceso è il sito
// costruito — non muore affatto e continua a servire la build **vecchia**, così che le
// correzioni «non hanno effetto». Qui le porte si liberano per PID, a ogni avvio, e chi
// avvia non deve né ricordarsene né sapere quale comando serve sul suo sistema operativo.
//
// ⚠️ È deliberatamente **brutale**: SIGKILL su POSIX, `Stop-Process -Force` su Windows.
//    Nessuna chiusura ordinata, perché il processo da abbattere è per definizione uno che
//    nessuno sta più guardando. Su queste tre porte girano solo i server di questo
//    progetto: se ci gira dell'altro, il numero di porta va cambiato — non questo file.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// PERCHÉ DUE RAMI PER SISTEMA OPERATIVO, e non un comando solo
//
// 🔴 `pkill`, `lsof` e `kill` **non esistono su Windows**, e da Git Bash è peggio che se non
//    esistessero: `pkill -f entry.mjs` ritorna zero senza toccare i processi Windows, cioè
//    riferisce successo dopo non aver fatto nulla. Il server resta vivo, la porta occupata,
//    e si finisce a cercare il difetto nel codice giusto. Su Windows l'unica strada è
//    PowerShell (`Get-NetTCPConnection` → `Stop-Process`).
//
// ⚠️ I due rami sono simmetrici in una cosa che conta: entrambi guardano **solo i processi
//    in ASCOLTO** (`-sTCP:LISTEN`, `-State Listen`). Senza quel filtro `lsof -ti tcp:4000`
//    restituirebbe anche i CLIENT connessi a quella porta — la scheda del browser aperta
//    sul gestionale — e questo file chiuderebbe il browser di chi sviluppa.
// ═══════════════════════════════════════════════════════════════════════════════════════
//
//   node scripts/libera-porte.mjs 4000 4001 4321
//
// Ed è anche un modulo: `import { liberaPorta } from './libera-porte.mjs'`.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const suWindows = process.platform === 'win32';

/** Le porte dei tre server di sviluppo, in un posto solo. */
export const PORTE = { backend: 4000, gestionale: 4001, sito: 4321 };

function eseguiPowerShell(comando) {
  const esito = spawnSync('powershell', ['-NoProfile', '-Command', comando], { encoding: 'utf8' });
  return esito.stdout ?? '';
}

function numeriIn(testo) {
  return [...new Set(
    testo
      .split('\n')
      .map((riga) => riga.trim())
      .filter((riga) => /^\d+$/.test(riga))
      .map(Number)
  )];
}

/**
 * I PID dei processi **in ascolto** sulla porta. Lista vuota se la porta è libera.
 *
 * ⚠️ `Select-Object -Unique` e il `Set` qui sotto non sono ridondanti fra loro: una porta in
 *    ascolto su IPv4 e IPv6 insieme produce due righe con lo stesso PID, su entrambi i
 *    sistemi. Senza deduplica si proverebbe a uccidere due volte lo stesso processo, e la
 *    seconda volta fallirebbe rumorosamente per un motivo che non è un problema.
 */
export function pidInAscolto(porta) {
  if (suWindows) {
    return numeriIn(eseguiPowerShell(
      `(Get-NetTCPConnection -LocalPort ${porta} -State Listen -ErrorAction SilentlyContinue)` +
      `.OwningProcess | Select-Object -Unique`
    ));
  }
  // `-sTCP:LISTEN` è il filtro che distingue «chi tiene la porta» da «chi ci è collegato».
  const esito = spawnSync('sh', ['-c', `lsof -ti tcp:${porta} -sTCP:LISTEN`], { encoding: 'utf8' });
  return numeriIn(esito.stdout ?? '');
}

/**
 * Libera una porta e restituisce i PID abbattuti (lista vuota se non c'era nulla).
 *
 * 🔴 Non lancia mai: una porta già libera è il caso NORMALE, non un errore. Se questa
 *    funzione fallisse su una porta libera, il gancio `predev` bloccherebbe l'avvio proprio
 *    nella condizione in cui va tutto bene.
 */
export function liberaPorta(porta) {
  const pid = pidInAscolto(porta);
  if (pid.length === 0) {
    return [];
  }

  if (suWindows) {
    eseguiPowerShell(`Stop-Process -Id ${pid.join(',')} -Force -ErrorAction SilentlyContinue`);
    return pid;
  }

  // Fra l'elenco e la firma il processo può essere morto da sé: è una corsa che si vince
  // ignorandola, non sincronizzandola.
  return pid.filter((p) => {
    try {
      process.kill(p, 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  });
}

// ── Da riga di comando ────────────────────────────────────────────────────────────────
//
// ⚠️ Il confronto con `process.argv[1]` passa da `pathToFileURL`: su Windows argv[1] è un
//    percorso con le barre rovesciate e la lettera di unità, che non è mai uguale a un
//    `import.meta.url`. Il modulo si limiterebbe a non fare nulla, in silenzio.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const porte = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);

  if (porte.length === 0) {
    console.error('Uso: node scripts/libera-porte.mjs <porta> [porta…]');
    process.exit(2);
  }

  porte.forEach((porta) => {
    const abbattuti = liberaPorta(porta);
    if (abbattuti.length > 0) {
      console.log(`🔓  porta ${porta}: liberata (PID ${abbattuti.join(', ')} terminato)`);
    }
  });
}
