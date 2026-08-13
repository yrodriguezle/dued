using duedgusto.DataAccess;
using duedgusto.GraphQL.Vetrina.Types;
using duedgusto.Models;
using duedgusto.Services.Vetrina;

namespace DuedGusto.Tests.Unit.Services;

/// <summary>
/// La mappa pagina → campo non mente <b>sui nomi</b> e non mente <b>sui proprietari</b>.
///
/// <para>🔴 <b>Che cosa copre questo file, e che cosa NON copre.</b> Che le voci corrispondano a
/// ciò che i sorgenti del sito leggono davvero lo verifica
/// <c>sito/test/mappa-pagine.test.mjs</c>, che è l'unico posto da cui si vedono insieme la
/// dichiarazione e i <c>.astro</c>. Qui si verifica ciò che quella verifica <b>non può</b> vedere,
/// perché il sito non conosce i nomi delle colonne: che ogni <c>Campo</c> esista davvero sul
/// modello, e che la <c>Scheda</c> dichiarata coincida con il proprietario che la partizione
/// della scrittura già impone. Due nomi storpiati qui non darebbero alcun errore: farebbero
/// sparire un valore dalla scheda, oppure — ed è peggio — manderebbero l'amministratore a
/// cercarlo nella scheda sbagliata.</para>
/// </summary>
public class MappaPagineVetrinaTests
{
    /// <summary>
    /// Le quattro schede della vetrina e il tipo di input che ne definisce il perimetro.
    ///
    /// 🔴 <b>Il perimetro non è scritto a mano</b>: è <c>GetProperties()</c> sull'input, cioè la
    /// stessa autorità su cui poggiano i test di partizione. Un campo che cambiasse proprietario
    /// domani sposterebbe insieme la mutation e questa verifica.
    /// </summary>
    private static Type? TipoInput(SchedaVetrina scheda) => scheda switch
    {
        SchedaVetrina.Impostazioni => typeof(ImpostazioniVetrinaInput),
        SchedaVetrina.Home => typeof(PaginaHomeInput),
        SchedaVetrina.Locale => typeof(PaginaLocaleInput),
        SchedaVetrina.Aperitivo => typeof(PaginaAperitivoInput),
        // Le due sedi che non sono schede del sito: gli orari e le recensioni non si scrivono
        // da alcun input della vetrina, ed è il punto per cui la mappa le nomina.
        _ => null,
    };

    [Fact]
    public void Mappa_HaVociPerTutteECinqueLePagineEPerLaCornice()
    {
        // Una pagina senza alcuna voce sarebbe una scheda che non sa dire nulla dei propri testi,
        // e nessuno lo scoprirebbe: la sezione comparirebbe vuota, come se non ci fosse niente
        // da sapere. `/menu` ne ha UNA sola, ed è precisamente l'informazione che quella scheda
        // deve dare.
        PaginaVetrina[] senzaVoci =
        [
            .. Enum.GetValues<PaginaVetrina>()
                .Where(pagina => MappaPagineVetrina.Della(pagina).Count == 0)
        ];

        senzaVoci.Should().BeEmpty(
            "ogni pagina, e la cornice, devono avere almeno una voce: una scheda senza voci non "
            + "distingue «questa pagina non mostra nulla» da «la mappa non lo sa»");
    }

    /// <summary>
    /// 🔴 Ogni <c>Campo</c> è una proprietà <b>reale</b> del modello che lo porta, e quale modello
    /// lo dice la <c>Scheda</c>: la vetrina per le quattro schede del sito, le impostazioni
    /// operative per gli orari, il contesto per le recensioni.
    ///
    /// <para>⚠️ Senza questo test un nome storpiato — <c>InsegnaPublica</c> — non produrrebbe
    /// alcun errore: il pannello cercherebbe un campo inesistente e mostrerebbe la voce
    /// <b>senza valore</b>, che somiglia in tutto a «non compilato».</para>
    /// </summary>
    [Fact]
    public void OgniCampo_EUnaProprietaRealeDelModelloCheLoPorta()
    {
        string[] sconosciuti =
        [
            .. MappaPagineVetrina.Voci
                .Where(voce => TipoPortante(voce.Scheda).GetProperty(voce.Campo) is null)
                .Select(voce => $"{voce.Pagina}/{voce.Campo} (atteso su {TipoPortante(voce.Scheda).Name})")
                .Distinct()
                .Order()
        ];

        sconosciuti.Should().BeEmpty(
            "un campo che il modello non ha non produce alcun errore: la voce compare nella "
            + "scheda senza valore, indistinguibile da «non compilato»");
    }

    private static Type TipoPortante(SchedaVetrina scheda) => scheda switch
    {
        SchedaVetrina.ImpostazioniCassa => typeof(BusinessSettings),
        SchedaVetrina.RecensioniSito => typeof(AppDbContext),
        _ => typeof(ImpostazioniVetrina),
    };

    /// <summary>
    /// 🔴 <b>La colonna «dove si modifica» non è tenuta allineata a mano.</b> Per ogni voce che
    /// nomina una delle quattro schede del sito, il campo deve appartenere <b>esattamente</b> al
    /// perimetro dell'input di quella scheda — cioè alla stessa partizione che le mutation già
    /// impongono.
    ///
    /// <para>È l'asserzione che impedisce alla mappa di <b>mentire con sicurezza</b>: una voce che
    /// mandasse l'amministratore alla scheda sbagliata sarebbe un'indicazione precisa e falsa, che
    /// è peggio di nessuna indicazione. E il giorno in cui un campo cambiasse proprietario, questo
    /// test diventerebbe rosso insieme alla mutation, invece di lasciare la mappa indietro.</para>
    /// </summary>
    [Fact]
    public void OgniVoceDiUnaSchedaDelSito_NominaLaSchedaCheQuelCampoPossiedeDavvero()
    {
        string[] divergenti =
        [
            .. MappaPagineVetrina.Voci
                .Where(voce => TipoInput(voce.Scheda) is not null)
                .Where(voce => TipoInput(voce.Scheda)!.GetProperty(voce.Campo) is null)
                .Select(voce =>
                {
                    SchedaVetrina? vera = Enum.GetValues<SchedaVetrina>()
                        .Where(scheda => TipoInput(scheda)?.GetProperty(voce.Campo) is not null)
                        .Cast<SchedaVetrina?>()
                        .FirstOrDefault();
                    return $"{voce.Campo}: la mappa lo manda a «{voce.Scheda}», "
                        + $"ma lo possiede «{(vera is null ? "nessuna scheda" : vera.ToString())}»";
                })
                .Distinct()
                .Order()
        ];

        divergenti.Should().BeEmpty(
            "la mappa dice dove si modifica un valore: mandare alla scheda sbagliata è "
            + "un'indicazione precisa e falsa, peggiore di nessuna indicazione");
    }

    /// <summary>
    /// Lo stesso campo, ovunque compaia, porta lo <b>stesso</b> percorso, la <b>stessa</b> scheda e
    /// la <b>stessa</b> etichetta.
    ///
    /// <para>⚠️ Il campo compare più volte per costruzione — l'insegna su cinque pagine, i testi
    /// dell'aperitivo su due — e la ripetizione è il punto debole di una tabella scritta a mano:
    /// si corregge una riga e non le altre. Il guasto sarebbe muto e <b>parziale</b>, cioè la
    /// forma più difficile da notare: la scheda «Home» direbbe una cosa e la scheda «Aperitivo»
    /// un'altra sullo stesso testo.</para>
    /// </summary>
    [Fact]
    public void LoStessoCampo_PortaSempreLoStessoPercorsoLaStessaSchedaELaStessaEtichetta()
    {
        string[] incoerenti =
        [
            .. MappaPagineVetrina.Voci
                .GroupBy(voce => voce.Campo)
                .Where(gruppo => gruppo.Select(voce => (voce.Percorso, voce.Scheda, voce.Etichetta))
                    .Distinct().Count() > 1)
                .Select(gruppo => $"{gruppo.Key}: "
                    + string.Join(" | ", gruppo
                        .Select(voce => $"{voce.Pagina} → {voce.Percorso}/{voce.Scheda}/«{voce.Etichetta}»")
                        .Distinct()))
                .Order()
        ];

        incoerenti.Should().BeEmpty(
            "lo stesso campo descritto in due modi diversi su due pagine è un guasto parziale e "
            + "muto: una scheda dice una cosa e l'altra un'altra sullo stesso testo");
    }

    [Fact]
    public void NessunaVoce_ERipetutaSullaStessaPagina()
    {
        string[] doppie =
        [
            .. MappaPagineVetrina.Voci
                .GroupBy(voce => (voce.Pagina, voce.Campo))
                .Where(gruppo => gruppo.Count() > 1)
                .Select(gruppo => $"{gruppo.Key.Pagina}/{gruppo.Key.Campo} ×{gruppo.Count()}")
                .Order()
        ];

        doppie.Should().BeEmpty("la scheda mostrerebbe due volte la stessa riga");
    }

    /// <summary>
    /// I quattro <b>ganci spenti</b> e i <b>tre slot immagine</b> non compaiono nella mappa, ed è
    /// una scelta dichiarata: nessuna pagina rende i primi, e le immagini hanno già una
    /// dichiarazione propria — il piano di <see cref="RuoliImmaginiVetrina"/>. Ripeterle qui
    /// sarebbe la seconda scrittura che questo file esiste per togliere.
    /// </summary>
    [Fact]
    public void IGanciSpentiEGliSlotImmagine_NonCompaionoNellaMappa()
    {
        string[] fuoriPosto =
        [
            "TurnstileSiteKey", "PrenotazioniAttive", "PrenotazioniPreavvisoOre",
            "PrenotazioniCopertiMax",
            "ImmagineEroeHomeId", "ImmagineRitrattoLocaleId", "ImmagineEroeAperitivoId",
        ];

        MappaPagineVetrina.Voci.Select(voce => voce.Campo).Intersect(fuoriPosto).Should().BeEmpty(
            "un gancio spento dichiarato come «testo che questa pagina mostra» sarebbe falso, e "
            + "uno slot immagine dichiarato qui sarebbe la seconda scrittura del piano dei ruoli");
    }

    /// <summary>
    /// 🔴 <b>L'ampiezza delle griglie ha UNA sola scrittura, ed esce dal server.</b> Fino a questa
    /// fase il numero viveva due volte — <c>AmpiezzaFinestra</c> qui e <c>posti: 3</c> nel
    /// pannello — e nessuna build metteva a confronto le due. Questo test pinna il fatto che il
    /// valore esposto sia <b>lo stesso</b> che governa il taglio delle finestre, non una costante
    /// scritta accanto.
    /// </summary>
    [Fact]
    public void AmpiezzaGriglia_EIlNumeroCheTagliaDavveroLeFinestre()
    {
        List<MediaAsset> galleria =
        [
            .. Enumerable.Range(1, 12).Select(indice => new MediaAsset
            {
                MediaAssetId = indice,
                Chiave = $"2026/08/foto-{indice}",
                NomeOriginale = $"foto-{indice}.jpg",
                MimeType = "image/jpeg",
                Cartella = "galleria",
                Pubblicato = true,
            })
        ];

        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(null, null, null, galleria);

        // Con dodici fotografie tutte e tre le griglie sono piene: la loro lunghezza È l'ampiezza.
        piano.GrigliaHome.Should().HaveCount(RuoliImmaginiVetrina.AmpiezzaFinestra);
        piano.FotoMenu.Should().HaveCount(RuoliImmaginiVetrina.AmpiezzaFinestra);
        piano.QuadrateLocale.Should().HaveCount(RuoliImmaginiVetrina.AmpiezzaFinestra);
    }
}
