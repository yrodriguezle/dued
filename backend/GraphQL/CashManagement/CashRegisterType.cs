using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.Authentication;

namespace duedgusto.GraphQL.CashManagement;

public class CashRegisterType : ObjectGraphType<CashRegister>
{
    public CashRegisterType()
    {
        Field(x => x.RegisterId);
        Field(x => x.Date, type: typeof(DateTimeGraphType));
        Field(x => x.UserId);
        Field(x => x.OpeningTotal);
        Field(x => x.ClosingTotal);
        Field(x => x.CashSales);
        Field(x => x.CashInWhite);
        Field(x => x.ElectronicPayments);
        Field(x => x.InvoicePayments);
        Field(x => x.TotalSales);
        Field(x => x.SupplierExpenses);
        Field(x => x.DailyExpenses);
        Field(x => x.ExpectedCash);
        Field(x => x.Difference);
        Field(x => x.NetCash);
        Field(x => x.VatAmount);
        Field(x => x.Notes, nullable: true);
        Field(x => x.Status);
        Field(x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field(x => x.UpdatedAt, type: typeof(DateTimeGraphType));

        Field<UserType, User>("user")
            .Resolve(context => context.Source.User);

        Field<ListGraphType<CashCountType>, IEnumerable<CashCount>>("openingCounts")
            .Resolve(context => context.Source.CashCounts.Where(c => c.IsOpening));

        Field<ListGraphType<CashCountType>, IEnumerable<CashCount>>("closingCounts")
            .Resolve(context => context.Source.CashCounts.Where(c => !c.IsOpening));

        Field<ListGraphType<CashIncomeType>, IEnumerable<CashIncome>>("incomes")
            .Resolve(context => context.Source.CashIncomes);

        Field<ListGraphType<CashExpenseType>, IEnumerable<CashExpense>>("expenses")
            .Resolve(context => context.Source.CashExpenses);
    }
}
