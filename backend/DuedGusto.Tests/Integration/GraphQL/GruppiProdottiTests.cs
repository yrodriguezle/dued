using GraphQL;

using duedgusto.GraphQL.Vendite;
using duedgusto.GraphQL.Vendite.Types;
using duedgusto.Models;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// I gruppi di prodotti: un tasto solo dove al banco ce ne sono dieci.
///
/// <para>🔴 <b>Il molti-a-molti è la proprietà da difendere.</b> Lo stesso spritz sta sotto
/// «Spritz» e sotto «Aperitivi», e comparirà sotto <b>entrambi</b> i tastoni: è voluto, non un
/// duplicato da deduplicare. Un 1:N mascherato da N:N — un prodotto che sparisce dal primo
/// gruppo quando lo si mette nel secondo — passerebbe ogni test scritto su un gruppo solo.</para>
/// </summary>
public class GruppiProdottiTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public GruppiProdottiTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    private Prodotto SeedProdotto(string codice, decimal prezzo = 3.50m, bool attivo = true)
    {
        var prodotto = new Prodotto
        {
            Codice = codice,
            Nome = $"Prodotto {codice}",
            Prezzo = prezzo,
            AliquotaIva = 10m,
            Categoria = "APERITIVI",
            Attivo = attivo,
        };
        _dbContext.Prodotti.Add(prodotto);
        _dbContext.SaveChanges();
        return prodotto;
    }

    private static GruppoProdottiInput Gruppo(string codice, string nome, params (int prodottoId, int ordine)[] membri) => new()
    {
        Codice = codice,
        Nome = nome,
        Attivo = true,
        Membri = membri.Select(m => new MembroGruppoInput { ProdottoId = m.prodottoId, Ordinamento = m.ordine }).ToList(),
    };

    // ── La composizione ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UnGruppo_NasceConISuoiMembriNellOrdineScelto()
    {
        Prodotto aperol = SeedProdotto("SPR-APEROL");
        Prodotto campari = SeedProdotto("SPR-CAMPARI");

        GruppoProdotti creato = await VenditeMutations.UpsertGruppoProdottiAsync(
            _dbContext, Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1), (campari.ProdottoId, 2)));

        creato.Membri.Should().HaveCount(2);
        creato.Membri.OrderBy(m => m.Ordinamento).Select(m => m.ProdottoId)
            .Should().Equal(aperol.ProdottoId, campari.ProdottoId);
    }

    [Fact]
    public async Task UnProdotto_PuoStareInDueGruppi_ConOrdiniDiversi()
    {
        // 🔴 LA proprietà del molti-a-molti. Se il secondo gruppo togliesse il prodotto al
        //    primo, l'errore si vedrebbe solo al banco — un tastone che perde una variante — e
        //    ogni test scritto su un gruppo solo resterebbe verde.
        Prodotto aperol = SeedProdotto("SPR-APEROL");

        await VenditeMutations.UpsertGruppoProdottiAsync(_dbContext, Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1)));
        await VenditeMutations.UpsertGruppoProdottiAsync(_dbContext, Gruppo("APERITIVI", "Aperitivi", (aperol.ProdottoId, 3)));

        List<ProdottoGruppo> appartenenze = await _dbContext.ProdottiGruppi
            .Where(m => m.ProdottoId == aperol.ProdottoId)
            .ToListAsync();

        appartenenze.Should().HaveCount(2);
        appartenenze.Select(m => m.Ordinamento).Should().BeEquivalentTo([1, 3]);
    }

    [Fact]
    public async Task LoStessoProdottoDueVolteNelloStessoGruppo_VieneRifiutato()
    {
        // Violerebbe la chiave composita: meglio un messaggio leggibile che l'eccezione grezza
        // del database. ⚠️ Da non confondere col caso sopra, che è legittimo.
        Prodotto aperol = SeedProdotto("SPR-APEROL");

        Func<Task> tentativo = () => VenditeMutations.UpsertGruppoProdottiAsync(
            _dbContext, Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1), (aperol.ProdottoId, 2)));

        await tentativo.Should().ThrowAsync<ExecutionError>()
            .WithMessage("*due volte nello stesso gruppo*");
    }

    [Fact]
    public async Task RiaggiornareUnGruppo_SostituisceIMembri_NonLiAccumula()
    {
        Prodotto aperol = SeedProdotto("SPR-APEROL");
        Prodotto campari = SeedProdotto("SPR-CAMPARI");
        Prodotto cynar = SeedProdotto("SPR-CYNAR");

        GruppoProdotti gruppo = await VenditeMutations.UpsertGruppoProdottiAsync(
            _dbContext, Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1), (campari.ProdottoId, 2)));

        GruppoProdottiInput aggiornato = Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1), (cynar.ProdottoId, 2));
        aggiornato.GruppoProdottiId = gruppo.GruppoProdottiId;
        await VenditeMutations.UpsertGruppoProdottiAsync(_dbContext, aggiornato);

        List<int> membri = await _dbContext.ProdottiGruppi
            .Where(m => m.GruppoProdottiId == gruppo.GruppoProdottiId)
            .Select(m => m.ProdottoId)
            .ToListAsync();

        membri.Should().BeEquivalentTo([aperol.ProdottoId, cynar.ProdottoId],
            "l'elenco è una sostituzione totale: Campari è stato tolto, non affiancato");
    }

    [Fact]
    public async Task RinominareUnGruppoSenzaInviareIMembri_NonSvuotaLaComposizione()
    {
        // 🔴 `null` significa «non toccare l'elenco», lista vuota significa «svuotalo».
        //    Appiattirle su una sola cancellerebbe la composizione a ogni rinomina, in silenzio:
        //    svuotare un gruppo non è un errore, quindi nulla lo segnalerebbe.
        Prodotto aperol = SeedProdotto("SPR-APEROL");
        GruppoProdotti gruppo = await VenditeMutations.UpsertGruppoProdottiAsync(
            _dbContext, Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1)));

        await VenditeMutations.UpsertGruppoProdottiAsync(_dbContext, new GruppoProdottiInput
        {
            GruppoProdottiId = gruppo.GruppoProdottiId,
            Codice = "SPRITZ",
            Nome = "Spritz e affini",
            Attivo = true,
            Membri = null,
        });

        _dbContext.ProdottiGruppi.Count(m => m.GruppoProdottiId == gruppo.GruppoProdottiId).Should().Be(1);
    }

    [Fact]
    public async Task UnCodiceDuplicato_DaUnMessaggioLeggibile()
    {
        await VenditeMutations.UpsertGruppoProdottiAsync(_dbContext, Gruppo("SPRITZ", "Spritz"));

        Func<Task> tentativo = () => VenditeMutations.UpsertGruppoProdottiAsync(_dbContext, Gruppo("SPRITZ", "Altro spritz"));

        await tentativo.Should().ThrowAsync<ExecutionError>().WithMessage("*Esiste già un gruppo con codice*");
    }

    [Fact]
    public async Task UnProdottoInesistente_VieneRifiutatoPrimaDiScrivere()
    {
        Func<Task> tentativo = () => VenditeMutations.UpsertGruppoProdottiAsync(
            _dbContext, Gruppo("SPRITZ", "Spritz", (9999, 1)));

        await tentativo.Should().ThrowAsync<ExecutionError>().WithMessage("*non esiste*");
        _dbContext.GruppiProdotti.Should().BeEmpty("la validazione precede ogni scrittura");
    }

    // ── Lo scioglimento ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SciogliereUnGruppo_NonPortaViaIProdotti()
    {
        // 🔴 La cascata è sulle APPARTENENZE, non sui prodotti. Un gruppo si scioglie spesso;
        //    un prodotto non si elimina mai — non esiste `eliminaProdotto`, e le vendite lo
        //    referenziano.
        Prodotto aperol = SeedProdotto("SPR-APEROL");
        GruppoProdotti gruppo = await VenditeMutations.UpsertGruppoProdottiAsync(
            _dbContext, Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1)));

        _dbContext.GruppiProdotti.Remove(await _dbContext.GruppiProdotti
            .Include(g => g.Membri)
            .FirstAsync(g => g.GruppoProdottiId == gruppo.GruppoProdottiId));
        await _dbContext.SaveChangesAsync();

        _dbContext.Prodotti.Count(p => p.ProdottoId == aperol.ProdottoId).Should().Be(1);
        _dbContext.ProdottiGruppi.Should().BeEmpty();
    }

    // ── Il prezzo del tastone ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task IlPrezzoDelTastone_EIlMinimoDeiMembriATTIVI()
    {
        // ⚠️ Una variante disattivata resta nell'appartenenza — i prodotti non si eliminano — e
        //    se entrasse nel minimo il tastone direbbe «da 2,00 €» per una voce che al banco
        //    non si può più battere.
        Prodotto economico = SeedProdotto("SPR-VECCHIO", prezzo: 2.00m, attivo: false);
        Prodotto aperol = SeedProdotto("SPR-APEROL", prezzo: 3.50m);
        Prodotto premium = SeedProdotto("SPR-PROSECCO", prezzo: 4.00m);

        await VenditeMutations.UpsertGruppoProdottiAsync(_dbContext, Gruppo(
            "SPRITZ", "Spritz", (economico.ProdottoId, 1), (aperol.ProdottoId, 2), (premium.ProdottoId, 3)));

        GruppoProdotti letto = await _dbContext.GruppiProdotti
            .Include(g => g.Membri).ThenInclude(m => m.Prodotto)
            .FirstAsync();

        List<decimal> prezziAttivi = letto.Membri.Where(m => m.Prodotto.Attivo).Select(m => m.Prodotto.Prezzo).ToList();
        prezziAttivi.Min().Should().Be(3.50m);
        (prezziAttivi.Min() == prezziAttivi.Max()).Should().BeFalse("le varianti costano diverso: il tastone dice «da»");
    }

    // ── I prodotti sciolti ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SpegnereUnGruppo_FaRIAPPARIRE_iSuoiMembriFraISciolti()
    {
        // 🔴 Se il filtro dei non raggruppati guardasse l'appartenenza invece che i gruppi
        //    ATTIVI, spegnere un gruppo farebbe sparire i suoi membri dalla griglia: invisibili
        //    e invendibili, senza che nessuno li abbia disattivati.
        Prodotto aperol = SeedProdotto("SPR-APEROL");
        Prodotto caffe = SeedProdotto("CAF-ESPRESSO", prezzo: 1.20m);

        GruppoProdotti gruppo = await VenditeMutations.UpsertGruppoProdottiAsync(
            _dbContext, Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1)));

        List<string> scioltiPrima = await _dbContext.Prodotti
            .Where(p => p.Attivo && !p.Gruppi.Any(g => g.Gruppo.Attivo))
            .Select(p => p.Codice).ToListAsync();
        scioltiPrima.Should().Equal(caffe.Codice);

        gruppo.Attivo = false;
        await _dbContext.SaveChangesAsync();

        List<string> scioltiDopo = await _dbContext.Prodotti
            .Where(p => p.Attivo && !p.Gruppi.Any(g => g.Gruppo.Attivo))
            .Select(p => p.Codice).OrderBy(c => c).ToListAsync();
        scioltiDopo.Should().BeEquivalentTo([caffe.Codice, aperol.Codice]);
    }

    // ── Il colore esplicito ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task IlColoreDelProdotto_SiSalvaENonTocaQuelloDelGruppo()
    {
        // I due colori sono indipendenti: quello della bevanda sta sul prodotto, quello del
        // tastone sul gruppo, e nessuno dei due si deriva dall'altro.
        Prodotto aperol = SeedProdotto("SPR-APEROL");

        await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            ProdottoId = aperol.ProdottoId,
            Codice = aperol.Codice,
            Nome = aperol.Nome,
            Prezzo = aperol.Prezzo,
            Categoria = "APERITIVI",
            AliquotaIva = 10m,
            Attivo = true,
            Colore = "#F4801A",
        });

        GruppoProdottiInput input = Gruppo("SPRITZ", "Spritz", (aperol.ProdottoId, 1));
        input.Colore = "#B02A37";
        await VenditeMutations.UpsertGruppoProdottiAsync(_dbContext, input);

        (await _dbContext.Prodotti.FirstAsync(p => p.ProdottoId == aperol.ProdottoId)).Colore.Should().Be("#F4801A");
        (await _dbContext.GruppiProdotti.FirstAsync()).Colore.Should().Be("#B02A37");
    }

    [Fact]
    public async Task UnUpsertSenzaColore_NonAzzeraQuelloEsistente()
    {
        // Stessa trappola di `Ordinamento`: l'upsert assegna ogni campo, e un colore non
        // inviato tornerebbe a null — la variante perderebbe la sua tinta al primo ritocco di
        // prezzo dall'anagrafica.
        Prodotto aperol = SeedProdotto("SPR-APEROL");
        aperol.Colore = "#F4801A";
        await _dbContext.SaveChangesAsync();

        await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            ProdottoId = aperol.ProdottoId,
            Codice = aperol.Codice,
            Nome = aperol.Nome,
            Prezzo = 3.80m,
            Categoria = "APERITIVI",
            AliquotaIva = 10m,
            Attivo = true,
        });

        (await _dbContext.Prodotti.FirstAsync(p => p.ProdottoId == aperol.ProdottoId)).Colore.Should().Be("#F4801A");
    }
}
