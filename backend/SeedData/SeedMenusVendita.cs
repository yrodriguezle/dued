using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

/// <summary>
/// La voce di menu del <b>punto vendita</b>, al <b>primo livello</b> della sidebar.
///
/// <para>🔴 <b>Sta in <c>Posizione 0</c>, sopra Dashboard, e non è una questione di gerarchia</b>:
/// è la pagina che si apre cento volte al giorno da dietro il bancone, mentre le altre si aprono
/// una volta a sera. Finché è stata annidata sotto «Cassa» ogni vendita costava un tocco in più
/// con le mani occupate. La 0 è anche l'unico posto libero <i>sopra</i>: al primo livello
/// <see cref="SeedMenus"/> occupa già Dashboard 1, Cassa 2, Fornitori 3, Utenti 4, Ruoli 5,
/// Menù 6, Impostazioni 7, Wiki 8, Sito 9 — e
/// <c>AuthenticationDataLoaders</c> ordina con <c>OrderBy(m =&gt; m.Posizione)</c>
/// <b>senza tie-break</b>, quindi a parità con Dashboard l'ordine lo deciderebbe l'Id, cioè il caso.</para>
///
/// <para>⚠️ <b>Il <c>Percorso</c> resta <c>/gestionale/cassa/vendita</c></b> anche se la voce non
/// è più figlia di «Cassa». La gerarchia in barra e l'URL sono indipendenti:
/// <c>ProtectedRoutes.tsx</c> registra le rotte da <c>percorso</c> + <c>percorsoFile</c>, non
/// dall'albero. Rinominarlo romperebbe i segnalibri senza guadagno — ed è anche la chiave di
/// idempotenza di questo seeder, quindi cambiarlo creerebbe una voce nuova lasciando la vecchia
/// orfana in navigazione.</para>
///
/// <para>🔴 <b>Nessuna lookup del menu «Cassa».</b> Una voce di primo livello non ha padre, e la
/// vecchia guardia <c>if (cassaMenu == null) return;</c> era un fallimento silenzioso: su un
/// database in cui «Cassa» fosse stata rinominata o rimossa il seeder sarebbe uscito
/// <b>prima</b> di promuovere, e la promozione non sarebbe avvenuta mai — senza un log, senza un
/// errore.</para>
///
/// <para>🔴 <b>La voce va a TUTTI i ruoli</b>, non al solo SuperAdmin né al sottoinsieme con il
/// flag <see cref="Ruolo.Amministratore"/> (quello è il criterio di <see cref="SeedMenusSito"/>,
/// che amministra la vetrina): la vendita non è un'operazione amministrativa. Il menu governa
/// però <b>la sola visibilità della voce in sidebar</b> — l'autorizzazione dei dati è un
/// meccanismo separato e resta invariata, perché <c>VenditeQueries</c> e <c>VenditeMutations</c>
/// dichiarano <c>this.Authorize()</c> a livello di tipo. «Per chiunque» significa quindi
/// <b>chiunque sia autenticato</b>, e non apre alcun accesso anonimo.</para>
///
/// <para>⚠️ <see cref="SeedMenus.AssegnaRuoli"/> è <b>additivo</b>: non toglie mai un ruolo.
/// Allargare costa un riavvio, restringere richiederebbe SQL diretto sul database di produzione.</para>
///
/// <para>File separato da <see cref="SeedMenusProdotti"/> perché sono due cose diverse:
/// lì si cura il listino, qui si vende. Tenerli distinti costa un file e rende ovvio, aprendo
/// la cartella, che cosa esiste.</para>
/// </summary>
public static class SeedMenusVendita
{
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

        // 🔴 TUTTI i ruoli, senza filtro: vedi la docstring di classe. Il SuperAdmin è già
        //    dentro questa lista, e `UpdateMenuIfNeeded` lo riaggiunge comunque per proprio conto.
        List<Ruolo> tuttiIRuoli = await dbContext.Ruoli
                .Include(r => r.Menus)
                .ToListAsync();

        Menu? venditaMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/vendita");

        if (venditaMenu == null)
        {
            venditaMenu = new Menu
            {
                Titolo = "Vendita",
                Percorso = "/gestionale/cassa/vendita",
                // 🔴 `HandCoins` e NON `ShoppingCart`: il carrello è «Cassa», che sta al primo
                //    livello subito qui sotto. Finché «Vendita» è stata annidata dentro «Cassa» la
                //    ripetizione non si vedeva; da quando è salita accanto, a cassetto chiuso le due
                //    voci sono lo **stesso bottone** — `NestedList` mette `opacity: 0` sulle
                //    etichette, quindi lì l'icona non decora la voce, la È.
                //    ⚠️ A cambiare è «Vendita», non «Cassa»: il carrello della cassa se lo sono
                //    imparato in anni, questa voce è nuova e non l'ha ancora memorizzata nessuno.
                //    ⚠️ Un'icona assente da `iconMapping.tsx` non dà errore: la voce compare senza
                //    icona. `iconeDelSeed.test.tsx` verifica sia che esista, sia che nessun'altra
                //    voce la usi.
                Icona = "HandCoins",
                Visibile = true,
                Posizione = 0,
                NomeVista = "PuntoVendita",
                PercorsoFile = "vendite/PuntoVendita.tsx",
                MenuPadreId = null
            };
            bool assegnazioneIniziale = false;
            SeedMenus.AssegnaRuoli(venditaMenu, tuttiIRuoli, ref assegnazioneIniziale);
            dbContext.Menus.Add(venditaMenu);
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(venditaMenu, "Vendita", "/gestionale/cassa/vendita", "HandCoins", true, 0,
                "PuntoVendita", "vendite/PuntoVendita.tsx", superAdminRuolo, null, ref needsUpdate);
            SeedMenus.AssegnaRuoli(venditaMenu, tuttiIRuoli, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(venditaMenu);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
