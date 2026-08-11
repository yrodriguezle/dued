using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.SeedData;

/// <summary>
/// Crea la riga unica delle impostazioni della vetrina con i dati reali del locale.
///
/// <para>🔴 <b>Crea e non aggiorna</b>, deliberatamente e al contrario di <c>SeedMenus</c>.
/// Il seed gira a <b>ogni avvio</b>: un menu riallineato dal seed è desiderabile — la
/// navigazione è codice, non contenuto — mentre un indirizzo riscritto a ogni riavvio è
/// <b>perdita di lavoro dell'amministratore</b>, silenziosa e ripetuta. Qui non esiste alcun
/// ramo di aggiornamento, e non è una dimenticanza: è la differenza fra le due politiche,
/// decisa una volta e provata riavviando (task 4.4).</para>
///
/// <para>⚠️ <b>La conseguenza da conoscere.</b> Poiché il seed salta quando la riga esiste,
/// ogni colonna aggiunta in una fase futura <b>non riceverà mai</b> il valore scritto qui
/// sulle installazioni già avviate: prenderà il default dichiarato in
/// <c>AppDbContext.OnModelCreating</c>. Per questo i valori iniziali significativi
/// (<c>Paese</c>, <c>OraInizioTemaSera</c>, <c>PrenotazioniPreavvisoOre</c>,
/// <c>PrenotazioniCopertiMax</c>) vivono <b>nel modello</b> e non sono ripetuti qui: ripeterli
/// creerebbe una seconda scrittura dello stesso valore, e la copia del seed sarebbe quella che
/// non arriva mai dove serve.</para>
///
/// <para>🔴 <b>Nessun orario.</b> Apertura, chiusura, giorni operativi e fuso restano in
/// <see cref="BusinessSettings"/> e hanno una sola sorgente: la rotta pubblica dell'identità
/// compone le due entità. Se gli orari pubblicati sono sbagliati, si correggono dalle
/// impostazioni della cassa — non da qui.</para>
/// </summary>
public static class SeedImpostazioniVetrina
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // AnyAsync() e non "cerca l'id 1": se un giorno esistesse una riga con un altro id
        // (impossibile per il CHECK, ma la difesa non costa nulla) il seed non ne aggiungerebbe
        // comunque una seconda.
        if (await dbContext.ImpostazioniVetrina.AnyAsync())
        {
            return;
        }

        dbContext.ImpostazioniVetrina.Add(new ImpostazioniVetrina
        {
            // L'id NON è generato dal database (ValueGeneratedNever): va scritto, ed è il
            // valore di dominio "la riga".
            ImpostazioniVetrinaId = ImpostazioniVetrina.IdSingleton,

            // L'insegna che legge il cliente. Distinta da BusinessSettings.BusinessName
            // ("duedgusto"), che resta il nome del gestionale.
            InsegnaPubblica = "2D Gusto Bar",

            Via = "Via del Costo 99",
            Cap = "36016",
            Citta = "Thiene",
            Provincia = "VI",

            // URL completo e non l'handle "@2DGUSTO": si persistono indirizzi, non
            // identificativi da ricomporre. Vedi il commento su UrlInstagram nel modello.
            UrlInstagram = "https://www.instagram.com/2dgusto/",
        });

        // Telefono, email, coordinate e meta di default restano vuoti di proposito: un valore
        // inventato dal seed è indistinguibile da un valore scelto, e finirebbe sul sito e nei
        // dati strutturati. Mezza coordinata, in particolare, è un punto sull'equatore — un
        // dato peggiore di un dato mancante.
        await dbContext.SaveChangesAsync();
    }
}
