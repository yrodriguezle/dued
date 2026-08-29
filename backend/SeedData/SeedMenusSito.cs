using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

/// <summary>
/// Voci di menu della sezione "Sito" — amministrazione del sito vetrina.
///
/// <para>File separato da <see cref="SeedMenus"/>, che è già oltre le 900 righe: la logica
/// condivisa (<see cref="SeedMenus.UpdateMenuIfNeeded"/> e <see cref="SeedMenus.AssegnaRuoli"/>)
/// viene riusata, non copiata — due implementazioni della stessa idempotenza divergerebbero
/// al primo bugfix applicato a una sola.</para>
///
/// <para>🔴 <b>L'ordine del sottomenu è deliberato: prima le PAGINE del sito, poi le risorse
/// trasversali.</b> Fino a questo change la sezione elencava quattro <i>entità</i> — media,
/// prodotti, impostazioni, recensioni — e chi voleva sapere «cosa c'è sulla pagina del locale»
/// non aveva alcun posto dove guardarlo. Adesso ogni pagina del sito ha la sua voce, con
/// <b>la stessa etichetta che il sito le dà</b> (<c>sito/src/lib/rotte.ts</c>), e le risorse
/// vengono dopo. Il valore del change è l'ordine, non l'aggiunta: appendere le pagine in coda
/// avrebbe rimesso «Libreria media» prima di «Home», cioè l'ordinamento per entità che questa
/// sezione esiste per rovesciare.</para>
///
/// <para>⚠️ <b>L'etichetta «Menu» resta identica a quella del sito</b>, benché il gestionale
/// abbia già una sezione «Menu» (l'anagrafica delle voci di navigazione). La collisione si
/// risolve con l'annidamento sotto «Sito» e con l'icona <c>UtensilsCrossed</c>, non
/// rinominando: rispecchiare il sito è il punto di questa sezione, e «Pagina Menu» romperebbe
/// la corrispondenza uno-a-uno con le etichette che il visitatore legge.</para>
///
/// <para>⚠️ <b>I percorsi delle pagine stanno sotto <c>pagine/</c></b> e non direttamente sotto
/// <c>sito/</c>: <c>/gestionale/sito/media</c> esiste già, e un <c>/gestionale/sito/menu</c>
/// accanto sarebbe indistinguibile da una risorsa. Il segmento dice a chi legge un URL di che
/// genere di scheda si tratta.</para>
///
/// <para>🔴 <b>I <c>Percorso</c> sono le chiavi di idempotenza</b>: le quattro voci preesistenti
/// conservano il proprio, quindi il riordino le aggiorna e non le ricrea. Cambiarne uno
/// creerebbe una voce nuova e lascerebbe la vecchia orfana in navigazione.</para>
/// </summary>
public static class SeedMenusSito
{
    /// <summary>
    /// Una voce figlia della sezione "Sito": creata se manca, allineata se c'è.
    ///
    /// <para>🔴 <b>Un helper e nove chiamate</b>, al posto di nove blocchi fotocopiati. Prima di
    /// questo change i blocchi erano quattro e già quasi identici; portarli a nove avrebbe fatto
    /// del file cinquecento righe di copie, e nove copie della stessa idempotenza divergono al
    /// primo bugfix applicato a una sola — che è, alla lettera, la ragione scritta nella
    /// docstring di questo file per cui <see cref="SeedMenus.UpdateMenuIfNeeded"/> è riusata.</para>
    ///
    /// <para>⚠️ La voce si cerca per <c>Percorso</c>, come le altre: è ciò che rende innocuo
    /// riavviare. Il titolo <b>non</b> è una chiave — cambiarlo deve rinominare la voce, non
    /// crearne una seconda.</para>
    ///
    /// <para>⚠️ <paramref name="visibile"/> è esplicito e vale sempre <c>true</c> oggi. Resta un
    /// parametro perché è la leva di rollback dichiarata dal piano: portarlo a <c>false</c> fa
    /// sparire una voce dalla navigazione <b>senza cancellare alcun record</b>.</para>
    /// </summary>
    private static async Task UpsertVoceSitoAsync(
        AppDbContext dbContext, Menu padre, List<Ruolo> ruoli, Ruolo superAdminRuolo,
        string titolo, string percorso, string icona, bool visibile, int posizione,
        string nomeVista, string percorsoFile)
    {
        Menu? voce = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == percorso);

        if (voce == null)
        {
            voce = new Menu
            {
                Titolo = titolo,
                Percorso = percorso,
                Icona = icona,
                Visibile = visibile,
                Posizione = posizione,
                NomeVista = nomeVista,
                PercorsoFile = percorsoFile,
                MenuPadreId = padre.Id
            };
            bool assegnazioneIniziale = false;
            SeedMenus.AssegnaRuoli(voce, ruoli, ref assegnazioneIniziale);
            dbContext.Menus.Add(voce);
            return;
        }

        bool needsUpdate = false;
        SeedMenus.UpdateMenuIfNeeded(voce, titolo, percorso, icona, visibile, posizione,
            nomeVista, percorsoFile, superAdminRuolo, padre, ref needsUpdate);
        SeedMenus.AssegnaRuoli(voce, ruoli, ref needsUpdate);
        if (needsUpdate)
        {
            dbContext.Menus.Update(voce);
        }
    }

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Ruolo? superAdminRuolo = await dbContext.Ruoli
            .Include(r => r.Menus)
            .FirstOrDefaultAsync(r => r.Nome == "SuperAdmin");
        if (superAdminRuolo == null)
        {
            return;
        }

        // ========================================
        // Menu Sito — amministrazione della vetrina pubblica
        // ========================================
        // Come la Wiki, questa sezione NON va al solo SuperAdmin ma a ogni ruolo con il
        // flag Amministratore: è lo stesso privilegio che il backend pretende sulle
        // mutation della vetrina e sulla lettura di connection { mediaAssets }.
        // Il SuperAdmin è incluso esplicitamente perché la sezione resti raggiungibile
        // anche se il flag venisse tolto per errore dall'anagrafica ruoli.
        // Il menu è il primo filtro, non l'unico: la sicurezza vera è il guard backend.
        List<Ruolo> ruoliSito = await dbContext.Ruoli
                .Include(r => r.Menus)
                .Where(r => r.Amministratore || r.Nome == "SuperAdmin")
                .ToListAsync();

        // ⚠️ Il padre si cerca per Titolo + Percorso vuoto, non per il solo percorso:
        // tutti i menu padre hanno Percorso == string.Empty e sarebbero indistinguibili
        // fra loro. I figli, che un percorso ce l'hanno, si cercano invece per Percorso.
        Menu? sitoMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Titolo == "Sito" && m.Percorso == string.Empty);

        if (sitoMenu == null)
        {
            sitoMenu = new Menu
            {
                Titolo = "Sito",
                Percorso = string.Empty,
                Icona = "Globe",
                Visibile = true,
                Posizione = 10,
                NomeVista = string.Empty,
                PercorsoFile = string.Empty,
                MenuPadreId = null
            };
            bool assegnazioneIniziale = false;
            SeedMenus.AssegnaRuoli(sitoMenu, ruoliSito, ref assegnazioneIniziale);
            dbContext.Menus.Add(sitoMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere Id
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(sitoMenu, "Sito", null, "Globe", true, 10, null, null, superAdminRuolo, null, ref needsUpdate);
            SeedMenus.AssegnaRuoli(sitoMenu, ruoliSito, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(sitoMenu);
                await dbContext.SaveChangesAsync();
            }
        }

        // ── Le cinque pagine del sito, nell'ordine in cui il visitatore le incontra ──────────
        //
        // 🔴 Le etichette sono IDENTICHE, carattere per carattere, a quelle di
        //    `sito/src/lib/rotte.ts`, che resta la sorgente unica dell'elenco delle pagine: il
        //    pannello la rispecchia, non la duplica. `sito/test/schede-pannello.test.mjs`
        //    confronta le due liste e diventa rosso se divergono in un verso o nell'altro.
        //
        // ⚠️ Le icone sono stringhe: un nome che `iconMapping.tsx` non contiene NON dà alcun
        //    errore, la voce compare semplicemente senza icona. Le due liste vanno allineate
        //    nello stesso commit, e `iconeDelSeed.test.tsx` è ciò che rende rumoroso quel
        //    silenzio.
        //
        // ⚠️ `PercorsoFile` è relativo a duedgusto/src/components/pages/. Il caricamento
        //    dinamico usa un glob ricorsivo, quindi la sottocartella `pagine/` si risolve senza
        //    toccare il router: è la ragione per cui cinque voci non costano più di una.
        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Home", "/gestionale/sito/pagine/home", "House", true, 1,
            "PaginaHome", "sito/pagine/PaginaHome.tsx");

        // ⚠️ «Menu» e non «Pagina Menu»: vedi la docstring di classe.
        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Menu", "/gestionale/sito/pagine/menu", "UtensilsCrossed", true, 2,
            "PaginaMenu", "sito/pagine/PaginaMenu.tsx");

        // ⚠️ La voce esiste ANCHE quando la pagina del sito non esiste (testo vuoto → 404):
        // nasconderla toglierebbe l'unico posto da cui quel testo si può scrivere. È la scheda
        // a creare la pagina, non il suo riflesso.
        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Aperitivo", "/gestionale/sito/pagine/aperitivo", "Martini", true, 3,
            "PaginaAperitivo", "sito/pagine/PaginaAperitivo.tsx");

        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Il locale", "/gestionale/sito/pagine/locale", "Armchair", true, 4,
            "PaginaLocale", "sito/pagine/PaginaLocale.tsx");

        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Contatti", "/gestionale/sito/pagine/contatti", "MapPin", true, 5,
            "PaginaContatti", "sito/pagine/PaginaContatti.tsx");

        // ── Le risorse trasversali, dopo le pagine ──────────────────────────────────────────
        //
        // 🔴 I quattro `Percorso` qui sotto sono INVARIATI rispetto a prima del change: sono le
        //    chiavi di idempotenza, e il riordino cambia soltanto la `Posizione`. Titolo, vista
        //    e file restano quelli che erano.
        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Libreria media", "/gestionale/sito/media", "Images", true, 6,
            "MediaLibrary", "sito/MediaLibrary.tsx");

        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Prodotti vetrina", "/gestionale/sito/prodotti", "ShoppingBag", true, 7,
            "VetrinaProdottiList", "sito/VetrinaProdottiList.tsx");

        // ⚠️ È una voce a sé e non una scheda dentro le impostazioni, e non per abbondanza: le
        // impostazioni sono UNA riga che si compila e si salva insieme, le recensioni sono una
        // lista che si aggiunge e si riordina nel tempo. Due gesti diversi, due pagine.
        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Recensioni sito", "/gestionale/sito/recensioni", "Star", true, 8,
            "RecensioniVetrinaList", "sito/RecensioniVetrinaList.tsx");

        // ⚠️ Icona "Store" e non "Settings": quest'ultima è già la sezione Impostazioni della
        // cassa, e le due voci sarebbero indistinguibili nella barra di navigazione — proprio le
        // due che non vanno confuse, dato che gli orari si modificano solo in una delle due.
        // ⚠️ La voce NON si rinomina: dopo la riduzione ai venti campi trasversali contiene
        // esattamente ciò che «Impostazioni sito» già descrive, e il `Percorso` deve comunque
        // restare invariato perché è la chiave di idempotenza.
        await UpsertVoceSitoAsync(dbContext, sitoMenu, ruoliSito, superAdminRuolo,
            "Impostazioni sito", "/gestionale/sito/impostazioni", "Store", true, 9,
            "ImpostazioniVetrinaPage", "sito/ImpostazioniVetrinaPage.tsx");

        await dbContext.SaveChangesAsync();
    }
}
