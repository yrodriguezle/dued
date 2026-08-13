using duedgusto.Services.Vetrina;

namespace DuedGusto.Tests.Unit.Services;

/// <summary>
/// La regola dei ruoli, che fino a questo change viveva scritta <b>quattro volte dentro quattro
/// file <c>.astro</c></b>, calcola la cosa giusta.
///
/// <para>🔴 <b>L'asserzione portante è la prima: a slot vuoti il piano riproduce gli indici che i
/// <c>.astro</c> usavano</b>, immagine per immagine e su sei dimensioni di galleria. Ogni
/// asserzione della matrice porta accanto, in commento, la riga di sorgente che sostituisce: se un
/// giorno una regola cambia, il test non dice soltanto «diverso», dice <b>da cosa</b> è diverso.</para>
///
/// <para>⚠️ <b>Una sola eccezione, deliberata: l'eroe di <c>/aperitivo</c> non ha ripiego.</b>
/// <c>aperitivo.astro:50</c> faceva <c>galleria.at(-1)</c>, cioè prendeva l'ultima foto caricata, e
/// per questo <b>caricare una foto qualsiasi</b> — magari per un'altra pagina — spostava di nascosto
/// l'immagine di testata dell'aperitivo. Il ripiego non è un ponte verso una migrazione, è la
/// semantica <b>permanente</b> dello slot vuoto: conservarlo avrebbe voluto dire conservare quel
/// difetto per sempre. Con lo slot vuoto la pagina esce quindi <b>senza</b> immagine di testata,
/// che è la regola già valida ovunque nel sito — <i>una sezione senza il suo dato non si rende</i>.
/// È l'unica differenza visibile che questa fase introduce, ed è nominata qui perché sia una scelta
/// leggibile e non una svista.</para>
///
/// <para>🔴 <b>Le gallerie da 0, 1 e 2 immagini non sono casi limite teorici.</b> Nessun test
/// copriva l'indicizzazione sotto le tre immagini, e sono gli stati <b>reali</b> misurati: la
/// produzione ne ha <b>una</b> pubblicata, lo sviluppo locale <b>due</b>. Con una foto sola la
/// stessa immagine ricopre insieme l'eroe della home e il ritratto del locale, e le due griglie
/// sono vuote. I tre casi hanno perciò un test dedicato ciascuno, con un'asserzione per ognuno dei
/// sei ruoli e i valori attesi scritti a mano: un confronto d'insieme direbbe «uguale» senza dire
/// «a cosa».</para>
/// </summary>
public class RuoliImmaginiVetrinaTests
{
    private static MediaAsset Immagine(int numero) => new()
    {
        MediaAssetId = numero,
        Chiave = $"2026/08/foto-{numero}",
        NomeOriginale = $"foto-{numero}.jpg",
        MimeType = "image/jpeg",
        Cartella = "galleria",
        Ordinamento = numero,
        Pubblicato = true,
    };

    /// <summary>
    /// Una galleria già selezionata e ordinata come la restituisce la rotta pubblica: la funzione
    /// non filtra nulla, riceve ciò che il sito riceverebbe.
    /// </summary>
    private static List<MediaAsset> Galleria(int quante) =>
        Enumerable.Range(1, quante).Select(Immagine).ToList();

    private static PianoImmagini ASlotVuoti(IReadOnlyList<MediaAsset> galleria) =>
        RuoliImmaginiVetrina.Risolvi(null, null, null, galleria);

    // ── 🔴 Il test portante: a slot vuoti il piano è il sito di oggi (task 2.3) ───────────

    /// <summary>
    /// La matrice, sulle sei dimensioni di galleria che il design pretende. Le attese non sono
    /// costanti: sono l'<b>aritmetica dei <c>.astro</c></b> riscritta accanto a ciascun ruolo,
    /// quindi il test è un'autorità esterna alla funzione e non un suo riflesso.
    /// </summary>
    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(5)]
    [InlineData(6)]
    public void Risolvi_ASlotVuoti_RiproduceGliIndiciDiOggi(int quanteImmagini)
    {
        List<MediaAsset> galleria = Galleria(quanteImmagini);

        PianoImmagini piano = ASlotVuoti(galleria);

        // index.astro:85 — const [eroe, ...altre] = galleria;
        piano.EroeHome.Should().BeSameAs(galleria.ElementAtOrDefault(0));
        // index.astro:86 — const griglia = altre.slice(0, 3);
        piano.GrigliaHome.Should().Equal(galleria.Skip(1).Take(3));
        // menu.astro:68 — const foto = galleria.slice(0, 3);
        piano.FotoMenu.Should().Equal(galleria.Take(3));
        // locale.astro:38 — const ritratto = galleria[1] ?? galleria[0] ?? null;
        piano.RitrattoLocale.Should()
            .BeSameAs(galleria.ElementAtOrDefault(1) ?? galleria.ElementAtOrDefault(0));
        // locale.astro:39 — const quadrate = galleria.slice(2, 5);
        piano.QuadrateLocale.Should().Equal(galleria.Skip(2).Take(3));
        // aperitivo.astro:50 — ERA `galleria.at(-1) ?? null`, ORA nessun ripiego: vedi la
        // docstring di classe. È l'unica riga della matrice che diverge dal sito di oggi.
        piano.EroeAperitivo.Should().BeNull(
            "senza slot valorizzato la pagina Aperitivo esce senza immagine di testata, "
            + "invece di prendere l'ultima foto caricata");

        // A slot tutti vuoti nessun ruolo singolo è stato scelto da qualcuno: sono tutti e tre
        // coperti (o scoperti) dalla posizione.
        piano.OrigineEroeHome.Should().Be(OrigineRuolo.Posizione);
        piano.OrigineRitrattoLocale.Should().Be(OrigineRuolo.Posizione);
        piano.OrigineEroeAperitivo.Should().Be(OrigineRuolo.Posizione);
    }

    /// <summary>
    /// Galleria vuota: nessuna pagina ha immagini, e la funzione lo dice invece di esplodere sugli
    /// indici. È lo stato di un'installazione appena seminata.
    /// </summary>
    [Fact]
    public void Risolvi_ConGalleriaVuota_NonAttribuisceAlcunRuolo()
    {
        PianoImmagini piano = ASlotVuoti(Galleria(0));

        piano.EroeHome.Should().BeNull();
        piano.GrigliaHome.Should().BeEmpty();
        piano.FotoMenu.Should().BeEmpty();
        piano.RitrattoLocale.Should().BeNull();
        piano.QuadrateLocale.Should().BeEmpty();
        piano.EroeAperitivo.Should().BeNull();
    }

    /// <summary>
    /// 🔴 <b>Lo stato della produzione al 2026-08-13: una sola foto pubblicata in galleria.</b>
    /// Con una foto la stessa immagine è insieme eroe della home e ritratto del locale, il menu ne
    /// mostra una sola e le due griglie sono <b>vuote</b>. Sei asserzioni, una per ruolo, con i
    /// valori scritti a mano: è la forma in cui il test <i>afferma</i> lo stato invece di subirlo.
    /// </summary>
    [Fact]
    public void Risolvi_ConUnaSolaImmagine_LaStessaFotoCopreDueRuoliEDueGrigliaSonoVuote()
    {
        List<MediaAsset> galleria = Galleria(1);
        MediaAsset unica = galleria[0];

        PianoImmagini piano = ASlotVuoti(galleria);

        piano.EroeHome.Should().BeSameAs(unica);
        piano.GrigliaHome.Should().BeEmpty("dopo l'eroe non resta nulla");
        piano.FotoMenu.Should().Equal(unica);
        piano.RitrattoLocale.Should().BeSameAs(unica, "galleria[1] non esiste, si ricade su [0]");
        piano.QuadrateLocale.Should().BeEmpty("la finestra parte da [2] e la galleria finisce a [0]");
        // ⚠️ Con una foto sola i due ripieghi coincidevano — `at(-1)` e `[0]` sono la stessa
        //    immagine — quindi prima del change l'aperitivo mostrava la stessa foto delle altre
        //    due pagine. Ora resta scoperto finché nessuno sceglie.
        piano.EroeAperitivo.Should().BeNull();
    }

    /// <summary>
    /// Lo stato del database di sviluppo: <b>due</b> foto pubblicate. Anch'esso degenere — la
    /// seconda copre insieme il ritratto del locale e l'unico posto della griglia della home — e
    /// anch'esso mai coperto da un test prima di questo change.
    /// </summary>
    [Fact]
    public void Risolvi_ConDueImmagini_LaSecondaCopreRitrattoEGrigliaEDueRuoliRestanoScoperti()
    {
        List<MediaAsset> galleria = Galleria(2);
        (MediaAsset prima, MediaAsset seconda) = (galleria[0], galleria[1]);

        PianoImmagini piano = ASlotVuoti(galleria);

        piano.EroeHome.Should().BeSameAs(prima);
        piano.GrigliaHome.Should().Equal(seconda);
        piano.FotoMenu.Should().Equal(prima, seconda);
        piano.RitrattoLocale.Should().BeSameAs(seconda);
        piano.QuadrateLocale.Should().BeEmpty("la finestra parte da [2] e la galleria finisce a [1]");
        piano.EroeAperitivo.Should().BeNull();
    }

    // ── La finestra salta i ruoli singoli e scorre (task 2.4) ────────────────────────────

    /// <summary>
    /// Con l'eroe della home scelto <b>dentro</b> la finestra della griglia, la griglia lo salta e
    /// pesca una foto in più per restare a tre. Senza questa regola la stessa immagine comparirebbe
    /// due volte sulla stessa pagina, e il numero che la scheda dichiara sarebbe <b>falso</b>.
    /// </summary>
    [Fact]
    public void Risolvi_ConEroeHomeDentroLaFinestra_LaGrigliaLoSaltaEScorre()
    {
        List<MediaAsset> galleria = Galleria(6);
        MediaAsset terza = galleria[2];

        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(
            eroeHomeId: terza.MediaAssetId, ritrattoLocaleId: null, eroeAperitivoId: null, galleria);

        piano.EroeHome.Should().BeSameAs(terza);
        piano.GrigliaHome.Should().NotContain(terza, "l'eroe non si ripete dentro la sua griglia");
        piano.GrigliaHome.Should().HaveCount(3, "la finestra scorre invece di restringersi");
        piano.GrigliaHome.Should().Equal(galleria[1], galleria[3], galleria[4]);
    }

    /// <summary>
    /// Lo stesso, sulla pagina «Il locale»: il ritratto scelto dentro <c>[2..5)</c> viene saltato
    /// dalle quadrate, che scorrono.
    /// </summary>
    [Fact]
    public void Risolvi_ConRitrattoLocaleDentroLaFinestra_LeQuadrateLoSaltanoEScorrono()
    {
        List<MediaAsset> galleria = Galleria(6);
        MediaAsset quarta = galleria[3];

        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(
            eroeHomeId: null, ritrattoLocaleId: quarta.MediaAssetId, eroeAperitivoId: null, galleria);

        piano.RitrattoLocale.Should().BeSameAs(quarta);
        piano.QuadrateLocale.Should().NotContain(quarta);
        piano.QuadrateLocale.Should().HaveCount(3);
        piano.QuadrateLocale.Should().Equal(galleria[2], galleria[4], galleria[5]);
    }

    /// <summary>
    /// ⚠️ Il caso complementare, ed è quello che dimostra che la regola nuova <b>non ha cambiato
    /// nulla oggi</b>: a slot vuoti il salto non ha alcun effetto, perché i ruoli singoli cadono
    /// fuori dalle rispettive finestre già per costruzione — l'eroe è <c>[0]</c> e la griglia parte
    /// da <c>[1]</c>, il ritratto è <c>[1]</c> e le quadrate partono da <c>[2]</c>.
    /// </summary>
    [Fact]
    public void Risolvi_ASlotVuoti_IlSaltoNonHaAlcunEffettoSulleFinestre()
    {
        List<MediaAsset> galleria = Galleria(6);

        PianoImmagini piano = ASlotVuoti(galleria);

        piano.GrigliaHome.Should().Equal(galleria[1], galleria[2], galleria[3]);
        piano.QuadrateLocale.Should().Equal(galleria[2], galleria[3], galleria[4]);
        // ⚠️ La griglia della home CONTIENE il ritratto del locale, e va bene: il salto è per
        //    pagina, non globale. Le griglie sono davvero «foto del locale» e possono comparire
        //    su più pagine — è la posizione a restare onesta solo lì.
        piano.GrigliaHome.Should().Contain(piano.RitrattoLocale!);
    }

    /// <summary>
    /// <c>/menu</c> non ha ruoli singoli, quindi la sua finestra non salta nulla nemmeno quando gli
    /// slot delle altre pagine sono valorizzati dentro <c>[0..3)</c>. Il salto è <b>per pagina</b>:
    /// estenderlo a tutti i ruoli toglierebbe foto al menu per una scelta fatta altrove.
    /// </summary>
    [Fact]
    public void Risolvi_ConSlotDiAltrePagine_LaFinestraDelMenuNonSaltaNulla()
    {
        List<MediaAsset> galleria = Galleria(6);

        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(
            eroeHomeId: galleria[1].MediaAssetId,
            ritrattoLocaleId: galleria[2].MediaAssetId,
            eroeAperitivoId: galleria[0].MediaAssetId,
            galleria);

        piano.FotoMenu.Should().Equal(galleria[0], galleria[1], galleria[2]);
    }

    // ── `origine` distingue la scelta dalla posizione (task 2.5) ─────────────────────────

    [Fact]
    public void Risolvi_ConSlotValorizzati_OrigineESlotEVinconoSulRipiego()
    {
        List<MediaAsset> galleria = Galleria(6);

        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(
            eroeHomeId: galleria[4].MediaAssetId,
            ritrattoLocaleId: galleria[5].MediaAssetId,
            eroeAperitivoId: galleria[3].MediaAssetId,
            galleria);

        piano.EroeHome.Should().BeSameAs(galleria[4]);
        piano.RitrattoLocale.Should().BeSameAs(galleria[5]);
        piano.EroeAperitivo.Should().BeSameAs(galleria[3]);

        piano.OrigineEroeHome.Should().Be(OrigineRuolo.Slot);
        piano.OrigineRitrattoLocale.Should().Be(OrigineRuolo.Slot);
        piano.OrigineEroeAperitivo.Should().Be(OrigineRuolo.Slot);
    }

    [Fact]
    public void Risolvi_ConSlotVuoti_OrigineEPosizione()
    {
        PianoImmagini piano = ASlotVuoti(Galleria(6));

        piano.OrigineEroeHome.Should().Be(OrigineRuolo.Posizione);
        piano.OrigineRitrattoLocale.Should().Be(OrigineRuolo.Posizione);
        piano.OrigineEroeAperitivo.Should().Be(OrigineRuolo.Posizione);
    }

    /// <summary>
    /// 🔴 Uno slot che punta a un'immagine che la galleria <b>non contiene</b> — non pubblicata, o
    /// in un'altra cartella — non attribuisce alcun ruolo: si ricade sul ripiego, e l'origine lo
    /// dichiara. È la forma che impedisce al piano di nominare un'immagine che la rotta pubblica
    /// non selezionerebbe: una mappa che mente in favore di sicurezza è peggio di una mappa assente.
    /// </summary>
    [Fact]
    public void Risolvi_ConSlotFuoriDallaGalleria_RicadeSulRipiegoEDichiaraPosizione()
    {
        List<MediaAsset> galleria = Galleria(6);
        const int fuoriGalleria = 999; // non pubblicata, oppure in un'altra cartella

        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(
            eroeHomeId: fuoriGalleria,
            ritrattoLocaleId: fuoriGalleria,
            eroeAperitivoId: fuoriGalleria,
            galleria);

        piano.EroeHome.Should().BeSameAs(galleria[0]);
        piano.RitrattoLocale.Should().BeSameAs(galleria[1]);
        piano.EroeAperitivo.Should().BeNull("l'aperitivo non ha ripiego su cui ricadere");

        piano.OrigineEroeHome.Should().Be(OrigineRuolo.Posizione);
        piano.OrigineRitrattoLocale.Should().Be(OrigineRuolo.Posizione);
        piano.OrigineEroeAperitivo.Should().Be(OrigineRuolo.Posizione);
    }

    /// <summary>
    /// L'invariante che riassume i due scenari della spec — <i>«un'immagine non pubblicata non ha
    /// ruoli»</i> e <i>«un'immagine fuori dalla galleria non ha ruoli di pagina»</i>: <b>ogni</b>
    /// immagine nominata dal piano esce dalla galleria ricevuta, sempre.
    /// </summary>
    [Fact]
    public void Risolvi_NonNominaMaiUnImmagineFuoriDallaGalleriaRicevuta()
    {
        List<MediaAsset> galleria = Galleria(5);

        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(
            eroeHomeId: 999, ritrattoLocaleId: 998, eroeAperitivoId: 997, galleria);

        IEnumerable<MediaAsset> nominate =
        [
            .. new[] { piano.EroeHome, piano.RitrattoLocale, piano.EroeAperitivo }
                .OfType<MediaAsset>(),
            .. piano.GrigliaHome, .. piano.FotoMenu, .. piano.QuadrateLocale,
        ];

        nominate.Should().OnlyContain(immagine => galleria.Contains(immagine));
    }

    // ── L'overload di comodo: delega, non reimplementa (task 3.3) ────────────────────────

    /// <summary>
    /// 🔴 <b>Le due forme di <c>Risolvi</c> sono la stessa regola.</b> L'overload che accetta
    /// l'entità esiste per comodità dei chiamanti che hanno già in mano la riga, e il rischio che
    /// porta è uno solo: che un giorno qualcuno lo riscriva invece di lasciarlo delegare. Due
    /// implementazioni divergerebbero nel modo peggiore — il pannello direbbe che una pagina usa
    /// una foto e il sito ne renderebbe un'altra, con zero errori da qualunque parte si guardi.
    ///
    /// <para>Il confronto gira su <b>tutta</b> la matrice del test portante (0, 1, 2, 3, 5, 6
    /// immagini) e in <b>entrambi</b> gli stati degli slot: vuoti e valorizzati. Un confronto sui
    /// soli slot vuoti resterebbe verde anche se l'overload leggesse le colonne sbagliate, perché
    /// a slot vuoti tutte e tre valgono <c>null</c>.</para>
    /// </summary>
    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(5)]
    [InlineData(6)]
    public void Risolvi_DallEntita_CoincideConLaFirmaAtreIdentificativi(int quanteImmagini)
    {
        List<MediaAsset> galleria = Galleria(quanteImmagini);

        // Slot vuoti: le due forme devono coincidere anche quando non c'è nulla da leggere.
        RuoliImmaginiVetrina.Risolvi(new ImpostazioniVetrina(), galleria)
            .Should().BeEquivalentTo(ASlotVuoti(galleria));

        // 🔴 E slot valorizzati, uno diverso per ciascun ruolo: è l'unico modo di accorgersi che
        //    l'overload ha passato la colonna del ritratto dove andava quella dell'eroe.
        int? eroeHome = galleria.ElementAtOrDefault(0)?.MediaAssetId;
        int? ritratto = galleria.ElementAtOrDefault(1)?.MediaAssetId;
        int? eroeAperitivo = galleria.ElementAtOrDefault(2)?.MediaAssetId;

        var impostazioni = new ImpostazioniVetrina
        {
            ImmagineEroeHomeId = eroeHome,
            ImmagineRitrattoLocaleId = ritratto,
            ImmagineEroeAperitivoId = eroeAperitivo,
        };

        RuoliImmaginiVetrina.Risolvi(impostazioni, galleria)
            .Should().BeEquivalentTo(
                RuoliImmaginiVetrina.Risolvi(eroeHome, ritratto, eroeAperitivo, galleria));
    }

    /// <summary>
    /// L'overload legge <b>le tre colonne giuste, nell'ordine giusto</b>. Il test precedente
    /// confronta due chiamate fra loro; questo verifica il risultato contro valori attesi scritti
    /// a mano, così uno scambio fra due parametri non può passare inosservato per simmetria.
    /// </summary>
    [Fact]
    public void Risolvi_DallEntita_NonScambiaLeTreColonne()
    {
        List<MediaAsset> galleria = Galleria(6);

        var impostazioni = new ImpostazioniVetrina
        {
            ImmagineEroeHomeId = galleria[3].MediaAssetId,
            ImmagineRitrattoLocaleId = galleria[4].MediaAssetId,
            ImmagineEroeAperitivoId = galleria[5].MediaAssetId,
        };

        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(impostazioni, galleria);

        piano.EroeHome.Should().BeSameAs(galleria[3]);
        piano.RitrattoLocale.Should().BeSameAs(galleria[4]);
        piano.EroeAperitivo.Should().BeSameAs(galleria[5]);
    }
}
