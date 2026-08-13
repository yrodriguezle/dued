// Prove 6.4/6.5/6.6 — ciò che succede SOLO nel browser.
//
// Il test automatico dimostra che nell'HTML servito non c'è né il tema né lo stato di
// apertura. Questa dimostra l'altra metà: che nel browser ci sono, e che il toggle gira i
// tre stati. Senza, «non è nell'HTML» sarebbe compatibile con «non c'è affatto».
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const INDIRIZZO = process.argv[2] ?? 'http://127.0.0.1:4399/';
const cartella = new URL('.', import.meta.url).pathname.slice(1);

const browser = await chromium.launch();
// Fuso volutamente lontano: il registro deve seguire l'ora di ROMA, non quella del
// visitatore. È anche la ricetta della prova 12.6.
const contesto = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
const pagina = await contesto.newPage();
await pagina.goto(INDIRIZZO, { waitUntil: 'networkidle' });

const stato = async () => ({
  tema: await pagina.getAttribute('html', 'data-tema'),
  pronto: (await pagina.getAttribute('html', 'data-pronto')) !== null,
  etichetta: (await pagina.textContent('#tema-etichetta'))?.trim(),
  badge: (await pagina.isVisible('#stato-apertura'))
    ? (await pagina.textContent('#stato-apertura'))?.trim()
    : '(nascosto)',
});

const ora = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date());
console.log(`Fuso del browser: America/Los_Angeles — ora di Roma: ${ora}`);
console.log('all\'apertura       ', await stato());
await pagina.screenshot({ path: cartella + '6.5-auto.png', fullPage: true });

for (const atteso of ['giorno', 'sera', 'auto']) {
  await pagina.click('#tema-switch');
  const s = await stato();
  console.log(`dopo un clic → ${atteso.padEnd(7)}`, s);
  await pagina.screenshot({ path: `${cartella}6.5-${atteso}.png`, fullPage: true });
}

// E la scelta sopravvive al ricaricamento: è in localStorage.
await pagina.click('#tema-switch');
await pagina.reload({ waitUntil: 'networkidle' });
console.log('dopo un reload     ', await stato());

await browser.close();
