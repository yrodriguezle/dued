using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Suppliers.Types;

namespace duedgusto.GraphQL.Suppliers;

public class SuppliersMutations : ObjectGraphType
{
    public SuppliersMutations()
    {
        this.Authorize();

        // Create or Update Supplier
        Field<SupplierType>("mutateSupplier")
            .Argument<NonNullGraphType<SupplierInputType>>("supplier", "Supplier data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                SupplierInput input = context.GetArgument<SupplierInput>("supplier");

                Fornitore? supplier = null;

                if (input.SupplierId.HasValue)
                {
                    // Update existing supplier
                    supplier = await dbContext.Fornitori
                        .FirstOrDefaultAsync(s => s.FornitoreId == input.SupplierId.Value) ?? throw new ExecutionError($"Supplier with ID {input.SupplierId} not found");
                }
                else
                {
                    // Create new supplier
                    supplier = new Fornitore();
                    dbContext.Fornitori.Add(supplier);
                }

                // Update fields
                supplier.RagioneSociale = input.BusinessName;
                supplier.PartitaIva = input.VatNumber;
                supplier.CodiceFiscale = input.FiscalCode;
                supplier.Email = input.Email;
                supplier.Telefono = input.Phone;
                supplier.Indirizzo = input.Address;
                supplier.Citta = input.City;
                supplier.Cap = input.PostalCode;
                supplier.Provincia = input.Province;
                supplier.Paese = input.Country ?? "IT";
                supplier.Note = input.Notes;
                supplier.Attivo = input.Active;
                supplier.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return supplier;
            });

        // Delete Supplier
        Field<BooleanGraphType>("deleteSupplier")
            .Argument<NonNullGraphType<IntGraphType>>("supplierId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int supplierId = context.GetArgument<int>("supplierId");

                var supplier = await dbContext.Fornitori
                    .FirstOrDefaultAsync(s => s.FornitoreId == supplierId);

                if (supplier == null)
                {
                    throw new ExecutionError($"Supplier with ID {supplierId} not found");
                }

                // Soft delete - just mark as inactive
                supplier.Attivo = false;
                supplier.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return true;
            });

        // Create or Update Purchase Invoice
        Field<PurchaseInvoiceType>("mutatePurchaseInvoice")
            .Argument<NonNullGraphType<PurchaseInvoiceInputType>>("invoice", "Purchase invoice data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                PurchaseInvoiceInput input = context.GetArgument<PurchaseInvoiceInput>("invoice");

                FatturaAcquisto? invoice = null;

                if (input.InvoiceId.HasValue)
                {
                    // Update existing invoice
                    invoice = await dbContext.FattureAcquisto
                        .FirstOrDefaultAsync(i => i.FatturaId == input.InvoiceId.Value);

                    if (invoice == null)
                    {
                        throw new ExecutionError($"Purchase invoice with ID {input.InvoiceId} not found");
                    }
                }
                else
                {
                    // Create new invoice
                    invoice = new FatturaAcquisto();
                    dbContext.FattureAcquisto.Add(invoice);
                }

                // Update fields
                invoice.FornitoreId = input.SupplierId;
                invoice.NumeroFattura = input.InvoiceNumber;
                invoice.DataFattura = input.InvoiceDate;
                invoice.Imponibile = input.TaxableAmount;
                invoice.ImportoIva = Math.Round(input.TaxableAmount * input.VatRate / 100, 2);
                invoice.TotaleConIva = input.TaxableAmount + invoice.ImportoIva;
                invoice.DataScadenza = input.DueDate;
                invoice.Note = input.Notes;
                invoice.Stato = input.Status;
                invoice.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return invoice;
            });

        // Delete Purchase Invoice
        Field<BooleanGraphType>("deletePurchaseInvoice")
            .Argument<NonNullGraphType<IntGraphType>>("invoiceId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int invoiceId = context.GetArgument<int>("invoiceId");

                var invoice = await dbContext.FattureAcquisto
                    .FirstOrDefaultAsync(i => i.FatturaId == invoiceId);

                if (invoice == null)
                {
                    throw new ExecutionError($"Purchase invoice with ID {invoiceId} not found");
                }

                dbContext.FattureAcquisto.Remove(invoice);
                await dbContext.SaveChangesAsync();

                return true;
            });

        // Create or Update Delivery Note
        Field<DeliveryNoteType>("mutateDeliveryNote")
            .Argument<NonNullGraphType<DeliveryNoteInputType>>("deliveryNote", "Delivery note data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                DeliveryNoteInput input = context.GetArgument<DeliveryNoteInput>("deliveryNote");

                DocumentoTrasporto? ddt = null;

                if (input.DdtId.HasValue)
                {
                    // Update existing DDT
                    ddt = await dbContext.DocumentiTrasporto
                        .FirstOrDefaultAsync(d => d.DdtId == input.DdtId.Value);

                    if (ddt == null)
                    {
                        throw new ExecutionError($"Delivery note with ID {input.DdtId} not found");
                    }
                }
                else
                {
                    // Create new DDT
                    ddt = new DocumentoTrasporto();
                    dbContext.DocumentiTrasporto.Add(ddt);
                }

                // Update fields
                ddt.FatturaId = input.InvoiceId;
                ddt.FornitoreId = input.SupplierId;
                ddt.NumeroDdt = input.DdtNumber;
                ddt.DataDdt = input.DdtDate;
                ddt.Importo = input.Amount;
                ddt.Note = input.Notes;
                ddt.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                return ddt;
            });

        // Delete Delivery Note
        Field<BooleanGraphType>("deleteDeliveryNote")
            .Argument<NonNullGraphType<IntGraphType>>("ddtId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int ddtId = context.GetArgument<int>("ddtId");

                var ddt = await dbContext.DocumentiTrasporto
                    .FirstOrDefaultAsync(d => d.DdtId == ddtId);

                if (ddt == null)
                {
                    throw new ExecutionError($"Delivery note with ID {ddtId} not found");
                }

                dbContext.DocumentiTrasporto.Remove(ddt);
                await dbContext.SaveChangesAsync();

                return true;
            });

        // Create or Update Supplier Payment
        Field<SupplierPaymentType>("mutateSupplierPayment")
            .Argument<NonNullGraphType<SupplierPaymentInputType>>("payment", "Supplier payment data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                SupplierPaymentInput input = context.GetArgument<SupplierPaymentInput>("payment");

                // Validate that at least one of InvoiceId or DdtId is provided
                if (!input.InvoiceId.HasValue && !input.DdtId.HasValue)
                {
                    throw new ExecutionError("Either InvoiceId or DdtId must be provided");
                }

                PagamentoFornitore? payment = null;

                if (input.PaymentId.HasValue)
                {
                    // Update existing payment
                    payment = await dbContext.PagamentiFornitori
                        .FirstOrDefaultAsync(p => p.PagamentoId == input.PaymentId.Value);

                    if (payment == null)
                    {
                        throw new ExecutionError($"Supplier payment with ID {input.PaymentId} not found");
                    }
                }
                else
                {
                    // Create new payment
                    payment = new PagamentoFornitore();
                    dbContext.PagamentiFornitori.Add(payment);
                }

                // Update fields
                payment.FatturaId = input.InvoiceId;
                payment.DdtId = input.DdtId;
                payment.DataPagamento = input.PaymentDate;
                payment.Importo = input.Amount;
                payment.MetodoPagamento = input.PaymentMethod;
                payment.Note = input.Notes;
                payment.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                // Update invoice status if linked
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

                return payment;
            });

        // Delete Supplier Payment
        Field<BooleanGraphType>("deleteSupplierPayment")
            .Argument<NonNullGraphType<IntGraphType>>("paymentId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int paymentId = context.GetArgument<int>("paymentId");

                var payment = await dbContext.PagamentiFornitori
                    .FirstOrDefaultAsync(p => p.PagamentoId == paymentId);

                if (payment == null)
                {
                    throw new ExecutionError($"Supplier payment with ID {paymentId} not found");
                }

                var invoiceId = payment.FatturaId;

                dbContext.PagamentiFornitori.Remove(payment);
                await dbContext.SaveChangesAsync();

                // Update invoice status if it was linked
                if (invoiceId.HasValue)
                {
                    var invoice = await dbContext.FattureAcquisto
                        .Include(i => i.Pagamenti)
                        .FirstOrDefaultAsync(i => i.FatturaId == invoiceId.Value);

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

                return true;
            });
    }
}
