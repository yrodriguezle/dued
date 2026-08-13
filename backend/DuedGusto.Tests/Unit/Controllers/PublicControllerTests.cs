using System.Globalization;
using System.Text.Json;

using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

using duedgusto.Controllers;
using duedgusto.Controllers.Public.Dto;
using duedgusto.Services.Calendario;
using duedgusto.Services.Media;
using duedgusto.Services.Vetrina;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.Controllers;

/// <summary>
/// Il <b>comportamento</b> delle tre rotte pubbliche: che cosa esce, in che ordine, e — dove
/// conta di più — che cosa <b>non</b> fa fallire una risposta anonima.
///
/// <para>È il complemento di <see cref="SuperficiePubblicaTests"/>, che pinna la <b>forma</b>
/// della superficie: quello dice che un campo contabile non può esistere, questo dice che i
/// campi che esistono contengono la cosa giusta. Nessuno dei due sostituisce l'altro.</para>
///
/// <para>⚠️ Come <c>MediaControllerTests</c>, il controller viene istanziato direttamente: non si
/// attraversa la pipeline HTTP, quindi <b>questi test non provano nulla sull'anonimato</b> —
/// sarebbero verdi anche con un <c>[Authorize]</c> sulla classe. L'anonimato ha una mezza misura
/// strutturale in <see cref="SuperficiePubblicaTests.PublicController_EAnonimoPerAttributi"/> e
/// l'unica prova vera nella verifica manuale con <c>curl</c>.</para>
/// </summary>
public class PublicControllerTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly Mock<ILogger<PublicController>> _logger = new();
    private readonly PublicController _controller;

    public PublicControllerTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _controller = new PublicController(_dbContext, _logger.Object);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Menu — il filtro di pubblicazione (task 5.12)
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Menu_ProdottoAttivoEVisibile_Compare()
    {
        AggiungiProdotto(1, "Caffè", categoriaVetrina: "Caffetteria");

        MenuPubblicoDto menu = await LeggiMenu();

        NomiDeiProdotti(menu).Should().Equal("Caffè");
        menu.TotaleProdottiPubblicati.Should().Be(1);
    }

    [Fact]
    public async Task Menu_ProdottoVisibileMaNonAttivo_NonCompareENonEConteggiato()
    {
        // 🔴 Il caso che il change precedente ha reso possibile: l'intenzione editoriale resta
        //    scritta mentre la cassa ha ritirato il prodotto. Il sito non lo mostra E non lo conta.
        AggiungiProdotto(1, "Stagionale", attivo: false, visibile: true);

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Should().BeEmpty();
        menu.TotaleProdottiPubblicati.Should().Be(0);
    }

    [Fact]
    public async Task Menu_ProdottoAttivoMaNonVisibile_NonCompare()
    {
        AggiungiProdotto(1, "SCONTRINO", attivo: true, visibile: false);

        MenuPubblicoDto menu = await LeggiMenu();

        NomiDeiProdotti(menu).Should().BeEmpty();
        menu.TotaleProdottiPubblicati.Should().Be(0);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Menu — il raggruppamento (task 5.12)
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Menu_ProdottiRaggruppatiPerCategoriaDiVetrina()
    {
        AggiungiProdotto(1, "Caffè", categoriaVetrina: "Caffetteria");
        AggiungiProdotto(2, "Cappuccino", categoriaVetrina: "Caffetteria");
        AggiungiProdotto(3, "Latte macchiato", categoriaVetrina: "Caffetteria");
        AggiungiProdotto(4, "Spritz", categoriaVetrina: "Aperitivi");
        AggiungiProdotto(5, "Negroni", categoriaVetrina: "Aperitivi");

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Select(c => (c.Nome, c.Prodotti.Count))
            .Should().BeEquivalentTo([("Caffetteria", 3), ("Aperitivi", 2)]);
    }

    [Fact]
    public async Task Menu_ProdottoSenzaCategoriaDiVetrina_FinisceInAltroEdEConteggiato()
    {
        AggiungiProdotto(1, "Toast", categoriaVetrina: null);

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Should().ContainSingle().Which.Nome.Should().Be("Altro");
        menu.TotaleProdottiPubblicati.Should().Be(1);
    }

    /// <summary>
    /// 🔴 La categoria <b>contabile</b> non è un fallback: sarebbe la strada più breve per far
    /// comparire un'etichetta di magazzino come intestazione sul sito.
    /// </summary>
    [Fact]
    public async Task Menu_ConCategoriaContabile_NonCreaAlcunGruppoConQuelNome()
    {
        AggiungiProdotto(1, "Acqua", categoriaVetrina: null, categoriaContabile: "BEVANDE");

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Select(c => c.Nome).Should().NotContain("BEVANDE");
        menu.Categorie.Should().ContainSingle().Which.Nome.Should().Be("Altro");
    }

    [Fact]
    public async Task Menu_CategoriaDiSoliSpazi_FinisceInAltroESenzaGruppiVuoti()
    {
        AggiungiProdotto(1, "Brioche", categoriaVetrina: "   ");
        AggiungiProdotto(2, "Cornetto", categoriaVetrina: "");

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Should().ContainSingle().Which.Nome.Should().Be("Altro");
        menu.Categorie.Select(c => c.Nome).Should().NotContain(nome => string.IsNullOrWhiteSpace(nome));
    }

    [Fact]
    public async Task Menu_QuattroProdottiSenzaCategoria_StannoInUnSoloGruppo()
    {
        for (int id = 1; id <= 4; id++) AggiungiProdotto(id, $"Prodotto {id}", categoriaVetrina: null);

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Should().ContainSingle()
            .Which.Prodotti.Should().HaveCount(4);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Menu — l'ordinamento (task 5.12)
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Menu_ProdottiOrdinatiPerOrdinamentoDiVetrina()
    {
        AggiungiProdotto(1, "Terzo", ordinamento: 3);
        AggiungiProdotto(2, "Primo", ordinamento: 1);
        AggiungiProdotto(3, "Secondo", ordinamento: 2);

        MenuPubblicoDto menu = await LeggiMenu();

        NomiDeiProdotti(menu).Should().Equal("Primo", "Secondo", "Terzo");
    }

    [Fact]
    public async Task Menu_CategorieOrdinatePerMinimoOrdinamentoDeiLoroProdotti()
    {
        AggiungiProdotto(1, "Spritz", categoriaVetrina: "Aperitivi", ordinamento: 10);
        AggiungiProdotto(2, "Caffè", categoriaVetrina: "Caffetteria", ordinamento: 1);

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Select(c => c.Nome).Should().Equal("Caffetteria", "Aperitivi");
    }

    [Fact]
    public async Task Menu_AbbassareLOrdinamentoDiUnProdotto_FaSalireLaSuaCategoria()
    {
        AggiungiProdotto(1, "Spritz", categoriaVetrina: "Aperitivi", ordinamento: 10);
        AggiungiProdotto(2, "Caffè", categoriaVetrina: "Caffetteria", ordinamento: 1);

        // La leva reale dell'amministratore: non esiste un'entità categoria con un ordine
        // proprio, quindi l'ordine delle categorie si governa dai prodotti.
        _dbContext.Prodotti.Single(p => p.ProdottoId == 1).OrdinamentoVetrina = 0;
        await _dbContext.SaveChangesAsync();

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Select(c => c.Nome).Should().Equal("Aperitivi", "Caffetteria");
    }

    /// <summary>
    /// L'ordine deve essere <b>totale</b>: senza il terzo criterio due prodotti con lo stesso
    /// ordinamento e lo stesso nome mostrato si scambierebbero di posto fra due richieste, e una
    /// risposta cacheata servirebbe pagine diverse a visitatori diversi.
    /// </summary>
    [Fact]
    public async Task Menu_DueLettureIdentiche_RestituisconoLoStessoOrdine()
    {
        AggiungiProdotto(1, "Caffè", nomeVetrina: "Espresso", ordinamento: 1);
        AggiungiProdotto(2, "Caffè espresso", nomeVetrina: "Espresso", ordinamento: 1);
        AggiungiProdotto(3, "Caffè lungo", nomeVetrina: "Espresso", ordinamento: 1);

        MenuPubblicoDto prima = await LeggiMenu();
        MenuPubblicoDto dopo = await LeggiMenu();

        IdDeiProdotti(prima).Should().Equal(IdDeiProdotti(dopo));
        IdDeiProdotti(prima).Should().Equal(1, 2, 3);
    }

    [Fact]
    public async Task Menu_IlNomeMostrato_ELaVetrinaQuandoCEAltrimentiIlListino()
    {
        AggiungiProdotto(1, "CAFFE ESPRESSO", nomeVetrina: "Caffè espresso", ordinamento: 1);
        AggiungiProdotto(2, "Brioche", nomeVetrina: null, ordinamento: 2);

        MenuPubblicoDto menu = await LeggiMenu();

        NomiDeiProdotti(menu).Should().Equal("Caffè espresso", "Brioche");
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Menu — il prezzo, e la verifica per mutazione (task 5.13)
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Menu_ConPrezzoDiVetrinaValorizzato_EsponeQuelloDiVetrina()
    {
        AggiungiProdotto(1, "Caffè", prezzo: 3.80m, prezzoVetrina: 4.50m);

        MenuPubblicoDto menu = await LeggiMenu();

        UnicoProdotto(menu).Prezzo.Should().Be(4.50m);
    }

    [Fact]
    public async Task Menu_ConPrezzoDiVetrinaAssente_RicadeSulListino()
    {
        AggiungiProdotto(1, "Caffè", prezzo: 3.80m, prezzoVetrina: null);

        MenuPubblicoDto menu = await LeggiMenu();

        UnicoProdotto(menu).Prezzo.Should().Be(3.80m);
    }

    /// <summary>
    /// 🔴 Il test che ci si dimentica, e che <b>deve poter fallire da solo</b>: zero è un omaggio,
    /// non un prezzo mancante. Sta in un <c>Fact</c> separato da quello del <c>null</c> perché la
    /// verifica per mutazione del task 5.13 possa mostrare che è l'unico a diventare rosso quando
    /// il controller riscrive il fallback invece di chiamare la regola condivisa.
    ///
    /// <para>Senza questo caso, un menu che mostra il prezzo pieno su un prodotto regalato non
    /// produce alcun errore da nessuna parte: se ne accorge il cliente, al banco.</para>
    /// </summary>
    [Fact]
    public async Task Menu_ConPrezzoDiVetrinaAZero_EsponeZeroENonIlListino()
    {
        AggiungiProdotto(1, "Acqua del sindaco", prezzo: 3.80m, prezzoVetrina: 0m);

        MenuPubblicoDto menu = await LeggiMenu();

        UnicoProdotto(menu).Prezzo.Should().Be(0m);
        UnicoProdotto(menu).Prezzo.Should().NotBe(3.80m);
    }

    [Fact]
    public async Task Menu_LaDescrizione_EQuellaDiVetrinaSenzaFallbackSullaContabile()
    {
        AggiungiProdotto(1, "Caffè", descrizioneVetrina: null, descrizioneContabile: "nota interna");

        MenuPubblicoDto menu = await LeggiMenu();

        // Nessun fallback: la descrizione contabile è una nota scritta per la cassa.
        UnicoProdotto(menu).Descrizione.Should().BeNull();
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Menu — il troncamento (task 5.14)
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Menu_Con301Prodotti_Restituisce300EDichiaraIlTroncamento()
    {
        AggiungiProdottiInSerie(301);

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Sum(c => c.Prodotti.Count).Should().Be(300);
        menu.TotaleProdottiPubblicati.Should().Be(301);
        menu.LimiteApplicato.Should().Be(300);
        menu.Troncato.Should().BeTrue();
        AvvisiRegistrati().Should().Be(1);
        AvvisoContiene("301").Should().BeTrue("l'avviso deve riportare il totale reale");
    }

    [Fact]
    public async Task Menu_Con87Prodotti_NonTroncaENonRegistraAvvisi()
    {
        AggiungiProdottiInSerie(87);

        MenuPubblicoDto menu = await LeggiMenu();

        menu.Categorie.Sum(c => c.Prodotti.Count).Should().Be(87);
        menu.TotaleProdottiPubblicati.Should().Be(87);
        menu.Troncato.Should().BeFalse();
        AvvisiRegistrati().Should().Be(0);
    }

    /// <summary>
    /// ⚠️ Il troncamento cade sulla query <b>ordinata</b>, prima del raggruppamento: si perde
    /// l'ultimo prodotto per ordinamento, non un'intera categoria a caso — che sparirebbe dal
    /// sito senza che nulla lo dica.
    /// </summary>
    [Fact]
    public async Task Menu_IlTroncamento_PerdeLUltimoPerOrdinamentoENonUnaCategoriaIntera()
    {
        // 301 prodotti su tre categorie, con l'ordinamento che cresce con l'identificativo.
        string[] categorie = ["Caffetteria", "Aperitivi", "Dolci"];
        for (int id = 1; id <= 301; id++)
        {
            AggiungiProdotto(id, $"Prodotto {id:D3}", categoriaVetrina: categorie[id % 3],
                ordinamento: id);
        }

        MenuPubblicoDto menu = await LeggiMenu();

        NomiDeiProdotti(menu).Should().HaveCount(300);
        NomiDeiProdotti(menu).Should().NotContain("Prodotto 301");
        NomiDeiProdotti(menu).Should().Contain("Prodotto 300");
        menu.Categorie.Select(c => c.Nome).Should().BeEquivalentTo(categorie);
    }

    /// <summary>
    /// Il limite è una costante del backend: non è configurabile e la risposta lo dichiara, così
    /// che il consumatore non debba indovinarlo né dedurre il troncamento da un confronto.
    /// </summary>
    [Fact]
    public async Task Menu_IlLimiteDichiarato_ELaCostanteDelBackendEVale300()
    {
        MenuLimiti.MaxItem.Should().Be(300);

        MenuPubblicoDto menu = await LeggiMenu();

        menu.LimiteApplicato.Should().Be(MenuLimiti.MaxItem);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Menu — l'immagine (task 5.12/5.15)
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Menu_ProdottoSenzaImmagine_CompareConIlCampoImmagineNullo()
    {
        AggiungiProdotto(1, "Caffè");

        MenuPubblicoDto menu = await LeggiMenu();

        UnicoProdotto(menu).Immagine.Should().BeNull();
    }

    [Fact]
    public async Task Menu_ProdottoConImmagine_EsponeLaChiaveENonUnaUrl()
    {
        MediaAsset media = AggiungiMedia(1, "2026/08/caffe-a1b2c3");
        AggiungiProdotto(1, "Caffè", immagine: media);

        MenuPubblicoDto menu = await LeggiMenu();

        ImmaginePubblicaDto? immagine = UnicoProdotto(menu).Immagine;
        immagine.Should().NotBeNull();
        immagine!.Chiave.Should().Be("2026/08/caffe-a1b2c3");
        immagine.Chiave.Should().NotContain("http").And.NotContain("/media");
        immagine.LarghezzeDisponibili.Should().Equal(400, 800);
    }

    /// <summary>
    /// Una riga con il CSV sporco produce una variante in meno nel <c>srcset</c>, non un
    /// <b>500 servito a un visitatore</b>.
    /// </summary>
    [Fact]
    public async Task Menu_ConLarghezzeMalformate_ScartaIValoriSporchiENonSolleva()
    {
        MediaAsset media = AggiungiMedia(1, "2026/08/caffe-a1b2c3", larghezze: "400,x,800");
        AggiungiProdotto(1, "Caffè", immagine: media);

        MenuPubblicoDto menu = await LeggiMenu();

        UnicoProdotto(menu).Immagine!.LarghezzeDisponibili.Should().Equal(400, 800);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Site (task 5.15)
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Site_OrariGiorniEFuso_ArrivanoDalleImpostazioniOperative()
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative(
            apertura: "07:00", chiusura: "21:00",
            giorni: "[true,true,true,true,true,true,false]", fuso: "Europe/Rome");

        SitoPubblicoDto sito = await LeggiSito();

        sito.Orari.Apertura.Should().Be("07:00");
        sito.Orari.Chiusura.Should().Be("21:00");
        sito.Orari.Timezone.Should().Be("Europe/Rome");
        sito.Orari.GiorniOperativi.Should().Equal(true, true, true, true, true, true, false);
    }

    [Fact]
    public async Task Site_IdentitaEIndirizzo_ArrivanoDalleImpostazioniDellaVetrina()
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative();

        SitoPubblicoDto sito = await LeggiSito();

        sito.Insegna.Should().Be("2D Gusto Bar");
        sito.Indirizzo.Via.Should().Be("Via del Costo 99");
        sito.Indirizzo.Cap.Should().Be("36016");
        sito.Indirizzo.Citta.Should().Be("Thiene");
        sito.Indirizzo.Provincia.Should().Be("VI");
        sito.Indirizzo.Paese.Should().Be("IT");
        sito.Social.Instagram.Should().Be("https://www.instagram.com/2dgusto/");
        sito.OraInizioTemaSera.Should().Be("18:00");
    }

    /// <summary>
    /// La controprova sul JSON <b>vero</b>, dentro la suite: è l'analogo automatico di
    /// <c>curl … | jq 'paths'</c> del task 5.17. Non sostituisce i test strutturali — è verde
    /// anche quando un campo esiste ma vale <c>null</c> — ma coglie il caso in cui una property
    /// dal nome innocuo serializzi un blocco che nessuno si aspetta.
    /// </summary>
    [Fact]
    public async Task Site_IlJsonSerializzato_NonContieneAlcunaChiaveVietata()
    {
        AggiungiImpostazioniVetrina(turnstile: "chiave-segreta");
        AggiungiImpostazioniOperative();

        SitoPubblicoDto sito = await LeggiSito();
        string[] chiavi = ChiaviDelJson(sito);

        chiavi.Should().NotIntersectWith(
        [
            "codice", "aliquotaIva", "attivo", "categoria", "unitaDiMisura",
            "createdAt", "updatedAt", "vatRate", "giornaleImportoSabato",
            "giornaleImportoFeriale", "settingsId", "turnstileSiteKey",
            "prenotazioniAttive", "prenotazioniPreavvisoOre", "prenotazioniCopertiMax",
        ]);
    }

    /// <summary>
    /// 🔴 Riga assente → <c>200</c> con i default, mai un <c>404</c>: l'identità del locale è la
    /// prima cosa che la pagina iniziale legge, e un <c>404</c> la farebbe fallire per intero.
    /// Un sito incompleto è un guasto <b>visibile e circoscritto</b>.
    /// </summary>
    [Fact]
    public async Task Site_SenzaAlcunaRigaDiImpostazioni_Risponde200ConIDefaultEAvvisa()
    {
        AggiungiImpostazioniOperative();

        SitoPubblicoDto sito = await LeggiSito();

        sito.Insegna.Should().BeEmpty();
        sito.Indirizzo.Paese.Should().Be("IT");
        sito.OraInizioTemaSera.Should().Be("18:00");
        sito.Geo.Should().BeNull();
        AvvisiRegistrati().Should().BeGreaterThan(0);
    }

    /// <summary>
    /// 🔴 <b>Omettere gli orari settimanali è meglio che dichiararne di sbagliati.</b> La cassa
    /// deserializza lo stesso campo con un <c>!</c>: qui quell'eccezione sarebbe un 500 servito a
    /// un visitatore per colpa di una riga sporca.
    /// </summary>
    [Theory]
    [InlineData("non è json")]
    [InlineData("[1,2,3]")]
    [InlineData("[true,false]")]
    [InlineData("{}")]
    [InlineData("")]
    public async Task Site_ConGiorniOperativiIlleggibili_EsponeNullEAvvisaSenzaSollevare(string valore)
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative(giorni: valore);

        SitoPubblicoDto sito = await LeggiSito();

        sito.Orari.GiorniOperativi.Should().BeNull();
        sito.Orari.Apertura.Should().NotBeNullOrEmpty("il resto della risposta resta valido");
        AvvisiRegistrati().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Site_SenzaCoordinate_EsponeGeoNulloENonUnaCoppiaDiZeri()
    {
        AggiungiImpostazioniVetrina(latitudine: null, longitudine: null);
        AggiungiImpostazioniOperative();

        SitoPubblicoDto sito = await LeggiSito();

        sito.Geo.Should().BeNull();
    }

    [Fact]
    public async Task Site_ConCoordinate_EsponeGeoValorizzato()
    {
        AggiungiImpostazioniVetrina(latitudine: 45.707500m, longitudine: 11.478300m);
        AggiungiImpostazioniOperative();

        SitoPubblicoDto sito = await LeggiSito();

        sito.Geo.Should().NotBeNull();
        sito.Geo!.Latitudine.Should().Be(45.707500m);
        sito.Geo.Longitudine.Should().Be(11.478300m);
    }

    [Fact]
    public async Task Site_SenzaImmagineOg_EsponeIlCampoNulloEIlRestoRestaValido()
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative();

        SitoPubblicoDto sito = await LeggiSito();

        sito.Seo.ImmagineOg.Should().BeNull();
        sito.Insegna.Should().Be("2D Gusto Bar");
    }

    [Fact]
    public async Task Site_ConImmagineOg_EsponeLaChiaveNellaStessaFormaDelleAltreRotte()
    {
        MediaAsset media = AggiungiMedia(1, "2026/08/locale-a1b2c3");
        AggiungiImpostazioniVetrina(immagineOg: media);
        AggiungiImpostazioniOperative();

        SitoPubblicoDto sito = await LeggiSito();

        sito.Seo.ImmagineOg.Should().NotBeNull();
        sito.Seo.ImmagineOg!.Chiave.Should().Be("2026/08/locale-a1b2c3");
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Site — le chiusure
    //
    //  🔴 Il guasto che questi test chiudono: il 13 agosto 2026, con il bar in ferie dal 10 al
    //     22 registrate in cassa, il sito scriveva «Giovedì 07:00 — 20:00» e accendeva
    //     «Aperto». Non era una cache e non era un ritardo di propagazione — l'orario
    //     settimanale arrivava vivo e corretto — era che il contratto pubblico non aveva alcun
    //     campo in cui una chiusura potesse viaggiare.
    //
    //  ⚠️ «Oggi» qui si ricalcola invece di essere iniettato: la rotta non accetta parametri e
    //     non ha un orologio da sostituire. È il prezzo dichiarato di quella scelta.
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Site_ConFerieInCorso_LeEsponeComeDateChiuse()
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative();
        AggiungiChiusura(Oggi, "Ferie", "FERIE");
        AggiungiChiusura(Oggi.AddDays(1), "Ferie", "FERIE");

        SitoPubblicoDto sito = await LeggiSito();

        sito.Chiusure.Select(c => c.Data).Should().Equal(
            Iso(Oggi),
            Iso(Oggi.AddDays(1)));
        sito.Chiusure[0].Descrizione.Should().Be("Ferie");
        sito.Chiusure[0].Motivo.Should().Be("FERIE");
    }

    /// <summary>
    /// ⚠️ Una chiusura di ieri non riguarda chi guarda il sito oggi, e tenerla dentro
    /// significherebbe far annunciare al sito una chiusura già finita.
    /// </summary>
    [Fact]
    public async Task Site_ChiusuraPassata_NonCompare()
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative();
        AggiungiChiusura(Oggi.AddDays(-1), "Ferie", "FERIE");

        SitoPubblicoDto sito = await LeggiSito();

        sito.Chiusure.Should().BeEmpty();
    }

    /// <summary>
    /// 🔴 È il caso che un filtro SQL sulla sola data sbaglierebbe: la riga porta l'anno in cui è
    /// stata inserita e deve cadere <b>quest'anno</b>.
    /// </summary>
    [Fact]
    public async Task Site_FestivitaRicorrenteDiUnAltroAnno_CadeNellaFinestraDiQuestAnno()
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative();

        DateOnly domani = Oggi.AddDays(1);
        AggiungiChiusura(
            new DateOnly(2015, domani.Month, domani.Day), "Festa del paese",
            "FESTIVITA_NAZIONALE", ricorrente: true);

        SitoPubblicoDto sito = await LeggiSito();

        sito.Chiusure.Select(c => c.Data).Should().Equal(Iso(domani));
        sito.Chiusure[0].Descrizione.Should().Be("Festa del paese");
    }

    [Fact]
    public async Task Site_OltreLOrizzonte_NonCompare()
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative();
        AggiungiChiusura(
            Oggi.AddDays(ChiusureProgrammate.GiorniDiOrizzonte), "Troppo in là", "FERIE");

        SitoPubblicoDto sito = await LeggiSito();

        sito.Chiusure.Should().BeEmpty();
    }

    /// <summary>
    /// Nessuna chiusura è lo stato normale di quasi tutto l'anno: elenco <b>vuoto</b>, mai
    /// <c>null</c>, così il consumatore non ha due forme dello stesso «non ce ne sono».
    /// </summary>
    [Fact]
    public async Task Site_SenzaAlcunaChiusura_EsponeUnElencoVuoto()
    {
        AggiungiImpostazioniVetrina();
        AggiungiImpostazioniOperative();

        SitoPubblicoDto sito = await LeggiSito();

        sito.Chiusure.Should().NotBeNull().And.BeEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Galleria (task 5.15)
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Galleria_ElencaISoliMediaDellaCartellaDedicata()
    {
        AggiungiMedia(1, "a", cartella: CartelleVetrina.Galleria);
        AggiungiMedia(2, "b", cartella: CartelleVetrina.Galleria);
        AggiungiMedia(3, "c", cartella: CartelleVetrina.Generale);
        AggiungiMedia(4, "d", cartella: CartelleVetrina.Generale);
        AggiungiMedia(5, "e", cartella: CartelleVetrina.Generale);

        GalleriaPubblicaDto galleria = await LeggiGalleria();

        galleria.Immagini.Select(i => i.Chiave).Should().Equal("a", "b");
    }

    [Fact]
    public async Task Galleria_MediaNonPubblicato_NonCompare()
    {
        AggiungiMedia(1, "a", cartella: CartelleVetrina.Galleria, pubblicato: false);

        GalleriaPubblicaDto galleria = await LeggiGalleria();

        galleria.Immagini.Should().BeEmpty();
    }

    [Fact]
    public async Task Galleria_Vuota_EUnoStatoLegittimoENonUnErrore()
    {
        GalleriaPubblicaDto galleria = await LeggiGalleria();

        galleria.Immagini.Should().BeEmpty();
        AvvisiRegistrati().Should().Be(0, "nessuno ha ancora etichettato immagini: non è un guasto");
    }

    [Fact]
    public async Task Galleria_ADueMediaConLoStessoOrdinamento_LOrdineEStabile()
    {
        AggiungiMedia(2, "seconda", cartella: CartelleVetrina.Galleria, ordinamento: 5);
        AggiungiMedia(1, "prima", cartella: CartelleVetrina.Galleria, ordinamento: 5);

        GalleriaPubblicaDto prima = await LeggiGalleria();
        GalleriaPubblicaDto dopo = await LeggiGalleria();

        prima.Immagini.Select(i => i.Chiave).Should().Equal("prima", "seconda");
        dopo.Immagini.Select(i => i.Chiave).Should().Equal(prima.Immagini.Select(i => i.Chiave));
    }

    /// <summary>
    /// Menu e galleria espongono l'immagine nella <b>stessa identica forma</b>: il consumatore ha
    /// un tipo solo da gestire e un solo componente da scrivere.
    /// </summary>
    [Fact]
    public async Task Immagine_HaLaStessaFormaNelMenuENellaGalleria()
    {
        MediaAsset media = AggiungiMedia(1, "2026/08/caffe-a1b2c3", cartella: CartelleVetrina.Galleria);
        AggiungiProdotto(1, "Caffè", immagine: media);

        ImmaginePubblicaDto? nelMenu = UnicoProdotto(await LeggiMenu()).Immagine;
        ImmaginePubblicaDto nellaGalleria = (await LeggiGalleria()).Immagini.Single();

        nelMenu.Should().BeEquivalentTo(nellaGalleria);
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  L'istruzione SQL generata
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// 🔴 La proiezione <b>non legge</b> le colonne riservate: non "le legge e non le
    /// serializza". Si verifica sull'istruzione generata, perché è l'unico posto in cui la
    /// differenza fra le due cose è osservabile.
    ///
    /// <para>⚠️ Il divieto riguarda la lista <c>SELECT</c> e non l'intera istruzione:
    /// <c>Attivo</c> <b>deve</b> comparire nella <c>WHERE</c>, perché è metà della regola di
    /// pubblicazione. Un filtro che nomina una colonna non la espone a nessuno.</para>
    /// </summary>
    [Fact]
    public void QueryDelMenu_NonSelezionaAlcunaColonnaRiservata()
    {
        using AppDbContext relazionale = ContestoRelazionaleSenzaConnessione();

        string sql = PublicController.QueryDelMenu(relazionale).ToQueryString();
        string proiezione = ProiezioneSenzaFiltri(sql);

        proiezione.Should().NotContain("Codice").And.NotContain("AliquotaIva")
            .And.NotContain("CreatedAt").And.NotContain("UpdatedAt")
            .And.NotContain("UnitaDiMisura").And.NotContain("Attivo");
        // `Categoria` fra apici e senza suffisso: CategoriaVetrina è legittima e comincia con la
        // stessa parola.
        proiezione.Should().NotContain("`Categoria`");
        // Controprova che l'esclusione della WHERE non abbia svuotato l'istruzione: se questo
        // fallisse, le asserzioni qui sopra sarebbero verdi per costruzione.
        proiezione.Should().Contain("Prodotti").And.Contain("CategoriaVetrina");
    }

    [Fact]
    public void QueryDelMenu_ApplicaIlFiltroNellaClausolaWhere()
    {
        using AppDbContext relazionale = ContestoRelazionaleSenzaConnessione();

        string sql = PublicController.QueryDelMenu(relazionale).ToQueryString();

        string dopoWhere = sql[(sql.IndexOf("WHERE", StringComparison.Ordinal) + 5)..];
        dopoWhere.Should().Contain("Attivo").And.Contain("VisibileSulSito");
        sql.Should().Contain("LIMIT", "il tetto di 300 deve cadere nel database, non in memoria");
    }

    /// <summary>
    /// La lettura <b>non normalizza</b>: la forma canonica è stata scritta in fase di
    /// salvataggio. Un <c>LOWER(Cartella)</c> renderebbe il confronto non sargabile e l'indice
    /// <c>(Cartella, Ordinamento)</c> inutilizzabile per la selezione ordinata.
    /// </summary>
    [Fact]
    public void QueryDellaGalleria_ConfrontaLaColonnaSenzaApplicarleAlcunaFunzione()
    {
        using AppDbContext relazionale = ContestoRelazionaleSenzaConnessione();

        string sql = PublicController.QueryDellaGalleria(relazionale).ToQueryString();

        sql.Should().NotContain("LOWER").And.NotContain("UPPER");
        sql.Should().Contain("Cartella").And.Contain("Pubblicato");
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Impianto
    // ─────────────────────────────────────────────────────────────────────────────────────

    private async Task<MenuPubblicoDto> LeggiMenu()
    {
        ActionResult<MenuPubblicoDto> risultato = await _controller.Menu(CancellationToken.None);
        var ok = risultato.Result.Should().BeOfType<OkObjectResult>().Subject;
        return ok.Value.Should().BeOfType<MenuPubblicoDto>().Subject;
    }

    private async Task<SitoPubblicoDto> LeggiSito()
    {
        ActionResult<SitoPubblicoDto> risultato = await _controller.Site(CancellationToken.None);
        var ok = risultato.Result.Should().BeOfType<OkObjectResult>().Subject;
        return ok.Value.Should().BeOfType<SitoPubblicoDto>().Subject;
    }

    private async Task<GalleriaPubblicaDto> LeggiGalleria()
    {
        ActionResult<GalleriaPubblicaDto> risultato =
            await _controller.Galleria(CancellationToken.None);
        var ok = risultato.Result.Should().BeOfType<OkObjectResult>().Subject;
        return ok.Value.Should().BeOfType<GalleriaPubblicaDto>().Subject;
    }

    private static string[] NomiDeiProdotti(MenuPubblicoDto menu) =>
        menu.Categorie.SelectMany(c => c.Prodotti).Select(p => p.Nome).ToArray();

    private static int[] IdDeiProdotti(MenuPubblicoDto menu) =>
        menu.Categorie.SelectMany(c => c.Prodotti).Select(p => p.Id).ToArray();

    private static ProdottoPubblicoDto UnicoProdotto(MenuPubblicoDto menu) =>
        menu.Categorie.SelectMany(c => c.Prodotti).Single();

    private void AggiungiProdotto(
        int id,
        string nome,
        bool attivo = true,
        bool visibile = true,
        string? nomeVetrina = null,
        string? categoriaVetrina = "Caffetteria",
        string? categoriaContabile = null,
        string? descrizioneVetrina = null,
        string? descrizioneContabile = null,
        decimal prezzo = 3.80m,
        decimal? prezzoVetrina = null,
        int ordinamento = 0,
        MediaAsset? immagine = null)
    {
        _dbContext.Prodotti.Add(new Prodotto
        {
            ProdottoId = id,
            Codice = $"P{id:D4}",
            Nome = nome,
            Descrizione = descrizioneContabile,
            Prezzo = prezzo,
            Categoria = categoriaContabile,
            Attivo = attivo,
            VisibileSulSito = visibile,
            NomeVetrina = nomeVetrina,
            DescrizioneVetrina = descrizioneVetrina,
            CategoriaVetrina = categoriaVetrina,
            PrezzoVetrina = prezzoVetrina,
            OrdinamentoVetrina = ordinamento,
            Immagine = immagine,
            ImmagineId = immagine?.MediaAssetId,
        });
        _dbContext.SaveChanges();
    }

    private void AggiungiProdottiInSerie(int quantita)
    {
        for (int id = 1; id <= quantita; id++)
        {
            _dbContext.Prodotti.Add(new Prodotto
            {
                ProdottoId = id,
                Codice = $"P{id:D4}",
                Nome = $"Prodotto {id:D3}",
                Prezzo = 1m,
                Attivo = true,
                VisibileSulSito = true,
                CategoriaVetrina = "Caffetteria",
                OrdinamentoVetrina = id,
            });
        }

        _dbContext.SaveChanges();
    }

    private MediaAsset AggiungiMedia(
        int id,
        string chiave,
        string cartella = CartelleVetrina.Generale,
        bool pubblicato = true,
        int ordinamento = 0,
        string larghezze = "400,800")
    {
        var media = new MediaAsset
        {
            MediaAssetId = id,
            Chiave = chiave,
            NomeOriginale = $"{id}.jpg",
            MimeType = "image/jpeg",
            Larghezza = 900,
            Altezza = 600,
            LarghezzeDisponibili = larghezze,
            TestoAlternativo = "descrizione",
            Cartella = cartella,
            Ordinamento = ordinamento,
            Pubblicato = pubblicato,
        };

        _dbContext.MediaAssets.Add(media);
        _dbContext.SaveChanges();
        return media;
    }

    private void AggiungiImpostazioniVetrina(
        decimal? latitudine = null,
        decimal? longitudine = null,
        MediaAsset? immagineOg = null,
        string? turnstile = null)
    {
        _dbContext.ImpostazioniVetrina.Add(new ImpostazioniVetrina
        {
            InsegnaPubblica = "2D Gusto Bar",
            Via = "Via del Costo 99",
            Cap = "36016",
            Citta = "Thiene",
            Provincia = "VI",
            Latitudine = latitudine,
            Longitudine = longitudine,
            UrlInstagram = "https://www.instagram.com/2dgusto/",
            ImmagineOg = immagineOg,
            ImmagineOgId = immagineOg?.MediaAssetId,
            TurnstileSiteKey = turnstile,
        });
        _dbContext.SaveChanges();
    }

    private void AggiungiImpostazioniOperative(
        string apertura = "07:00",
        string chiusura = "20:00",
        string giorni = "[true,true,true,true,true,true,false]",
        string fuso = "Europe/Rome")
    {
        _dbContext.BusinessSettings.Add(new BusinessSettings
        {
            SettingsId = 1,
            BusinessName = "DuedGusto",
            OpeningTime = apertura,
            ClosingTime = chiusura,
            OperatingDays = giorni,
            Timezone = fuso,
        });
        _dbContext.SaveChanges();
    }

    /// <summary>
    /// Il giorno <b>nel fuso del locale</b>, calcolato come lo calcola la rotta. Non
    /// <c>DateTime.Today</c>: il test girerebbe verde su una macchina europea e rosso in CI a
    /// mezzanotte, che è il modo peggiore di scoprire un fuso sbagliato.
    /// </summary>
    private static DateOnly Oggi => DateOnly.FromDateTime(
        TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Europe/Rome")));

    private static string Iso(DateOnly data) =>
        data.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private void AggiungiChiusura(
        DateOnly data,
        string descrizione,
        string motivo,
        bool ricorrente = false)
    {
        _dbContext.GiorniNonLavorativi.Add(new GiornoNonLavorativo
        {
            Data = data,
            Descrizione = descrizione,
            CodiceMotivo = motivo,
            Ricorrente = ricorrente,
            SettingsId = 1,
        });
        _dbContext.SaveChanges();
    }

    private int AvvisiRegistrati() =>
        _logger.Invocations.Count(invocazione =>
            invocazione.Method.Name == nameof(ILogger.Log)
            && (LogLevel)invocazione.Arguments[0] == LogLevel.Warning);

    private bool AvvisoContiene(string frammento) =>
        _logger.Invocations.Any(invocazione =>
            invocazione.Method.Name == nameof(ILogger.Log)
            && (LogLevel)invocazione.Arguments[0] == LogLevel.Warning
            && invocazione.Arguments[2]?.ToString()?.Contains(frammento, StringComparison.Ordinal) == true);

    /// <summary>Tutte le chiavi del JSON serializzato, come farebbe <c>jq 'paths'</c>.</summary>
    private static string[] ChiaviDelJson<T>(T oggetto)
    {
        string json = JsonSerializer.Serialize(oggetto,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        using JsonDocument documento = JsonDocument.Parse(json);
        var chiavi = new List<string>();
        Visita(documento.RootElement, chiavi);
        return [.. chiavi];

        static void Visita(JsonElement elemento, List<string> chiavi)
        {
            switch (elemento.ValueKind)
            {
                case JsonValueKind.Object:
                    foreach (JsonProperty property in elemento.EnumerateObject())
                    {
                        chiavi.Add(property.Name);
                        Visita(property.Value, chiavi);
                    }

                    break;
                case JsonValueKind.Array:
                    foreach (JsonElement voce in elemento.EnumerateArray()) Visita(voce, chiavi);
                    break;
            }
        }
    }

    /// <summary>
    /// L'istruzione <b>senza le clausole di filtro</b>: restano entrambe le liste di proiezione
    /// (quella della sottoquery e quella esterna), che è ciò che la query porta davvero a casa.
    ///
    /// <para>⚠️ È la formulazione precisa del divieto: <c>Attivo</c> <b>deve</b> comparire nella
    /// <c>WHERE</c>, perché è metà della regola di pubblicazione, e non deve comparire in alcuna
    /// <c>SELECT</c>. Un filtro che nomina una colonna non la espone a nessuno.</para>
    /// </summary>
    private static string ProiezioneSenzaFiltri(string sql) =>
        string.Join('\n', sql.Split('\n')
            .Select(riga => riga.Trim())
            .Where(riga => !riga.StartsWith("WHERE", StringComparison.Ordinal)));

    /// <summary>
    /// Contesto sul provider MySQL reale, usato solo per <b>generare</b> SQL: né <c>UseMySql</c>
    /// con versione esplicita né <c>ToQueryString()</c> aprono una connessione, quindi il test non
    /// richiede alcun MySQL in esecuzione. Il provider InMemory non genera SQL affatto.
    /// </summary>
    private static AppDbContext ContestoRelazionaleSenzaConnessione()
    {
        DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("server=nessuno;database=nessuno;user=nessuno;password=nessuno",
                new MySqlServerVersion(new Version(8, 0, 32)))
            .Options;

        return new AppDbContext(options, new Mock<IConfiguration>().Object);
    }
}
