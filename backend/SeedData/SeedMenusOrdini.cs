using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

/// <summary>
/// La voce di menu <b>«Ordini»</b>, sorella di «Vendita» al primo livello della sidebar.
///
/// <para>🔴 <b>Sorella e non figlia, ed è una decisione presa contro l'alternativa ovvia.</b>
/// L'elenco degli ordini aperti poteva stare sotto un contenitore «Vendite» insieme a
/// «Vendita» — struttura più ordinata, e costo di due tocchi per entrambe. Ma «Vendita» è
/// appena salita al primo livello proprio per togliere quel tocco (vedi
/// <see cref="SeedMenusVendita"/>), e rimetterlo tre giorni dopo avrebbe disfatto la promozione
/// per fare spazio a una voce nuova. Due sorelle costano una riga in più nella barra e lasciano
/// entrambe a un tocco.</para>
///
/// <para>🔴 <b>Perché la voce esiste.</b> Finora <c>OrdiniAperti</c> era un componente
/// raggiungibile da due soli posti: da dentro il punto vendita e dalla scheda del registro
/// quando la guardia blocca la chiusura. Si arrivava all'elenco <i>di reazione</i>, mai di
/// proposito — e con più ordini aperti insieme (il caso ordinario del bancone) l'elenco è il
/// posto da cui si guarda la giornata, non un rimedio a un blocco.</para>
///
/// <para>⚠️ <b><c>Posizione = 1</c> ha richiesto di rinumerare tutte le voci di primo livello.</b>
/// Erano 0..9 senza buchi, e <c>AuthenticationDataLoaders</c> ordina con
/// <c>OrderBy(m =&gt; m.Posizione)</c> <b>senza tie-break</b>: due voci a pari posizione si
/// ordinerebbero per Id, cioè per l'ordine in cui il seed le ha create — un criterio che nessuno
/// ha scelto e che cambia da un database all'altro. Le altre sono quindi salite di uno
/// (Dashboard 2, Cassa 3, Fornitori 4, Utenti 5, Ruoli 6, Menù 7, Impostazioni 8, Wiki 9,
/// Sito 10) e <c>UpdateMenuIfNeeded</c> propaga il riordino al riavvio, senza SQL a mano.</para>
///
/// <para>🔴 <b><c>ConciergeBell</c>, e la scelta è di forma prima che di nome.</b>
/// <c>iconeDelSeed</c> pretende l'unicità <b>globale</b> delle icone, e i candidati naturali
/// erano tutti pile di righe o fogli: <c>ListChecks</c> accanto a <c>List</c> (Lista fornitori),
/// <c>ReceiptText</c> accanto a <c>Receipt</c> (Lista fatture), <c>NotepadText</c> accanto a
/// <c>FileText</c>. Il test confronta i <i>nomi</i> e non se ne accorgerebbe, ma a cassetto
/// chiuso <c>NestedList</c> mette <c>opacity: 0</c> sulle etichette e l'icona <b>è</b> la voce.
/// Il campanello da bancone non somiglia a nulla di ciò che è già in mappa, ed è anche il gesto
/// giusto: è la comanda che aspetta.</para>
///
/// <para>⚠️ Il <c>Percorso</c> è <c>/gestionale/cassa/ordini</c> ed è la <b>chiave di
/// idempotenza</b> di questo seeder: cambiarlo creerebbe una voce nuova lasciando la vecchia
/// orfana in navigazione. Come per «Vendita», la gerarchia in barra e l'URL sono indipendenti —
/// <c>ProtectedRoutes.tsx</c> registra le rotte da <c>percorso</c> + <c>percorsoFile</c>, non
/// dall'albero.</para>
///
/// <para>🔴 <b>Nessuna lookup di un menu padre</b>, per la stessa ragione di
/// <see cref="SeedMenusVendita"/>: una voce di primo livello non ne ha, e una guardia
/// <c>if (padre == null) return;</c> sarebbe un fallimento silenzioso.</para>
///
/// <para>⚠️ La voce va a <b>tutti i ruoli</b>, come «Vendita»: guardare gli ordini aperti non è
/// un'operazione amministrativa. Il menu governa la sola visibilità in sidebar; i dati restano
/// protetti da <c>this.Authorize()</c> a livello di tipo su <c>VenditeQueries</c>.
/// <see cref="SeedMenus.AssegnaRuoli"/> è additivo e non toglie mai un ruolo.</para>
/// </summary>
public static class SeedMenusOrdini
{
    private const string Percorso = "/gestionale/cassa/ordini";

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

        List<Ruolo> tuttiIRuoli = await dbContext.Ruoli
                .Include(r => r.Menus)
                .ToListAsync();

        Menu? ordiniMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == Percorso);

        if (ordiniMenu == null)
        {
            ordiniMenu = new Menu
            {
                Titolo = "Ordini",
                Percorso = Percorso,
                Icona = "ConciergeBell",
                Visibile = true,
                Posizione = 1,
                NomeVista = "Ordini",
                PercorsoFile = "vendite/Ordini.tsx",
                MenuPadreId = null
            };
            bool assegnazioneIniziale = false;
            SeedMenus.AssegnaRuoli(ordiniMenu, tuttiIRuoli, ref assegnazioneIniziale);
            dbContext.Menus.Add(ordiniMenu);
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(ordiniMenu, "Ordini", Percorso, "ConciergeBell", true, 1,
                "Ordini", "vendite/Ordini.tsx", superAdminRuolo, null, ref needsUpdate);
            SeedMenus.AssegnaRuoli(ordiniMenu, tuttiIRuoli, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(ordiniMenu);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
