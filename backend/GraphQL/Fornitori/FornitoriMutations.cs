using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.Services.Fornitori;

namespace duedgusto.GraphQL.Fornitori;

public class FornitoriMutations : ObjectGraphType
{
    public FornitoriMutations()
    {
        this.Authorize();

        // Crea o Aggiorna Fornitore
        Field<FornitoreType>("mutateFornitore")
            .Argument<NonNullGraphType<FornitoreInputType>>("fornitore", "Dati fornitore")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                FornitoreInput input = context.GetArgument<FornitoreInput>("fornitore");

                Fornitore? fornitore = null;

                if (input.FornitoreId.HasValue)
                {
                    // Aggiorna fornitore esistente
                    fornitore = await dbContext.Fornitori
                        .FirstOrDefaultAsync(s => s.FornitoreId == input.FornitoreId.Value) ?? throw new ExecutionError($"Fornitore con ID {input.FornitoreId} non trovato");
                }
                else
                {
                    // Crea nuovo fornitore
                    fornitore = new Fornitore();
                    dbContext.Fornitori.Add(fornitore);
                }

                // Aggiorna campi
                fornitore.RagioneSociale = input.RagioneSociale;
                fornitore.PartitaIva = input.PartitaIva;
                fornitore.CodiceFiscale = input.CodiceFiscale;
                fornitore.Email = input.Email;
                fornitore.Telefono = input.Telefono;
                fornitore.Indirizzo = input.Indirizzo;
                fornitore.Citta = input.Citta;
                fornitore.Cap = input.Cap;
                fornitore.Provincia = input.Provincia;
                fornitore.Paese = input.Paese ?? "IT";
                fornitore.Note = input.Note;
                fornitore.Attivo = input.Attivo;
                fornitore.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return fornitore;
            });

        // Elimina Fornitore
        Field<BooleanGraphType>("eliminaFornitore")
            .Argument<NonNullGraphType<IntGraphType>>("fornitoreId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int fornitoreId = context.GetArgument<int>("fornitoreId");

                var fornitore = await dbContext.Fornitori
                    .FirstOrDefaultAsync(s => s.FornitoreId == fornitoreId);

                if (fornitore == null)
                {
                    throw new ExecutionError($"Fornitore con ID {fornitoreId} non trovato");
                }

                // Soft delete - segna come inattivo
                fornitore.Attivo = false;
                fornitore.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return true;
            });

        // Crea o Aggiorna Fattura Acquisto
        Field<FatturaAcquistoType>("mutateFatturaAcquisto")
            .Argument<NonNullGraphType<FatturaAcquistoInputType>>("fattura", "Dati fattura acquisto")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                FatturaAcquistoInput input = context.GetArgument<FatturaAcquistoInput>("fattura");

                FatturaAcquisto? fattura = null;

                if (input.FatturaId.HasValue)
                {
                    // Aggiorna fattura esistente
                    fattura = await dbContext.FattureAcquisto
                        .FirstOrDefaultAsync(i => i.FatturaId == input.FatturaId.Value);

                    if (fattura == null)
                    {
                        throw new ExecutionError($"Fattura acquisto con ID {input.FatturaId} non trovata");
                    }
                }
                else
                {
                    // Crea nuova fattura
                    fattura = new FatturaAcquisto();
                    dbContext.FattureAcquisto.Add(fattura);
                }

                // Aggiorna campi
                fattura.FornitoreId = input.FornitoreId;
                fattura.NumeroFattura = input.NumeroFattura;
                fattura.DataFattura = input.DataFattura;
                fattura.Imponibile = input.Imponibile;
                fattura.ImportoIva = Math.Round(input.Imponibile * input.AliquotaIva / 100, 2);
                fattura.TotaleConIva = input.Imponibile + fattura.ImportoIva;
                fattura.DataScadenza = input.DataScadenza;
                fattura.Note = input.Note;
                fattura.Stato = input.Stato;
                fattura.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return fattura;
            });

        // Elimina Fattura Acquisto
        Field<BooleanGraphType>("eliminaFatturaAcquisto")
            .Argument<NonNullGraphType<IntGraphType>>("fatturaId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int fatturaId = context.GetArgument<int>("fatturaId");

                var fattura = await dbContext.FattureAcquisto
                    .FirstOrDefaultAsync(i => i.FatturaId == fatturaId);

                if (fattura == null)
                {
                    throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");
                }

                dbContext.FattureAcquisto.Remove(fattura);
                await dbContext.SaveChangesAsync();

                return true;
            });

        // Crea o Aggiorna Documento di Trasporto
        Field<DocumentoTrasportoType>("mutateDocumentoTrasporto")
            .Argument<NonNullGraphType<DocumentoTrasportoInputType>>("documentoTrasporto", "Dati documento di trasporto")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                DocumentoTrasportoInput input = context.GetArgument<DocumentoTrasportoInput>("documentoTrasporto");

                DocumentoTrasporto? ddt = null;

                if (input.DdtId.HasValue)
                {
                    // Aggiorna DDT esistente
                    ddt = await dbContext.DocumentiTrasporto
                        .FirstOrDefaultAsync(d => d.DdtId == input.DdtId.Value);

                    if (ddt == null)
                    {
                        throw new ExecutionError($"Documento di trasporto con ID {input.DdtId} non trovato");
                    }
                }
                else
                {
                    // Crea nuovo DDT
                    ddt = new DocumentoTrasporto();
                    dbContext.DocumentiTrasporto.Add(ddt);
                }

                // Aggiorna campi
                ddt.FatturaId = input.FatturaId;
                ddt.FornitoreId = input.FornitoreId;
                ddt.NumeroDdt = input.NumeroDdt;
                ddt.DataDdt = input.DataDdt;
                ddt.Importo = input.Importo;
                ddt.Note = input.Note;
                ddt.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return ddt;
            });

        // Elimina Documento di Trasporto
        Field<BooleanGraphType>("eliminaDocumentoTrasporto")
            .Argument<NonNullGraphType<IntGraphType>>("ddtId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int ddtId = context.GetArgument<int>("ddtId");

                var ddt = await dbContext.DocumentiTrasporto
                    .FirstOrDefaultAsync(d => d.DdtId == ddtId);

                if (ddt == null)
                {
                    throw new ExecutionError($"Documento di trasporto con ID {ddtId} non trovato");
                }

                dbContext.DocumentiTrasporto.Remove(ddt);
                await dbContext.SaveChangesAsync();

                return true;
            });

        // Crea o Aggiorna Pagamento Fornitore
        Field<PagamentoFornitoreType>("mutatePagamentoFornitore")
            .Argument<NonNullGraphType<PagamentoFornitoreInputType>>("pagamento", "Dati pagamento fornitore")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                PagamentoFornitoreInput input = context.GetArgument<PagamentoFornitoreInput>("pagamento");

                var syncService = GraphQLService.GetService<RegistroCassaSyncService>(context);

                PagamentoFornitore? payment = null;
                int? oldRegistroCassaId = null;

                if (input.PagamentoId.HasValue)
                {
                    // Aggiorna pagamento esistente
                    payment = await dbContext.PagamentiFornitori
                        .FirstOrDefaultAsync(p => p.PagamentoId == input.PagamentoId.Value);

                    if (payment == null)
                    {
                        throw new ExecutionError($"Pagamento fornitore con ID {input.PagamentoId} non trovato");
                    }

                    // Cattura il vecchio registro per ricalcolo se la data cambia
                    if (payment.DataPagamento.Date != input.DataPagamento.Date)
                    {
                        oldRegistroCassaId = payment.RegistroCassaId;
                    }
                }
                else
                {
                    // Crea nuovo pagamento
                    payment = new PagamentoFornitore();
                    dbContext.PagamentiFornitori.Add(payment);
                }

                // Aggiorna campi
                payment.FatturaId = input.FatturaId;
                payment.DdtId = input.DdtId;
                payment.DataPagamento = input.DataPagamento;
                payment.Importo = input.Importo;
                payment.MetodoPagamento = input.MetodoPagamento;
                payment.Note = input.Note;
                payment.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                // Aggiorna stato fattura se collegata
                if (payment.FatturaId.HasValue)
                {
                    var invoice = await dbContext.FattureAcquisto
                        .Include(i => i.Pagamenti)
                        .FirstOrDefaultAsync(i => i.FatturaId == payment.FatturaId.Value);

                    if (invoice != null)
                    {
                        var totalPaid = invoice.Pagamenti.Sum(p => p.Importo);
                        var invoiceTotal = invoice.TotaleConIva ?? invoice.Imponibile;
                        if (totalPaid >= invoiceTotal)
                        {
                            invoice.Stato = "PAGATA";
                        }
                        else if (totalPaid > 0)
                        {
                            invoice.Stato = "PARZIALMENTE_PAGATA";
                        }
                        else
                        {
                            invoice.Stato = "DA_PAGARE";
                        }
                        await dbContext.SaveChangesAsync();
                    }
                }

                // Sincronizza con il registro cassa
                // Recupera l'utenteId dal pagamento collegato alla fattura o usa un default
                var utenteId = 1; // Default: verrà sovrascritto dal registro esistente se presente
                var registro = await syncService.FindOrCreateRegistroCassaAsync(input.DataPagamento, utenteId);
                payment.RegistroCassaId = registro.Id;
                await dbContext.SaveChangesAsync();

                // Ricalcola SpeseFornitori sul nuovo registro
                await syncService.RecalculateSpeseFornitoriAsync(registro.Id);

                // Se la data è cambiata, ricalcola anche il vecchio registro
                if (oldRegistroCassaId.HasValue)
                {
                    await syncService.RecalculateSpeseFornitoriAsync(oldRegistroCassaId.Value);
                }

                return payment;
            });

        // Elimina Pagamento Fornitore
        Field<BooleanGraphType>("eliminaPagamentoFornitore")
            .Argument<NonNullGraphType<IntGraphType>>("pagamentoId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int pagamentoId = context.GetArgument<int>("pagamentoId");

                var payment = await dbContext.PagamentiFornitori
                    .FirstOrDefaultAsync(p => p.PagamentoId == pagamentoId);

                if (payment == null)
                {
                    throw new ExecutionError($"Pagamento fornitore con ID {pagamentoId} non trovato");
                }

                var fatturaId = payment.FatturaId;
                var registroCassaId = payment.RegistroCassaId;

                dbContext.PagamentiFornitori.Remove(payment);
                await dbContext.SaveChangesAsync();

                // Aggiorna stato fattura se era collegata
                if (fatturaId.HasValue)
                {
                    var invoice = await dbContext.FattureAcquisto
                        .Include(i => i.Pagamenti)
                        .FirstOrDefaultAsync(i => i.FatturaId == fatturaId.Value);

                    if (invoice != null)
                    {
                        var totalPaid = invoice.Pagamenti.Sum(p => p.Importo);
                        var invoiceTotal = invoice.TotaleConIva ?? invoice.Imponibile;
                        if (totalPaid >= invoiceTotal)
                        {
                            invoice.Stato = "PAGATA";
                        }
                        else if (totalPaid > 0)
                        {
                            invoice.Stato = "PARZIALMENTE_PAGATA";
                        }
                        else
                        {
                            invoice.Stato = "DA_PAGARE";
                        }
                        await dbContext.SaveChangesAsync();
                    }
                }

                // Ricalcola SpeseFornitori sul registro cassa se era linkato
                if (registroCassaId.HasValue)
                {
                    var syncService = GraphQLService.GetService<RegistroCassaSyncService>(context);
                    await syncService.RecalculateSpeseFornitoriAsync(registroCassaId.Value);
                }

                return true;
            });
    }
}
