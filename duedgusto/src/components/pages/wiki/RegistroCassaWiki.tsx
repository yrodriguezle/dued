import { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

import WikiLayout, { type WikiVoceIndice } from "./WikiLayout";
import WikiSection from "./WikiSection";
import WikiTable from "./WikiTable";
import WikiCode from "./WikiCode";
import DiagramLegend from "./diagrams/DiagramLegend";
import DiagrammaModelloGiorno from "./diagrams/DiagrammaModelloGiorno";
import DiagrammaModelloMese from "./diagrams/DiagrammaModelloMese";
import DiagrammaPercorsiScrittura from "./diagrams/DiagrammaPercorsiScrittura";
import DiagrammaStati from "./diagrams/DiagrammaStati";

const INDICE: WikiVoceIndice[] = [
  { id: "panoramica", titolo: "Che problema risolve" },
  { id: "modello-giorno", titolo: "Il giorno" },
  { id: "quadratura", titolo: "Le quattro formule" },
  { id: "spese", titolo: "Le due specie di spesa" },
  { id: "iva", titolo: "L'IVA" },
  { id: "modello-mese", titolo: "Il mese" },
  { id: "scritture", titolo: "Chi scrive cosa" },
  { id: "stati", titolo: "Stati e lucchetti" },
  { id: "tabelle", titolo: "Le tabelle" },
  { id: "codice", titolo: "Dove vive nel codice" },
];

/** Paragrafo di testo della voce, con la stessa misura di riga ovunque. */
function P({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="body2"
      sx={{ mb: 1.5, maxWidth: 900, lineHeight: 1.7 }}
    >
      {children}
    </Typography>
  );
}

/**
 * Prima voce della wiki: come è fatto il modulo cassa.
 *
 * È scritta per chi deve capire il sistema senza aprire i sorgenti: i diagrammi
 * mostrano le classi e le loro relazioni, il testo spiega il perché delle scelte,
 * e le ultime due sezioni fanno da mappa verso tabelle e file.
 */
function RegistroCassaWiki() {
  return (
    <WikiLayout
      occhiello="Wiki · Gestione cassa"
      titolo="Registro Cassa e Chiusura Mensile"
      sommario="Come è costruito il cuore contabile del gestionale: una riga per ogni giornata, quattro formule di quadratura che replicano il foglio di chiusura, e una chiusura mensile che non copia i numeri ma li ricalcola dai giorni che contiene."
      indice={INDICE}
    >
      <WikiSection
        id="panoramica"
        titolo="1. Che problema risolve"
        occhiello="Una domanda sola, ripetuta ogni sera."
      >
        <P>
          Alla chiusura del locale c'è una domanda a cui bisogna rispondere: i contanti fisicamente presenti in cassa tornano con quello che è stato dichiarato? Il modulo esiste per rispondere a
          questa domanda ogni giorno, e poi per tirare le somme a fine mese.
        </P>
        <P>
          La logica non è stata inventata da zero: ricalca il foglio di calcolo di chiusura che il locale già usava. Le quattro grandezze di quadratura portano ancora nel codice il riferimento alle
          colonne del foglio (<WikiCode>Y</WikiCode>, <WikiCode>AD</WikiCode>, <WikiCode>AE</WikiCode>, <WikiCode>AG</WikiCode>), e il foglio resta il riferimento: se un numero diverge, è il
          gestionale ad avere torto.
        </P>
        <P>
          Da questa scelta discende tutto il resto. Il modello non è "elegante" in astratto: è fedele. Dove il foglio tiene due grandezze indipendenti, il codice le tiene indipendenti anche quando
          sembrerebbe naturale derivarne una dall'altra.
        </P>
      </WikiSection>

      <WikiSection
        id="modello-giorno"
        titolo="2. Il giorno: RegistroCassa e ciò che gli appartiene"
        occhiello="Una riga per giornata, e quattro collezioni che pendono da lì."
      >
        <P>
          <WikiCode>RegistroCassa</WikiCode> è la radice: esiste al massimo una riga per data. Tutto ciò che riguarda quella giornata — la conta fisica dei soldi, le spese, i pagamenti ai fornitori,
          le vendite — è agganciato a lei e non ha vita propria.
        </P>

        <DiagrammaModelloGiorno />
        <DiagramLegend
          voci={[
            { tone: "root", testo: "radice: il centro del modello" },
            { tone: "entity", testo: "entità persistita" },
            { tone: "derived", testo: "derivata: ricalcolata, mai scritta a mano" },
            { tone: "external", testo: "contorno: enum, JSON o altri domini" },
          ]}
        />

        <P>
          Le <strong>quattro collezioni</strong> hanno ciascuna un mestiere diverso. <WikiCode>ConteggioMoneta</WikiCode> registra la conta fisica taglio per taglio, due volte al giorno: il flag{" "}
          <WikiCode>IsApertura</WikiCode> distingue la conta di apertura da quella di chiusura, e la somma dei sottototali produce <WikiCode>TotaleApertura</WikiCode> e{" "}
          <WikiCode>TotaleChiusura</WikiCode>. <WikiCode>SpesaCassa</WikiCode> e <WikiCode>PagamentoFornitore</WikiCode> sono le due specie di spesa, che meritano una sezione a parte.{" "}
          <WikiCode>Vendita</WikiCode> è la riga di vendita dettagliata, con lo snapshot dell'aliquota copiato dal prodotto al momento della vendita: se domani il prodotto cambia aliquota, la vendita
          di ieri resta come era.
        </P>
        <P>
          <WikiCode>RegistroCassaIva</WikiCode> è diverso dagli altri: nessuno lo scrive a mano. Viene cancellato e riscritto per intero a ogni ricalcolo del registro, e per questo nel diagramma è
          marcato come derivato.
        </P>
      </WikiSection>

      <WikiSection
        id="quadratura"
        titolo="3. Le quattro formule della quadratura"
        occhiello="Sono la traduzione letterale di quattro colonne del foglio."
      >
        <P>
          Queste quattro grandezze sono l'esito della giornata. Vengono calcolate in un metodo solo, e chiunque tocchi spese o pagamenti deve ripassare da lì — è la ragione per cui il{" "}
          <Link href="#scritture">diagramma dei percorsi di scrittura</Link> converge tutto su un punto.
        </P>

        <WikiTable
          aria-label="Formule di quadratura del registro cassa"
          intestazioni={["Campo", "Foglio", "Formula", "Che cosa dice"]}
          righe={[
            [<WikiCode key="c">ContanteNetto</WikiCode>, "Y", <WikiCode key="f">TotaleChiusura − TotaleApertura</WikiCode>, "Il contante fisicamente entrato in cassa nella giornata."],
            [
              <WikiCode key="c">RestoFornitore</WikiCode>,
              "AD",
              <WikiCode key="f">IncassoContanteTracciato − SpeseFornitori</WikiCode>,
              "Quanto resta del contante dichiarato dopo aver pagato i fornitori.",
            ],
            [<WikiCode key="c">Ecc</WikiCode>, "AE", <WikiCode key="f">ContanteNetto − IncassoContanteTracciato</WikiCode>, "Contante entrato in più rispetto a quello dichiarato: l'eccedenza."],
            [<WikiCode key="c">Resto</WikiCode>, "AG", <WikiCode key="f">Ecc − SpeseGiornaliere</WikiCode>, "L'eccedenza al netto delle spese pagate in contanti con scontrino."],
          ]}
        />

        <Alert
          severity="info"
          sx={{ my: 2, maxWidth: 900 }}
        >
          <WikiCode>Resto</WikiCode> non deriva da <WikiCode>RestoFornitore</WikiCode>, anche se i nomi lo suggeriscono. Nel foglio sono due grandezze indipendenti: una guarda i fornitori, l'altra
          l'eccedenza di cassa. Tenerle separate è voluto.
        </Alert>

        <P>
          Accanto a queste c'è <WikiCode>TotaleVendite</WikiCode>, che risponde a una domanda diversa — quanto ha incassato il locale, non quanto contante c'è nel cassetto:
        </P>
        <WikiCode blocco>{"TotaleVendite = (TotaleChiusura − TotaleApertura) + IncassiElettronici + IncassiFattura"}</WikiCode>
        <P>
          Il primo addendo è il movimento fisico di cassa; gli altri due sono i canali che non passano dal cassetto. Anche questo numero non viene mai scritto dall'utente: lo ricalcola il codice a
          ogni salvataggio.
        </P>
      </WikiSection>

      <WikiSection
        id="spese"
        titolo="4. Le due specie di spesa"
        occhiello="Non è una distinzione tecnica: cambia in quale formula la spesa finisce."
      >
        <P>
          Il sistema distingue le spese in base a come sono state pagate, e la distinzione ha una conseguenza contabile diretta: le due specie entrano in due formule diverse e non vanno mai sommate
          insieme.
        </P>

        <WikiTable
          aria-label="Differenze fra spese tracciate e non tracciate"
          intestazioni={["", "SpesaCassa", "PagamentoFornitore"]}
          righe={[
            ["Tabella", <WikiCode key="t">SpeseCassa</WikiCode>, <WikiCode key="t">PagamentiFornitori</WikiCode>],
            ["Come è stata pagata", "In contanti, presa dal cassetto", "In modo tracciato: bonifico, carta, assegno"],
            ["Totale che alimenta", <WikiCode key="s">SpeseGiornaliere</WikiCode>, <WikiCode key="s">SpeseFornitori</WikiCode>],
            ["Formula in cui entra", "Resto (AG)", "RestoFornitore (AD)"],
            ["Documento collegato", "Nessuno: al massimo uno scontrino", "Fattura d'acquisto o DDT, quando c'è"],
            ["Categoria", "Sempre valorizzata, di default Altro", "Solo per le spese fisse tracciate; vuota sui pagamenti documentali"],
          ]}
        />

        <P>
          Un <WikiCode>PagamentoFornitore</WikiCode> può nascere in due modi. Il caso normale è che accompagni un documento: si paga una fattura o un DDT, e il pagamento resta legato a quel documento.
          Il secondo caso sono le <strong>spese fisse tracciate</strong> — affitto, stipendi, utenze — che non hanno un documento da cui ricavare la causale. Per questo la riga ha due campi di testo
          distinti: <WikiCode>Descrizione</WikiCode> porta la causale e <WikiCode>Note</WikiCode> resta libera per le annotazioni. Prima erano lo stesso campo, e annotare una riga significava
          cancellarne la causale.
        </P>
      </WikiSection>

      <WikiSection
        id="iva"
        titolo="5. L'IVA: righe esatte e riga stimata"
        occhiello="Solo una parte dell'incasso è dettagliata: il resto va stimato, e si vede."
      >
        <P>
          Non tutto l'incasso passa da righe di vendita dettagliate: una parte viene dichiarata come totale, per canale. Il breakdown IVA tiene conto di questa asimmetria producendo due tipi di riga.
        </P>
        <P>
          Le <strong>righe esatte</strong> nascono dalle <WikiCode>Vendite</WikiCode> effettivamente registrate: si raggruppano per aliquota — quella dello snapshot, non quella attuale del prodotto —
          e se ne sommano gli scorpori. La <strong>riga stimata</strong> copre il residuo non dettagliato, scorporato all'aliquota di default presa da <WikiCode>BusinessSettings</WikiCode>. È marcata
          con il flag <WikiCode>Stimato</WikiCode> e nell'interfaccia compare con l'etichetta "stimato": non è un dettaglio cosmetico, è la dichiarazione che quel numero è una stima.
        </P>
        <P>
          Tre invarianti tengono in piedi il calcolo. Le righe vengono <strong>cancellate e riscritte per intero</strong> a ogni ricalcolo, così non restano mai residui di calcoli precedenti.{" "}
          <WikiCode>ImportoIva</WikiCode> del registro è <strong>sempre</strong> la somma delle imposte del breakdown, mai un valore calcolato per conto proprio. E se il residuo risultasse negativo —
          più vendite dettagliate del totale dichiarato — viene portato a zero e la cosa finisce nei log come warning, invece di generare una riga IVA negativa.
        </P>
      </WikiSection>

      <WikiSection
        id="modello-mese"
        titolo="6. Il mese: la chiusura mensile"
        occhiello="Non contiene numeri. Contiene riferimenti, e somma al momento della lettura."
      >
        <P>
          La scelta di fondo di <WikiCode>ChiusuraMensile</WikiCode> è che <strong>non memorizza nessun totale</strong>. Ricavi, contanti, elettronici, IVA, differenze di cassa: sono tutte proprietà
          calcolate a runtime sommando i registri collegati. La tabella <WikiCode>ChiusureMensili</WikiCode> contiene anno, mese, stato e poco altro.
        </P>

        <DiagrammaModelloMese />
        <DiagramLegend
          voci={[
            { tone: "root", testo: "radice del mese" },
            { tone: "join", testo: "tabella ponte" },
            { tone: "service", testo: "classe di servizio" },
            { tone: "external", testo: "configurazione o dato non tabellare" },
          ]}
        />

        <P>
          Il collegamento passa da <WikiCode>RegistroCassaMensile</WikiCode>, una tabella ponte con un campo in più: <WikiCode>Incluso</WikiCode>. Serve a togliere un giorno dai totali senza
          sciogliere il legame — l'esclusione è reversibile e resta tracciata.
        </P>

        <Typography
          variant="subtitle2"
          fontWeight={600}
          sx={{ mt: 3, mb: 1 }}
        >
          La bozza è una vista viva, non una fotografia
        </Typography>
        <P>
          Finché la chiusura è in <WikiCode>BOZZA</WikiCode>, a ogni lettura i suoi registri vengono riallineati a <em>tutti</em> i registri di quel mese, qualunque sia il loro stato — comprese le
          bozze. Questo è il motivo per cui i totali della chiusura coincidono per costruzione con quelli della Vista Mensile: guardano lo stesso insieme.
        </P>
        <P>
          Vengono inclusi anche i registri "leggeri", quelli creati automaticamente solo per ospitare una spesa fissa su un giorno altrimenti scoperto. Senza di loro quelle spese sparirebbero dalla
          griglia. Un'esclusione manuale, però, sopravvive alla sincronizzazione: il flag <WikiCode>Incluso</WikiCode> di un collegamento già esistente non viene mai toccato.
        </P>
        <P>
          <strong>La fotografia nasce alla transizione</strong> <WikiCode>BOZZA → CHIUSA</WikiCode>. Da quel momento la sincronizzazione smette di intervenire e i collegamenti restano congelati: la
          chiusura diventa il documento di quel mese.
        </P>

        <Typography
          variant="subtitle2"
          fontWeight={600}
          sx={{ mt: 3, mb: 1 }}
        >
          Cosa serve per chiudere davvero
        </Typography>
        <P>
          Prima di consentire la chiusura, il sistema elenca i giorni <em>operativi</em> del mese privi di un registro chiuso. Quali giorni siano operativi non è una costante: lo decidono i periodi di
          programmazione, con le impostazioni globali come ripiego quando non c'è nessun periodo che copre la data, e con i giorni non lavorativi — ricorrenti o una tantum — come eccezione.
        </P>
        <P>
          I giorni che restano scoperti per una ragione legittima si dichiarano tali: finiscono in <WikiCode>GiorniEsclusi</WikiCode>, un JSON dentro la riga della chiusura, con motivo, note e autore
          dell'esclusione. Se dopo aver sottratto gli esclusi resta anche un solo giorno scoperto, la chiusura fallisce. Fallisce anche se il ricavo totale è zero, che di norma significa registri
          collegati male.
        </P>
        <P>
          Un ultimo controllo scatta <em>dopo</em> la chiusura ed è volutamente non bloccante: se nel mese esistono registri chiusi che non sono finiti nella chiusura, il sistema lo segnala come
          avviso e lo scrive nei log, ma non annulla nulla.
        </P>

        <Alert
          severity="info"
          sx={{ my: 2, maxWidth: 900 }}
        >
          Il totale delle differenze di cassa del mese esclude i registri "a sole spese" — quelli senza vendite e con apertura uguale a chiusura. Il loro <WikiCode>Resto</WikiCode> è un artefatto del
          calcolo, non un ammanco reale, e sommarlo falserebbe il dato.
        </Alert>
      </WikiSection>

      <WikiSection
        id="scritture"
        titolo="7. Chi scrive cosa"
        occhiello="Tre strade diverse arrivano allo stesso giorno. Devono lasciarlo nello stesso stato."
      >
        <P>
          Lo stesso registro può essere modificato dalla pagina della giornata, dalla griglia spese della chiusura mensile o dalla pagina delle fatture. Sono tre percorsi con esigenze diverse, e il
          rischio evidente è che ognuno ricalcoli la quadratura a modo suo.
        </P>

        <DiagrammaPercorsiScrittura />
        <DiagramLegend
          voci={[
            { tone: "external", testo: "mutation GraphQL" },
            { tone: "service", testo: "orchestrator o service" },
            { tone: "root", testo: "fonte unica della quadratura" },
            { tone: "derived", testo: "calcolo derivato" },
          ]}
        />

        <P>
          <WikiCode>mutateRegistroCassa</WikiCode> salva la giornata intera: conteggi, spese e righe IVA vengono <strong>sostituiti in blocco</strong>, cancellati e riscritti. I pagamenti fornitori
          no: quelli seguono un confronto per identificativo — cosa è sparito, cosa è cambiato, cosa è nuovo — perché sono legati a documenti che non devono essere toccati. Cancellare un pagamento
          ricalcola lo stato della fattura collegata, ma non cancella la fattura.
        </P>
        <P>
          <WikiCode>mutateSpesaCassa</WikiCode> esiste perché la griglia spese della chiusura mensile lavora una riga alla volta, su un giorno che sceglie l'utente: il salvataggio in blocco non
          andrebbe bene, perché perderebbe gli identificativi delle righe. Ha due particolarità. Se il giorno scelto non ha un registro, lo crea in bozza. E non pretende che il giorno sia operativo —
          una spesa fissa deve poter cadere anche di lunedì, a locale chiuso. Se una spesa viene spostata su un altro giorno, vengono ricalcolati entrambi i registri: senza questo, quello di partenza
          resterebbe con le spese gonfiate.
        </P>
        <P>
          <WikiCode>RegistroCassaSyncService</WikiCode> copre il caso in cui il pagamento nasce fuori dalla cassa, dalla pagina delle fatture. Qui viveva una copia divergente delle formule, e la
          quadratura di un giorno finiva per dipendere da quale schermata lo avesse toccato per ultima. Oggi delega alla fonte unica.
        </P>
        <P>
          Le mutation di chiusura e riapertura sono le uniche che <strong>non</strong> ricalcolano niente: cambiano solo lo stato. Un dettaglio comune a tutte: gli eventi che notificano gli altri
          client vengono pubblicati <em>dopo</em> il commit della transazione, mai durante, così nessuno legge dati che potrebbero ancora essere annullati.
        </P>
      </WikiSection>

      <WikiSection
        id="stati"
        titolo="8. Stati e lucchetti"
        occhiello="Lo stato è l'unico meccanismo di protezione del dominio."
      >
        <DiagrammaStati />

        <P>
          Il giorno nasce in <WikiCode>DRAFT</WikiCode> e passa a <WikiCode>CLOSED</WikiCode>. Da lì si può tornare indietro, ma solo con un privilegio amministrativo: la riapertura serve a correggere
          dati sbagliati, tipicamente importazioni incomplete, e non è un'operazione ordinaria.
        </P>
        <P>
          <WikiCode>RECONCILED</WikiCode> e <WikiCode>RICONCILIATA</WikiCode> sono stati previsti dal modello che <strong>nessuna operazione assegna</strong>. Il codice li conosce solo per bloccare:
          un registro riconciliato non si riapre e non accetta modifiche alle spese. Sono un posto già apparecchiato per la riconciliazione contabile, non una funzione esistente.
        </P>
        <P>Tre guardie proteggono le scritture, e vale la pena distinguerle perché non si applicano tutte allo stesso modo:</P>

        <WikiTable
          aria-label="Guardie applicate alle operazioni sulla cassa"
          intestazioni={["Guardia", "Cosa impedisce", "Dove non si applica"]}
          righe={[
            ["Mese chiuso", "Qualsiasi modifica a un giorno che ricade in un mese CHIUSA o RICONCILIATA.", "Nessuna eccezione: vale per registri, spese e pagamenti."],
            ["Giorno operativo", "Creare o chiudere un registro in un giorno di chiusura del locale.", "Le spese fisse: possono cadere anche su un giorno non operativo."],
            ["Amministratore", "Riaprire un registro già chiuso.", "Solo questa operazione la richiede."],
          ]}
        />

        <Alert
          severity="info"
          sx={{ my: 2, maxWidth: 900 }}
        >
          Il privilegio amministrativo viene dal flag <WikiCode>Amministratore</WikiCode> sul ruolo, gestito dall'anagrafica ruoli — <strong>non</strong> dal nome del ruolo. Rinominare un ruolo non
          deve spostare permessi. È lo stesso flag che decide chi vede questa wiki.
        </Alert>
      </WikiSection>

      <WikiSection
        id="tabelle"
        titolo="9. Le tabelle coinvolte"
        occhiello="Cosa c'è a database, e a cosa è legato."
      >
        <WikiTable
          aria-label="Tabelle del dominio cassa"
          minWidth={760}
          intestazioni={["Tabella", "Classe", "Cosa contiene", "Legata a"]}
          righe={[
            [<WikiCode key="t">RegistriCassa</WikiCode>, "RegistroCassa", "Una riga per giornata: totali, quadratura, stato.", "La radice: tutto il resto punta qui"],
            [<WikiCode key="t">ConteggiMoneta</WikiCode>, "ConteggioMoneta", "Conta fisica per taglio, in apertura e in chiusura.", "RegistriCassa, DenominazioniMoneta"],
            [<WikiCode key="t">DenominazioniMoneta</WikiCode>, "DenominazioneMoneta", "I tagli disponibili: monete e banconote.", "—"],
            [<WikiCode key="t">SpeseCassa</WikiCode>, "SpesaCassa", "Spese non tracciate, pagate in contanti.", "RegistriCassa"],
            [<WikiCode key="t">PagamentiFornitori</WikiCode>, "PagamentoFornitore", "Spese tracciate, con o senza documento.", "RegistriCassa, FattureAcquisto, DocumentiTrasporto"],
            [<WikiCode key="t">FattureAcquisto</WikiCode>, "FatturaAcquisto", "Fatture d'acquisto e loro stato di pagamento.", "Fornitori"],
            [<WikiCode key="t">DocumentiTrasporto</WikiCode>, "DocumentoTrasporto", "Documenti di trasporto.", "Fornitori"],
            [<WikiCode key="t">Fornitori</WikiCode>, "Fornitore", "Anagrafica fornitori, con aliquota IVA abituale.", "—"],
            [<WikiCode key="t">Vendite</WikiCode>, "Vendita", "Righe di vendita con lo snapshot dell'aliquota.", "RegistriCassa, Prodotti"],
            [<WikiCode key="t">Prodotti</WikiCode>, "Prodotto", "Anagrafica prodotti e aliquota corrente.", "—"],
            [<WikiCode key="t">RegistriCassaIva</WikiCode>, "RegistroCassaIva", "Breakdown IVA per aliquota. Rigenerato a ogni calcolo.", "RegistriCassa"],
            [<WikiCode key="t">ChiusureMensili</WikiCode>, "ChiusuraMensile", "Una riga per mese: stato, giorni esclusi, chi ha chiuso.", "Utenti"],
            [<WikiCode key="t">RegistriCassaMensili</WikiCode>, "RegistroCassaMensile", "Quali registri stanno in quale chiusura, e se contano.", "ChiusureMensili, RegistriCassa"],
            [<WikiCode key="t">BusinessSettings</WikiCode>, "BusinessSettings", "Aliquota di default e giorni operativi globali.", "—"],
            [<WikiCode key="t">PeriodiProgrammazione</WikiCode>, "PeriodoProgrammazione", "Giorni operativi validi in un intervallo di date.", "—"],
            [<WikiCode key="t">GiorniNonLavorativi</WikiCode>, "GiornoNonLavorativo", "Chiusure a calendario, ricorrenti o una tantum.", "—"],
          ]}
        />

        <P>
          Due cose che sembrano tabelle ma non lo sono: <WikiCode>CategoriaSpesa</WikiCode> è un enum del codice (Affitto, Utenze, Stipendi, Altro), e <WikiCode>GiornoEscluso</WikiCode> è una classe
          che vive serializzata in JSON dentro la colonna <WikiCode>GiorniEsclusi</WikiCode> della chiusura.
        </P>
      </WikiSection>

      <WikiSection
        id="codice"
        titolo="10. Dove vive nel codice"
        occhiello="Per quando serve andare a vedere davvero."
      >
        <WikiTable
          aria-label="Mappa delle classi principali sui file del backend"
          minWidth={720}
          intestazioni={["Classe", "File", "Ruolo"]}
          righe={[
            [
              "MutateRegistroCassaOrchestrator",
              <WikiCode key="f">GraphQL/GestioneCassa/</WikiCode>,
              <span key="r">
                Salvataggio della giornata. Contiene <strong>CalcolaTotali</strong>: la fonte unica delle quattro formule.
              </span>,
            ],
            ["MutateSpesaCassaOrchestrator", <WikiCode key="f">GraphQL/GestioneCassa/</WikiCode>, "Spese non tracciate, una riga alla volta."],
            ["BreakdownIvaApplier", <WikiCode key="f">GraphQL/GestioneCassa/</WikiCode>, "Punto di calcolo unico di TotaleVendite e delle righe IVA."],
            ["GestioneCassaGuards", <WikiCode key="f">GraphQL/GestioneCassa/</WikiCode>, "Le tre guardie: mese chiuso, giorno operativo, amministratore."],
            ["ChiudiRegistroCassaOrchestrator", <WikiCode key="f">GraphQL/GestioneCassa/</WikiCode>, "DRAFT → CLOSED."],
            ["RiapriRegistroCassaOrchestrator", <WikiCode key="f">GraphQL/GestioneCassa/</WikiCode>, "CLOSED → DRAFT, riservato agli amministratori."],
            ["ChiusuraMensileService", <WikiCode key="f">Services/ChiusureMensili/</WikiCode>, "Crea e chiude il mese; riallinea la bozza a ogni lettura."],
            ["ChiusuraMensileValidator", <WikiCode key="f">Services/ChiusureMensili/</WikiCode>, "Elenca i giorni operativi scoperti del mese."],
            ["RegistroCassaSyncService", <WikiCode key="f">Services/Fornitori/</WikiCode>, "Riallinea il registro quando il pagamento nasce dalle fatture."],
            ["RiepilogoCards", <WikiCode key="f">components/pages/registrazioneCassa/</WikiCode>, "Lato frontend, il riferimento vivo delle formule del foglio."],
          ]}
        />

        <Alert
          severity="warning"
          sx={{ my: 2, maxWidth: 900 }}
        >
          Se un giorno le quattro formule vanno cambiate, il posto è uno solo: <WikiCode>CalcolaTotali</WikiCode>. Ogni copia della formula altrove è un bug in attesa — è già successo, ed è il motivo
          per cui oggi tutti i percorsi di scrittura convergono lì.
        </Alert>
      </WikiSection>
    </WikiLayout>
  );
}

export default RegistroCassaWiki;
