using GraphQL;
using GraphQL.Types;
using Microsoft.EntityFrameworkCore;
using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.GraphQL;
using duedgusto.Services.Jwt;
using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.GestioneCassa;

namespace duedgusto.GraphQL.Vendite;

using duedgusto.GraphQL.Vendite.Types;

public class VenditeMutations : ObjectGraphType
{
    public VenditeMutations()
    {
        Name = "VenditeMutation";

        // 🔴 Autorizzazione a livello di TIPO, e copre da sé ogni campo aggiunto qui dentro —
        //    comprese tutte le mutation d'ordine. È la ragione per cui gli ordini stanno sotto
        //    `vendite` invece che in un ramo root proprio: /graphql è montato con
        //    AuthorizationRequired = false, quindi un modulo che nascesse senza questa riga
        //    sarebbe PUBBLICO per default, e la dimenticanza non avrebbe sintomi.
        this.Authorize();

        // ── Ordini: composizione ─────────────────────────────────────────────────────────────
        // Nessuna di queste tre tocca un secchio del registro né il breakdown IVA. Non c'è un
        // ramo di codice che decide di saltare il delta: c'è un percorso che il delta non lo
        // attraversa proprio. Un ordine aperto è una pre-vendita, non un incasso.

        Field<NonNullGraphType<OrdineType>>("apriOrdine")
            .Description("Apre un conto al bancone sul registro indicato. Non muove nulla.")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId", "ID registro cassa")
            .ResolveAsync(async context => await ApriOrdineAsync(context));

        Field<NonNullGraphType<RigaOrdineType>>("aggiungiRigaOrdine")
            .Description("Batte una voce sull'ordine aperto, congelandone prezzo e aliquota.")
            .Argument<NonNullGraphType<IntGraphType>>("ordineId", "ID ordine")
            .Argument<NonNullGraphType<IntGraphType>>("prodottoId", "ID prodotto")
            .Argument<NonNullGraphType<DecimalGraphType>>("quantita", "Quantità")
            .Argument<StringGraphType>("note", "Note di riga")
            .ResolveAsync(async context => await AggiungiRigaOrdineAsync(context));

        Field<NonNullGraphType<RigaOrdineType>>("aggiornaRigaOrdine")
            .Description("Cambia la quantità di una voce. Il prezzo resta quello del tocco.")
            .Argument<NonNullGraphType<IntGraphType>>("rigaOrdineId", "ID riga ordine")
            .Argument<NonNullGraphType<DecimalGraphType>>("quantita", "Nuova quantità")
            .ResolveAsync(async context => await AggiornaRigaOrdineAsync(context));

        Field<NonNullGraphType<BooleanGraphType>>("rimuoviRigaOrdine")
            .Description("Toglie una voce da un ordine ancora aperto.")
            .Argument<NonNullGraphType<IntGraphType>>("rigaOrdineId", "ID riga ordine")
            .ResolveAsync(async context => (object)await RimuoviRigaOrdineAsync(context));

        // ── Ordini: transizioni ──────────────────────────────────────────────────────────────
        // Qui vive l'unica scrittura sui secchi di tutto il backend, e questi quattro campi non
        // ne sanno nulla: delegano interamente agli orchestrator, dove sta la guardia che rende
        // ogni transizione una-e-una-sola-volta. Una riga di logica in più qui sarebbe una
        // seconda strada verso un delta che non è idempotente.

        Field<NonNullGraphType<EsitoChiusuraOrdineType>>("chiudiOrdine")
            .Description("Incassa l'ordine. Un taglio = chiusura semplice, 2..n = split, "
                + "in una sola transazione.")
            .Argument<NonNullGraphType<ChiudiOrdineInputType>>("input", "Ordine e tagli")
            .ResolveAsync(async context => await ChiudiOrdineAsync(context));

        Field<NonNullGraphType<OrdineType>>("annullaOrdine")
            .Description("Butta via un conto aperto che nessuno incasserà. Motivo obbligatorio.")
            .Argument<NonNullGraphType<IntGraphType>>("ordineId", "ID ordine")
            .Argument<NonNullGraphType<StringGraphType>>("motivo", "Perché lo si annulla")
            .ResolveAsync(async context => await AnnullaOrdineAsync(context));

        Field<NonNullGraphType<OrdineType>>("stornaOrdine")
            .Description("Disfa un incasso già dichiarato: solo amministratori, motivo obbligatorio.")
            .Argument<NonNullGraphType<IntGraphType>>("ordineId", "ID ordine")
            .Argument<NonNullGraphType<StringGraphType>>("motivo", "Perché lo si storna")
            .ResolveAsync(async context => await StornaOrdineAsync(context));

        // ── Vendite: le due mutation legacy rimaste ──────────────────────────────────────────
        // 🔴 `creaVendita` NON esiste più, ed è una rimozione, non una deprecazione: finché il
        //    campo risponde, i due regimi convivono — uno che muove i secchi al momento della
        //    riga e uno che li muove alla chiusura dell'ordine — cioè esattamente il difetto per
        //    cui questo change esiste, tenuto in vita da un commento. Le Vendita nascono ora solo
        //    dentro ChiudiOrdineOrchestrator. Un test pinna l'assenza del campo dallo schema.
        //
        // ⚠️ `aggiornaVendita`/`eliminaVendita` sopravvivono per le sole righe di sviluppo nate
        //    prima degli ordini (OrdineId is null) e rifiutano tutte le altre: poiché ogni nuova
        //    vendita ha un OrdineId, la guardia le chiude STRUTTURALMENTE, non per disciplina.

        // Update sale
        Field<VenditaType>("aggiornaVendita")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID vendita")
            .Argument<NonNullGraphType<AggiornaVenditaInputType>>("input", "Dati aggiornamento")
            .ResolveAsync(async context => await AggiornaVenditaAsync(context));

        // Delete sale
        Field<BooleanGraphType>("eliminaVendita")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID vendita")
            .ResolveAsync(async context => (object)await EliminaVenditaAsync(context));

        // Create/update product (unico punto di amministrazione prodotti, UI fuori scope)
        Field<ProdottoType>("mutateProdotto")
            .Argument<NonNullGraphType<ProdottoInputType>>("prodotto", "Dati prodotto")
            .ResolveAsync(async context => await MutateProdottoAsync(context));
    }

    // ══ Ordini ═══════════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// L'utente che sta agendo, letto dal JWT e non da un argomento: chi annulla o storna lo
    /// dichiara il token, non il client. Un id passato dal chiamante renderebbe la traccia
    /// un'informazione fornita da chi va tracciato.
    /// </summary>
    private static int UtenteCorrente(IResolveFieldContext<object?> context)
    {
        JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
        var userContext = context.UserContext as GraphQLUserContext
            ?? throw new ExecutionError("Utente non autenticato");
        return jwtHelper.GetUserID(userContext.Principal!);
    }

    private static async Task<Ordine> ApriOrdineAsync(IResolveFieldContext<object?> context)
    {
        ApriOrdineOrchestrator orchestrator = GraphQLService.GetService<ApriOrdineOrchestrator>(context);
        var registroCassaId = context.GetArgument<int>("registroCassaId");
        return await orchestrator.ExecuteAsync(registroCassaId, UtenteCorrente(context));
    }

    private static async Task<EsitoChiusuraOrdine> ChiudiOrdineAsync(IResolveFieldContext<object?> context)
    {
        ChiudiOrdineOrchestrator orchestrator = GraphQLService.GetService<ChiudiOrdineOrchestrator>(context);
        ChiudiOrdineInput input = context.GetArgument<ChiudiOrdineInput>("input");
        return await orchestrator.ExecuteAsync(input, UtenteCorrente(context));
    }

    private static async Task<Ordine> AnnullaOrdineAsync(IResolveFieldContext<object?> context)
    {
        AnnullaOrdineOrchestrator orchestrator = GraphQLService.GetService<AnnullaOrdineOrchestrator>(context);
        var ordineId = context.GetArgument<int>("ordineId");
        var motivo = context.GetArgument<string>("motivo");
        return await orchestrator.ExecuteAsync(ordineId, motivo, UtenteCorrente(context));
    }

    private static async Task<Ordine> StornaOrdineAsync(IResolveFieldContext<object?> context)
    {
        StornaOrdineOrchestrator orchestrator = GraphQLService.GetService<StornaOrdineOrchestrator>(context);
        var ordineId = context.GetArgument<int>("ordineId");
        var motivo = context.GetArgument<string>("motivo");
        // Il controllo del ruolo amministratore sta dentro l'orchestrator ed è la prima cosa che
        // esegue: chi non può stornare non deve sapere nemmeno se l'ordine esiste.
        return await orchestrator.ExecuteAsync(ordineId, motivo, UtenteCorrente(context));
    }

    /// <summary>
    /// Il contesto delle tre mutation di riga: l'ordine, il suo registro e l'identificativo
    /// leggibile, con le due guardie già passate.
    ///
    /// <para>⚠️ Lo stato si controlla anche qui, benché nessuna riga muova un secchio: su un
    /// ordine già chiuso una voce in più cambierebbe il totale <b>dopo</b> che le <c>Vendita</c>
    /// sono nate, e il conto smetterebbe di corrispondere all'incasso senza che nulla lo dica. La
    /// garanzia una-e-una-sola-volta resta della transizione; questa è la sua estensione naturale
    /// a ciò che l'ordine contiene.</para>
    /// </summary>
    private static async Task<OrdineInLavorazione> CaricaOrdineApertoAsync(
        IResolveFieldContext<object?> context, AppDbContext dbContext, int ordineId)
    {
        Ordine ordine = await dbContext.Ordini
                .FirstOrDefaultAsync(o => o.OrdineId == ordineId)
            ?? throw new ExecutionError($"Ordine con ID {ordineId} non trovato.");

        RegistroCassa registro = await dbContext.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == ordine.RegistroCassaId)
            ?? throw new ExecutionError($"Registro cassa con ID {ordine.RegistroCassaId} non trovato.");

        string identificativo = TransizioneOrdine.Identificativo(ordine, registro.Data);
        TransizioneOrdine.GuardStatoAtteso(ordine, StatiOrdine.Aperto, identificativo);

        ChiusuraMensileService chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        await GestioneCassaGuards.GuardMeseChiuso(chiusuraService, registro.Data);

        return new OrdineInLavorazione(ordine, identificativo);
    }

    /// <summary>
    /// Una quantità nulla o negativa sarebbe uno sconto travestito da voce: cambierebbe il totale
    /// del conto senza che nulla, né in cassa né nel breakdown IVA, sappia dire da dove viene.
    /// </summary>
    private static void GuardQuantita(decimal quantita, string identificativo)
    {
        if (quantita <= 0)
        {
            throw new ExecutionError(
                $"La quantità di una voce dell'ordine {identificativo} deve essere maggiore di zero: " +
                "per togliere una voce si usa rimuoviRigaOrdine.");
        }
    }

    private static async Task<RigaOrdine> AggiungiRigaOrdineAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var ordineId = context.GetArgument<int>("ordineId");
        var prodottoId = context.GetArgument<int>("prodottoId");
        var quantita = context.GetArgument<decimal>("quantita");
        var note = context.GetArgument<string?>("note");

        OrdineInLavorazione ordine = await CaricaOrdineApertoAsync(context, dbContext, ordineId);
        GuardQuantita(quantita, ordine.Identificativo);

        Prodotto prodotto = await dbContext.Prodotti
                .FirstOrDefaultAsync(p => p.ProdottoId == prodottoId)
            ?? throw new ExecutionError($"Prodotto con ID {prodottoId} non trovato.");

        if (!prodotto.Attivo)
        {
            throw new ExecutionError(
                $"Il prodotto «{prodotto.Nome}» non è più a listino e non si può battere. " +
                "Riattivalo in anagrafica se serve ancora.");
        }

        DateTime adesso = DateTime.UtcNow;
        var riga = new RigaOrdine
        {
            OrdineId = ordine.Ordine.OrdineId,
            ProdottoId = prodotto.ProdottoId,
            Quantita = quantita,
            // 🔴 Lo snapshot si prende ADESSO, non alla chiusura: è il prezzo detto al cliente
            //    quando la voce è stata battuta, e un ritocco di listino a ordine aperto non deve
            //    cambiare il conto sotto al cliente. La Vendita erediterà questi due valori.
            PrezzoUnitario = prodotto.Prezzo,
            AliquotaIva = prodotto.AliquotaIva,
            PrezzoTotale = TotaleRiga(quantita, prodotto.Prezzo),
            Note = note,
            DataOra = adesso,
            CreatedAt = adesso,
            UpdatedAt = adesso,
        };

        dbContext.RigheOrdine.Add(riga);
        await dbContext.SaveChangesAsync();

        // ⚠️ Nessun SecchiIncassiApplier, nessun BreakdownIvaApplier, nessun evento: l'ordine è
        //    aperto e non ha incassato nulla. Non è una dimenticanza, è il percorso.
        return riga;
    }

    private static async Task<RigaOrdine> AggiornaRigaOrdineAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var rigaOrdineId = context.GetArgument<int>("rigaOrdineId");
        var quantita = context.GetArgument<decimal>("quantita");

        RigaOrdine riga = await dbContext.RigheOrdine
                .FirstOrDefaultAsync(r => r.RigaOrdineId == rigaOrdineId)
            ?? throw new ExecutionError($"Voce con ID {rigaOrdineId} non trovata.");

        OrdineInLavorazione ordine = await CaricaOrdineApertoAsync(context, dbContext, riga.OrdineId);
        GuardQuantita(quantita, ordine.Identificativo);

        riga.Quantita = quantita;
        // Il prezzo unitario NON si riprende dal listino: resta quello del tocco. Rileggerlo qui
        // farebbe cambiare il conto a un cliente che ha già sentito dire l'altro prezzo.
        riga.PrezzoTotale = TotaleRiga(quantita, riga.PrezzoUnitario);
        riga.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
        return riga;
    }

    private static async Task<bool> RimuoviRigaOrdineAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var rigaOrdineId = context.GetArgument<int>("rigaOrdineId");

        RigaOrdine riga = await dbContext.RigheOrdine
                .FirstOrDefaultAsync(r => r.RigaOrdineId == rigaOrdineId)
            ?? throw new ExecutionError($"Voce con ID {rigaOrdineId} non trovata.");

        // ⚠️ «Le RigaOrdine non si cancellano mai» vale per le TRANSIZIONI dell'ordine — lo storno
        //    conserva le righe, altrimenti sarebbe indistinguibile da un ordine mai esistito.
        //    Togliere una voce da un conto ancora aperto è un'altra cosa: è la correzione di un
        //    tocco sbagliato, prima che esista qualunque incasso da spiegare. La guardia di stato
        //    qui sopra è ciò che tiene separati i due casi.
        await CaricaOrdineApertoAsync(context, dbContext, riga.OrdineId);

        dbContext.RigheOrdine.Remove(riga);
        await dbContext.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Il totale di riga, arrotondato al centesimo come la colonna che lo ospita
    /// (<c>decimal(10,2)</c>) e con lo stesso <c>MidpointRounding.ToEven</c> di
    /// <c>IvaCalculator</c>: un valore in memoria più preciso della colonna diventerebbe un altro
    /// numero alla rilettura, e lo scorporo IVA della chiusura partirebbe da un lordo diverso da
    /// quello mostrato al cliente.
    /// </summary>
    private static decimal TotaleRiga(decimal quantita, decimal prezzoUnitario)
        => Math.Round(quantita * prezzoUnitario, 2, MidpointRounding.ToEven);

    private sealed record OrdineInLavorazione(Ordine Ordine, string Identificativo);

    // ══ Vendite ══════════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Snapshot IVA di riga: scorporo da PrezzoTotale con l'aliquota snapshot vigente
    /// (percentuale → frazione SOLO via IvaCalculator.AliquotaDaPercentuale).
    /// Garantisce Imponibile + ImportoIva == PrezzoTotale al centesimo.
    /// </summary>
    public static void RicalcolaImportiSnapshot(Vendita sale)
    {
        RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(
            sale.PrezzoTotale, IvaCalculator.AliquotaDaPercentuale(sale.AliquotaIva));
        sale.Imponibile = scorporo.Imponibile;
        sale.ImportoIva = scorporo.Iva;
    }

    /// <summary>
    /// Metodo di pagamento assente → contante non tracciato, l'unico dei tre che non muove
    /// alcun secchio. Metodo presente ma sconosciuto → errore parlante <b>prima</b> del save:
    /// accettarlo in silenzio produrrebbe una vendita che non finisce in nessun incasso e non
    /// lo dice a nessuno.
    /// </summary>
    private static string MetodoValidato(string? metodo)
    {
        if (string.IsNullOrWhiteSpace(metodo))
        {
            return MetodiPagamentoVendita.ContanteNonTracciato;
        }

        if (!MetodiPagamentoVendita.IsAmmesso(metodo))
        {
            throw new ExecutionError(
                $"Metodo di pagamento non ammesso: {metodo}. Valori ammessi: " +
                string.Join(", ", MetodiPagamentoVendita.Ammessi) + ".");
        }

        return metodo;
    }

    /// <summary>
    /// 🔴 La chiusura strutturale delle due mutation legacy.
    ///
    /// <para>Una <c>Vendita</c> nata da un ordine si disfa <b>stornando l'ordine</b>, mai riga per
    /// riga: correggerla qui muoverebbe i secchi una seconda volta — <c>ApplicaDelta</c> non è
    /// idempotente — lasciando l'<c>Ordine</c> a raccontare un incasso che non corrisponde più a
    /// nulla, e nessun controllo a valle se ne accorgerebbe.</para>
    ///
    /// <para>⚠️ Non è disciplina, è <b>impossibilità</b>: poiché ogni nuova vendita nasce con un
    /// <c>OrdineId</c>, questa guardia rifiuta tutto ciò che è nato dopo gli ordini. Restano
    /// modificabili solo le righe di sviluppo precedenti (<c>OrdineId is null</c>) — in produzione
    /// nessuna, perché <c>Vendite</c> era vuota — e con quelle spariranno anche queste due
    /// mutation.</para>
    /// </summary>
    private static void GuardVenditaDiUnOrdine(Vendita sale)
    {
        if (sale.OrdineId is not null)
        {
            throw new ExecutionError(
                $"Questa vendita appartiene all'ordine {sale.OrdineId} e non si corregge riga per riga: " +
                "usa stornaOrdine e ribatti. Correggerla qui muoverebbe i secchi una seconda volta.");
        }
    }

    /// <summary>
    /// Applica l'aggiornamento alla vendita (senza SaveChanges): al cambio prodotto
    /// riprende prezzo E aliquota correnti del nuovo prodotto; senza cambio prodotto
    /// lo snapshot aliquota resta immutato (storico). Gli importi snapshot vengono
    /// ricalcolati SOLO se PrezzoTotale o aliquota snapshot cambiano (update solo-note
    /// → snapshot intatto), sempre con l'aliquota snapshot vigente.
    /// </summary>
    public static async Task ApplicaAggiornamentoVenditaAsync(
        AppDbContext dbContext, Vendita sale, AggiornaVenditaInput input)
    {
        decimal prezzoTotalePrecedente = sale.PrezzoTotale;
        decimal aliquotaPrecedente = sale.AliquotaIva;

        // Verify product if changed
        if (input.ProdottoId.HasValue && input.ProdottoId.Value != sale.ProdottoId)
        {
            Prodotto? product = await dbContext.Prodotti
                      .FirstOrDefaultAsync(p => p.ProdottoId == input.ProdottoId.Value);

            if (product == null)
            {
                throw new InvalidOperationException("Prodotto non trovato");
            }

            sale.ProdottoId = product.ProdottoId;
            sale.PrezzoUnitario = product.Prezzo;
            sale.AliquotaIva = product.AliquotaIva;
            sale.Prodotto = product;
        }

        if (input.Quantita.HasValue)
        {
            sale.Quantita = input.Quantita.Value;
        }

        if (input.Note != null)
        {
            sale.Note = input.Note;
        }

        if (input.MetodoPagamento != null)
        {
            sale.MetodoPagamento = MetodoValidato(input.MetodoPagamento);
        }

        sale.PrezzoTotale = sale.Quantita * sale.PrezzoUnitario;

        if (sale.PrezzoTotale != prezzoTotalePrecedente || sale.AliquotaIva != aliquotaPrecedente)
        {
            RicalcolaImportiSnapshot(sale);
        }

        sale.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Riallinea i totali e il breakdown IVA del registro dalla somma delle Vendite
    /// persistite (punto di calcolo unico, condiviso con l'orchestrator del registro).
    /// Pattern due-save: la vendita è già persistita, qui si salva il registro.
    /// </summary>
    private static async Task ApplicaBreakdownRegistroAsync(
        AppDbContext dbContext, RegistroCassa register, ILogger logger)
    {
        BusinessSettings settings = await dbContext.BusinessSettings.FirstAsync();
        await BreakdownIvaApplier.ApplicaAsync(dbContext, register, settings.VatRate, logger);
        register.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
    }

    private static async Task<Vendita> AggiornaVenditaAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var id = context.GetArgument<int>("id");
        AggiornaVenditaInput input = context.GetArgument<AggiornaVenditaInput>("input");

        Vendita? sale = await dbContext.Vendite
                .FirstOrDefaultAsync(s => s.VenditaId == id);

        if (sale == null)
        {
            throw new InvalidOperationException("Vendita non trovata");
        }

        GuardVenditaDiUnOrdine(sale);

        // Guard: verifica che la vendita non appartenga a un mese chiuso
        ChiusuraMensileService chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        if (await chiusuraService.RegistroAppartieneAMeseChiusoAsync(sale.RegistroCassaId))
        {
            throw new InvalidOperationException(
                "Impossibile modificare vendite: il mese corrispondente è chiuso.");
        }

        // Lo stato PRIMA dell'aggiornamento: serve a togliere dal secchio vecchio esattamente
        // quello che ci era stato messo. Va letto ora, perché fra un attimo non esiste più.
        string metodoPrecedente = sale.MetodoPagamento;
        decimal importoPrecedente = sale.PrezzoTotale;

        await ApplicaAggiornamentoVenditaAsync(dbContext, sale, input);
        await dbContext.SaveChangesAsync();

        // Riallineamento totali/breakdown registro (sana anche il bug latente:
        // il cambio quantità non aggiornava mai VenditeContanti/TotaleVendite)
        RegistroCassa register = await dbContext.RegistriCassa
                .FirstAsync(r => r.Id == sale.RegistroCassaId);
        ILogger logger = GraphQLService.GetService<ILogger<VenditeMutations>>(context);

        // Togli il vecchio, metti il nuovo. Due chiamate e non una differenza, perché il metodo
        // può essere cambiato: in quel caso l'importo si sposta DA un secchio A un altro, e una
        // sola operazione non saprebbe rappresentarlo.
        SecchiIncassiApplier.ApplicaDelta(register, metodoPrecedente, -importoPrecedente, logger);
        SecchiIncassiApplier.ApplicaDelta(register, sale.MetodoPagamento, sale.PrezzoTotale, logger);

        await ApplicaBreakdownRegistroAsync(dbContext, register, logger);

        return sale;
    }

    private static async Task<bool> EliminaVenditaAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var id = context.GetArgument<int>("id");

        Vendita? sale = await dbContext.Vendite
                .FirstOrDefaultAsync(s => s.VenditaId == id);

        if (sale == null)
        {
            throw new InvalidOperationException("Vendita non trovata");
        }

        GuardVenditaDiUnOrdine(sale);

        // Guard: verifica che la vendita non appartenga a un mese chiuso
        ChiusuraMensileService chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        if (await chiusuraService.RegistroAppartieneAMeseChiusoAsync(sale.RegistroCassaId))
        {
            throw new InvalidOperationException(
                "Impossibile eliminare vendite: il mese corrispondente è chiuso.");
        }

        RegistroCassa? register = await dbContext.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == sale.RegistroCassaId);

        // Letti prima della Remove: dopo, l'entità non è più una fonte affidabile.
        string metodoRimosso = sale.MetodoPagamento;
        decimal importoRimosso = sale.PrezzoTotale;

        dbContext.Vendite.Remove(sale);
        await dbContext.SaveChangesAsync();

        // Totali e breakdown IVA ricalcolati dalla somma delle vendite rimaste
        if (register != null)
        {
            ILogger logger = GraphQLService.GetService<ILogger<VenditeMutations>>(context);
            SecchiIncassiApplier.ApplicaDelta(register, metodoRimosso, -importoRimosso, logger);
            await ApplicaBreakdownRegistroAsync(dbContext, register, logger);
        }

        return true;
    }

    private static async Task<Prodotto> MutateProdottoAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        ProdottoInput input = context.GetArgument<ProdottoInput>("prodotto");

        return await UpsertProdottoAsync(dbContext, input);
    }

    /// <summary>
    /// Upsert prodotto per ProdottoId (null/0 = creazione) con validazioni esplicite
    /// PRIMA del save: aliquota nel set ammesso (costante centralizzata IvaCalculator),
    /// codice non vuoto e univoco (errore leggibile invece della violazione dell'indice
    /// unique), prezzo non negativo. NON chiama SaveChanges su errore di validazione.
    /// </summary>
    public static async Task<Prodotto> UpsertProdottoAsync(AppDbContext dbContext, ProdottoInput input)
    {
        if (!IvaCalculator.IsAliquotaAmmessa(input.AliquotaIva))
        {
            throw new ExecutionError(
                $"Aliquota IVA non ammessa: {input.AliquotaIva}. Valori ammessi: " +
                string.Join(", ", IvaCalculator.AliquoteAmmessePercentuali) + ".");
        }

        string codice = input.Codice.Trim();
        if (codice.Length == 0)
        {
            throw new ExecutionError("Il codice prodotto è obbligatorio.");
        }

        if (input.Prezzo < 0)
        {
            throw new ExecutionError("Il prezzo del prodotto non può essere negativo.");
        }

        Prodotto? prodotto = null;
        if (input.ProdottoId is > 0)
        {
            prodotto = await dbContext.Prodotti
                    .FirstOrDefaultAsync(p => p.ProdottoId == input.ProdottoId.Value);

            if (prodotto == null)
            {
                throw new InvalidOperationException("Prodotto non trovato");
            }
        }

        // Codice univoco (escludendo il prodotto stesso in aggiornamento)
        bool codiceDuplicato = await dbContext.Prodotti.AnyAsync(p =>
            p.Codice == codice && (prodotto == null || p.ProdottoId != prodotto.ProdottoId));
        if (codiceDuplicato)
        {
            throw new ExecutionError($"Esiste già un prodotto con codice '{codice}'.");
        }

        if (prodotto == null)
        {
            prodotto = new Prodotto { CreatedAt = DateTime.UtcNow };
            dbContext.Prodotti.Add(prodotto);
        }

        prodotto.Codice = codice;
        prodotto.Nome = input.Nome;
        prodotto.Descrizione = input.Descrizione;
        prodotto.Prezzo = input.Prezzo;
        prodotto.Categoria = input.Categoria;
        prodotto.UnitaDiMisura = input.UnitaDiMisura ?? prodotto.UnitaDiMisura;
        prodotto.Attivo = input.Attivo;
        prodotto.AliquotaIva = input.AliquotaIva;
        prodotto.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return prodotto;
    }
}
