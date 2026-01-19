using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.GraphQL.ChiusureMensili.Types;

namespace duedgusto.GraphQL.MonthlyClosures;

public class MonthlyClosuresMutations : ObjectGraphType
{
    public MonthlyClosuresMutations()
    {
        this.Authorize();

        // Create or Update Monthly Closure
        Field<ChiusuraMensileType>("mutazioneChiusuraMensile")
            .Argument<NonNullGraphType<ChiusuraMensileInputType>>("chiusura", "Dati della chiusura mensile")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                ChiusuraMensileInput input = context.GetArgument<ChiusuraMensileInput>("chiusura");

                ChiusuraMensile? closure = null;

                if (input.ChiusuraId.HasValue)
                {
                    // Update existing closure
                    closure = await dbContext.ChiusureMensili
                        .Include(c => c.Spese)
                        .FirstOrDefaultAsync(c => c.ChiusuraId == input.ChiusuraId.Value);

                    if (closure == null)
                    {
                        throw new ExecutionError($"Chiusura mensile con ID {input.ChiusuraId} non trovata.");
                    }
                }
                else
                {
                    // Check if closure already exists for this year/month
                    closure = await dbContext.ChiusureMensili
                        .FirstOrDefaultAsync(c => c.Anno == input.Anno && c.Mese == input.Mese);

                    if (closure == null)
                    {
                        // Create new closure
                        closure = new ChiusuraMensile();
                        dbContext.ChiusureMensili.Add(closure);
                    }
                }

                // Update basic fields
                closure.Anno = input.Anno;
                closure.Mese = input.Mese;
                closure.UltimoGiornoLavorativo = input.UltimoGiornoLavorativo;
                closure.Note = input.Note;
                closure.Stato = input.Stato;
                closure.AggiornatoIl = DateTime.UtcNow;

                // Handle expenses
                if (input.Spese != null)
                {
                    var existingExpenseIds = closure.Spese.Select(e => e.SpesaId).ToList();
                    var inputExpenseIds = input.Spese.Where(e => e.SpesaId.HasValue).Select(e => e.SpesaId!.Value).ToList();
                    var expensesToDelete = closure.Spese.Where(e => !inputExpenseIds.Contains(e.SpesaId)).ToList();
                    
                    dbContext.SpeseMensili.RemoveRange(expensesToDelete);

                    foreach (var expenseInput in input.Spese)
                    {
                        SpesaMensile? expense = null;
                        if (expenseInput.SpesaId.HasValue)
                        {
                            expense = closure.Spese.FirstOrDefault(e => e.SpesaId == expenseInput.SpesaId.Value);
                        }

                        if (expense == null)
                        {
                            expense = new SpesaMensile { ChiusuraId = closure.ChiusuraId };
                            closure.Spese.Add(expense);
                        }

                        expense.Descrizione = expenseInput.Descrizione;
                        expense.Importo = expenseInput.Importo;
                        expense.Categoria = expenseInput.Categoria;
                        expense.PagamentoId = expenseInput.PagamentoId;
                        expense.AggiornatoIl = DateTime.UtcNow;
                    }
                }

                // Calculate totals from cash registers for the month
                var startDate = new DateTime(input.Anno, input.Mese, 1);
                var endDate = startDate.AddMonths(1).AddDays(-1);

                var cashRegisters = await dbContext.CashRegisters
                    .Where(cr => cr.Date >= startDate && cr.Date <= endDate && cr.Status == "CLOSED")
                    .ToListAsync();

                closure.RicavoTotale = cashRegisters.Sum(cr => cr.TotalSales);
                closure.TotaleContanti = cashRegisters.Sum(cr => cr.CashInWhite);
                closure.TotaleElettronici = cashRegisters.Sum(cr => cr.ElectronicPayments);
                closure.TotaleFatture = cashRegisters.Sum(cr => cr.InvoicePayments);

                // Recalculate additional expenses AFTER updating the collection
                closure.SpeseAggiuntive = closure.Spese.Sum(s => s.Importo);

                // Recalculate net revenue
                closure.RicavoNetto = closure.RicavoTotale - closure.SpeseAggiuntive;

                await dbContext.SaveChangesAsync();

                return closure;
            });

        // Close Monthly Closure (change status to CHIUSA)
        Field<ChiusuraMensileType>("chiudiChiusuraMensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var userContext = context.UserContext as GraphQLUserContext;
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                int chiusuraId = context.GetArgument<int>("chiusuraId");

                var closure = await dbContext.ChiusureMensili
                    .Include(c => c.Spese)
                    .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

                if (closure == null)
                {
                    throw new ExecutionError($"Chiusura mensile con ID {chiusuraId} non trovata");
                }

                if (closure.Stato == "CHIUSA" || closure.Stato == "RICONCILIATA")
                {
                    throw new ExecutionError("La chiusura mensile è già chiusa.");
                }

                closure.Stato = "CHIUSA";
                if (userContext?.Principal != null)
                {
                    closure.ChiusaDa = jwtHelper.GetUserID(userContext.Principal);
                }
                closure.ChiusaIl = DateTime.UtcNow;
                closure.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return closure;
            });

        // Delete Monthly Closure
        Field<BooleanGraphType>("eliminaChiusuraMensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int chiusuraId = context.GetArgument<int>("chiusuraId");

                var closure = await dbContext.ChiusureMensili
                    .Include(c => c.Spese)
                    .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

                if (closure == null)
                {
                    throw new ExecutionError($"Chiusura mensile con ID {chiusuraId} non trovata");
                }

                if (closure.Stato == "CHIUSA" || closure.Stato == "RICONCILIATA")
                {
                    throw new ExecutionError("Impossibile eliminare una chiusura chiusa o riconciliata.");
                }

                dbContext.ChiusureMensili.Remove(closure);
                await dbContext.SaveChangesAsync();

                return true;
            });
    }
}
