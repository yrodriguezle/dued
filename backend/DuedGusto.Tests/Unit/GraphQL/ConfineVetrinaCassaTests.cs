using duedgusto.GraphQL.Vendite.Types;
using duedgusto.GraphQL.Vetrina.Types;

namespace DuedGusto.Tests.Unit.GraphQL;

/// <summary>
/// Il confine fra cassa e vetrina, pinnato per <b>struttura</b> e non per comportamento.
///
/// 🔴 Perché servono test come questi, oltre a quelli comportamentali: i test di
/// comportamento verificano che i due canali oggi non si pestino i piedi. Ma il giorno in cui
/// qualcuno aggiunge un campo di troppo a uno dei due input, quei test <b>passano
/// comunque</b> — nessuno li ha scritti per quel campo. Questi due falliscono subito, e il
/// messaggio dice esattamente qual è la proprietà di troppo.
///
/// Sono controlli via reflection, non una nota in code review: una nota si dimentica.
/// </summary>
public class ConfineVetrinaCassaTests
{
    /// <summary>
    /// I campi contabili, cioè quelli che appartengono alla cassa e che la vetrina non deve
    /// poter toccare. Elencati una volta sola e usati da entrambe le direzioni del confine.
    /// </summary>
    private static readonly string[] CampiCassa =
        ["Codice", "Nome", "Descrizione", "Prezzo", "Categoria", "UnitaDiMisura", "Attivo", "AliquotaIva",
         "Ordinamento", "Colore"];

    private static readonly string[] CampiVetrina =
    [
        "VisibileSulSito", "NomeVetrina", "DescrizioneVetrina", "CategoriaVetrina", "PrezzoVetrina",
        "ImmagineId", "OrdinamentoVetrina", "Allergeni", "Novita", "Consigliato", "InLavagnaDal",
    ];

    [Fact]
    public void ProdottoInput_NonContieneCampiVetrina()
    {
        // UpsertProdottoAsync assegna OGNI campo dell'input esplicitamente. Un campo vetrina
        // qui verrebbe quindi riscritto a ogni salvataggio della cassa: la prima modifica di
        // prezzo azzererebbe in massa nome, descrizione e immagine di vetrina di quel
        // prodotto, e la perdita sarebbe silenziosa — nessun errore, solo schede vuote.
        typeof(ProdottoInput).GetProperties().Select(p => p.Name)
            .Should().BeEquivalentTo(
                "ProdottoId", "Codice", "Nome", "Descrizione", "Prezzo",
                "Categoria", "UnitaDiMisura", "Attivo", "AliquotaIva", "Ordinamento", "Colore");
    }

    [Fact]
    public void ProdottoVetrinaInput_NonContieneCampiCassa()
    {
        // La direzione opposta: mutateProdottoVetrina fa un'assegnazione totale, ed è sicura
        // SOLO perché l'input non possiede i campi contabili. Aggiungerne uno qui renderebbe
        // la griglia della vetrina un secondo scrittore del listino.
        typeof(ProdottoVetrinaInput).GetProperties().Select(p => p.Name)
            .Should().NotIntersectWith(CampiCassa);
    }

    [Fact]
    public void ProdottoVetrinaInput_ContieneEsattamenteGliUndiciCampiVetrina()
    {
        // Il confine ha due lati: sopra si impedisce di aggiungere campi cassa, qui si
        // impedisce di perderne uno di vetrina. Un campo tolto dall'input non dà errore:
        // smette semplicemente di essere salvabile, e la griglia sembra "non salvare".
        typeof(ProdottoVetrinaInput).GetProperties().Select(p => p.Name)
            .Should().BeEquivalentTo(CampiVetrina);
    }

    [Fact]
    public void MediaAssetInput_NonEsponeICampiTecnici()
    {
        // Chiave, dimensioni, larghezze, placeholder e byte sono misurati dalla pipeline sui
        // file reali. Se il client potesse dichiararli, un srcset costruito su quel dato
        // emetterebbe URL a 404 — e il guasto degrada in silenzio, diverso da browser a browser.
        string[] campiTecnici =
            ["Chiave", "MimeType", "Larghezza", "Altezza", "LarghezzeDisponibili", "Placeholder", "ByteTotali"];

        typeof(MediaAssetInput).GetProperties().Select(p => p.Name)
            .Should().NotIntersectWith(campiTecnici);
    }
}
