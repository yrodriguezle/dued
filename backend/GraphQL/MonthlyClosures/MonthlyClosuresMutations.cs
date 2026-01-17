using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.MonthlyClosures.Types;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;

namespace duedgusto.GraphQL.MonthlyClosures;

public class MonthlyClosuresMutations : ObjectGraphType
{
    public MonthlyClosuresMutations()
    {
        this.Authorize();

        // Create or Update Monthly Closure
        Field<MonthlyClosureType>("mutateMonthlyClosure")
            .Argument<NonNullGraphType<MonthlyClosureInputType>>("closure", "Monthly closure data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                MonthlyClosureInput input = context.GetArgument<MonthlyClosureInput>("closure");

                ChiusuraMensile? closure = null;

                if (input.ClosureId.HasValue)
                {
                    // Update existing closure
                    closure = await dbContext.ChiusureMensili
                        .Include(c => c.Spese)
                        .FirstOrDefaultAsync(c => c.ChiusuraId == input.ClosureId.Value);

                    if (closure == null)
                    {
                        throw new ExecutionError($"Monthly closure with ID {input.ClosureId} not found");
                    }
                }
                else
                {
                    // Check if closure already exists for this year/month
                    closure = await dbContext.ChiusureMensili
                        .Include(c => c.Spese)
                        .FirstOrDefaultAsync(c => c.Anno == input.Year && c.Mese == input.Month);

                    if (closure == null)
                    {
                        // Create new closure
                        closure = new ChiusuraMensile();
                        dbContext.ChiusureMensili.Add(closure);
                    }
                }

                // Update basic fields
                closure.Anno = input.Year;
                closure.Mese = input.Month;
                closure.UltimoGiornoLavorativo = input.LastWorkingDay;
                closure.Note = input.Notes;
                closure.Stato = input.Status;
                closure.AggiornatoIl = DateTime.UtcNow;

                // Calculate totals from cash registers for the month
                var startDate = new DateTime(input.Year, input.Month, 1);
                var endDate = startDate.AddMonths(1).AddDays(-1);

                var cashRegisters = await dbContext.CashRegisters
                    .Where(cr => cr.Date >= startDate && cr.Date <= endDate && cr.Status == "CLOSED")
                    .ToListAsync();

                closure.RicavoTotale = cashRegisters.Sum(cr => cr.TotalSales);
                closure.TotaleContanti = cashRegisters.Sum(cr => cr.CashInWhite);
                closure.TotaleElettronici = cashRegisters.Sum(cr => cr.ElectronicPayments);
                closure.TotaleFatture = cashRegisters.Sum(cr => cr.InvoicePayments);

                // Calculate additional expenses from SpeseMensili
                closure.SpeseAggiuntive = closure.Spese.Sum(s => s.Importo);

                // Calculate net revenue
                closure.RicavoNetto = closure.RicavoTotale - closure.SpeseAggiuntive;

                await dbContext.SaveChangesAsync();

                return closure;
            });

        // Close Monthly Closure (change status to CHIUSA)
        Field<MonthlyClosureType>("closeMonthlyClosure")
            .Argument<NonNullGraphType<IntGraphType>>("closureId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var userContext = context.UserContext as GraphQLUserContext;
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                int closureId = context.GetArgument<int>("closureId");

                var closure = await dbContext.ChiusureMensili
                    .Include(c => c.Spese)
                    .FirstOrDefaultAsync(c => c.ChiusuraId == closureId);

                if (closure == null)
                {
                    throw new ExecutionError($"Monthly closure with ID {closureId} not found");
                }

                if (closure.Stato == "CHIUSA" || closure.Stato == "RICONCILIATA")
                {
                    throw new ExecutionError("Monthly closure is already closed");
                }

                closure.Stato = "CHIUSA";
                if (userContext?.User != null)
                {
                    closure.ChiusaDa = jwtHelper.GetUserID(userContext.User);
                }
                closure.ChiusaIl = DateTime.UtcNow;
                closure.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return closure;
            });

        // Delete Monthly Closure
        Field<BooleanGraphType>("deleteMonthlyClosure")
            .Argument<NonNullGraphType<IntGraphType>>("closureId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int closureId = context.GetArgument<int>("closureId");

                var closure = await dbContext.ChiusureMensili
                    .Include(c => c.Spese)
                    .FirstOrDefaultAsync(c => c.ChiusuraId == closureId);

                if (closure == null)
                {
                    throw new ExecutionError($"Monthly closure with ID {closureId} not found");
                }

                if (closure.Stato == "CHIUSA" || closure.Stato == "RICONCILIATA")
                {
                    throw new ExecutionError("Cannot delete a closed or reconciled monthly closure");
                }

                dbContext.ChiusureMensili.Remove(closure);
                await dbContext.SaveChangesAsync();

                return true;
            });

        // Create or Update Monthly Expense
        Field<MonthlyExpenseType>("mutateMonthlyExpense")
            .Argument<NonNullGraphType<MonthlyExpenseInputType>>("expense", "Monthly expense data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                MonthlyExpenseInput input = context.GetArgument<MonthlyExpenseInput>("expense");

                SpesaMensile? expense = null;

                if (input.ExpenseId.HasValue)
                {
                    // Update existing expense
                    expense = await dbContext.SpeseMensili
                        .FirstOrDefaultAsync(e => e.SpesaId == input.ExpenseId.Value);

                    if (expense == null)
                    {
                        throw new ExecutionError($"Monthly expense with ID {input.ExpenseId} not found");
                    }
                }
                else
                {
                    // Create new expense
                    expense = new SpesaMensile();
                    dbContext.SpeseMensili.Add(expense);
                }

                // Update fields
                expense.ChiusuraId = input.ClosureId;
                expense.PagamentoId = input.PaymentId;
                expense.Descrizione = input.Description;
                expense.Importo = input.Amount;
                expense.Categoria = input.Category;
                expense.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                // Recalculate closure totals
                var closure = await dbContext.ChiusureMensili
                    .Include(c => c.Spese)
                    .FirstOrDefaultAsync(c => c.ChiusuraId == input.ClosureId);

                if (closure != null)
                {
                    closure.SpeseAggiuntive = closure.Spese.Sum(s => s.Importo);
                    closure.RicavoNetto = (closure.RicavoTotale ?? 0) - (closure.SpeseAggiuntive ?? 0);
                    closure.AggiornatoIl = DateTime.UtcNow;
                    await dbContext.SaveChangesAsync();
                }

                return expense;
            });

        // Delete Monthly Expense
        Field<BooleanGraphType>("deleteMonthlyExpense")
            .Argument<NonNullGraphType<IntGraphType>>("expenseId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int expenseId = context.GetArgument<int>("expenseId");

                var expense = await dbContext.SpeseMensili
                    .FirstOrDefaultAsync(e => e.SpesaId == expenseId);

                if (expense == null)
                {
                    throw new ExecutionError($"Monthly expense with ID {expenseId} not found");
                }

                var closureId = expense.ChiusuraId;

                dbContext.SpeseMensili.Remove(expense);
                await dbContext.SaveChangesAsync();

                // Recalculate closure totals
                var closure = await dbContext.ChiusureMensili
                    .Include(c => c.Spese)
                    .FirstOrDefaultAsync(c => c.ChiusuraId == closureId);

                if (closure != null)
                {
                    closure.SpeseAggiuntive = closure.Spese.Sum(s => s.Importo);
                    closure.RicavoNetto = (closure.RicavoTotale ?? 0) - (closure.SpeseAggiuntive ?? 0);
                    closure.AggiornatoIl = DateTime.UtcNow;
                    await dbContext.SaveChangesAsync();
                }

                return true;
            });
    }
}
