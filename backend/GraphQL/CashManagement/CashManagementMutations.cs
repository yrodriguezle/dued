using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;

namespace duedgusto.GraphQL.CashManagement;

public class CashManagementMutations : ObjectGraphType
{
    public CashManagementMutations()
    {
        this.Authorize();

        // Create or Update CashRegister
        Field<CashRegisterType, CashRegister>("mutateCashRegister")
            .Argument<NonNullGraphType<CashRegisterInputType>>("cashRegister", "Cash register data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                CashRegisterInput input = context.GetArgument<CashRegisterInput>("cashRegister");

                CashRegister? cashRegister = null;

                // Update existing or create new
                if (input.RegisterId.HasValue && input.RegisterId.Value > 0)
                {
                    cashRegister = await dbContext.CashRegisters
                        .Include(r => r.CashCounts)
                        .FirstOrDefaultAsync(r => r.RegisterId == input.RegisterId.Value);

                    if (cashRegister == null)
                    {
                        throw new Exception($"Cash register with ID {input.RegisterId} not found");
                    }

                    // Remove existing counts
                    dbContext.CashCounts.RemoveRange(cashRegister.CashCounts);
                }
                else
                {
                    cashRegister = new CashRegister();
                    dbContext.CashRegisters.Add(cashRegister);
                }

                // Update basic fields
                cashRegister.Date = input.Date;
                cashRegister.UserId = input.UserId;
                cashRegister.CashInWhite = input.CashInWhite;
                cashRegister.ElectronicPayments = input.ElectronicPayments;
                cashRegister.InvoicePayments = input.InvoicePayments;
                cashRegister.SupplierExpenses = input.SupplierExpenses;
                cashRegister.DailyExpenses = input.DailyExpenses;
                cashRegister.Notes = input.Notes;
                cashRegister.Status = input.Status;
                cashRegister.UpdatedAt = DateTime.UtcNow;

                // Get denominations for calculations
                var denominations = await dbContext.CashDenominations.ToListAsync();

                // Calculate opening total
                decimal openingTotal = 0;
                foreach (var countInput in input.OpeningCounts)
                {
                    var denomination = denominations.FirstOrDefault(d => d.DenominationId == countInput.DenominationId);
                    if (denomination != null)
                    {
                        decimal total = countInput.Quantity * denomination.Value;
                        openingTotal += total;

                        cashRegister.CashCounts.Add(new CashCount
                        {
                            DenominationId = countInput.DenominationId,
                            Quantity = countInput.Quantity,
                            Total = total,
                            IsOpening = true
                        });
                    }
                }

                // Calculate closing total
                decimal closingTotal = 0;
                foreach (var countInput in input.ClosingCounts)
                {
                    var denomination = denominations.FirstOrDefault(d => d.DenominationId == countInput.DenominationId);
                    if (denomination != null)
                    {
                        decimal total = countInput.Quantity * denomination.Value;
                        closingTotal += total;

                        cashRegister.CashCounts.Add(new CashCount
                        {
                            DenominationId = countInput.DenominationId,
                            Quantity = countInput.Quantity,
                            Total = total,
                            IsOpening = false
                        });
                    }
                }

                cashRegister.OpeningTotal = openingTotal;
                cashRegister.ClosingTotal = closingTotal;

                // TODO: Get actual sales data from sales table when implemented
                // For now, use placeholder values
                cashRegister.CashSales = 0;
                cashRegister.TotalSales = cashRegister.CashSales + cashRegister.ElectronicPayments + cashRegister.CashInWhite + cashRegister.InvoicePayments;

                // Calculate expected cash and difference
                cashRegister.ExpectedCash = cashRegister.CashSales - cashRegister.SupplierExpenses - cashRegister.DailyExpenses;
                decimal dailyIncome = cashRegister.ClosingTotal - cashRegister.OpeningTotal;
                cashRegister.Difference = dailyIncome - cashRegister.ExpectedCash;
                cashRegister.NetCash = dailyIncome;

                // Calculate VAT (10%)
                cashRegister.VatAmount = cashRegister.TotalSales * 0.1m;

                await dbContext.SaveChangesAsync();

                // Reload with navigation properties
                return await dbContext.CashRegisters
                    .Include(r => r.User)
                        .ThenInclude(u => u.Role)
                    .Include(r => r.CashCounts)
                        .ThenInclude(c => c.Denomination)
                    .FirstOrDefaultAsync(r => r.RegisterId == cashRegister.RegisterId);
            });

        // Close cash register (set status to CLOSED)
        Field<CashRegisterType, CashRegister>("closeCashRegister")
            .Argument<NonNullGraphType<IntGraphType>>("registerId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int registerId = context.GetArgument<int>("registerId");

                var cashRegister = await dbContext.CashRegisters
                    .Include(r => r.User)
                        .ThenInclude(u => u.Role)
                    .Include(r => r.CashCounts)
                        .ThenInclude(c => c.Denomination)
                    .FirstOrDefaultAsync(r => r.RegisterId == registerId);

                if (cashRegister == null)
                {
                    throw new Exception($"Cash register with ID {registerId} not found");
                }

                if (cashRegister.Status == "CLOSED" || cashRegister.Status == "RECONCILED")
                {
                    throw new Exception("Cash register is already closed");
                }

                cashRegister.Status = "CLOSED";
                cashRegister.UpdatedAt = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return cashRegister;
            });

        // Delete cash register
        Field<BooleanGraphType>("deleteCashRegister")
            .Argument<NonNullGraphType<IntGraphType>>("registerId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int registerId = context.GetArgument<int>("registerId");

                var cashRegister = await dbContext.CashRegisters
                    .Include(r => r.CashCounts)
                    .FirstOrDefaultAsync(r => r.RegisterId == registerId);

                if (cashRegister == null)
                {
                    throw new Exception($"Cash register with ID {registerId} not found");
                }

                // Only allow deletion of DRAFT registers
                if (cashRegister.Status != "DRAFT")
                {
                    throw new Exception("Only DRAFT cash registers can be deleted");
                }

                dbContext.CashRegisters.Remove(cashRegister);
                await dbContext.SaveChangesAsync();

                return true;
            });
    }
}
