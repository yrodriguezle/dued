using GraphQL.Types;

namespace duedgusto.GraphQL.Suppliers.Types;

public class SupplierInput
{
    public int? SupplierId { get; set; }
    public string BusinessName { get; set; } = string.Empty;
    public string? VatNumber { get; set; }
    public string? FiscalCode { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Province { get; set; }
    public string? Country { get; set; }
    public string? Notes { get; set; }
    public bool Active { get; set; } = true;
}

public class SupplierInputType : InputObjectGraphType<SupplierInput>
{
    public SupplierInputType()
    {
        Name = "SupplierInput";

        Field(x => x.SupplierId, nullable: true);
        Field(x => x.BusinessName);
        Field(x => x.VatNumber, nullable: true);
        Field(x => x.FiscalCode, nullable: true);
        Field(x => x.Email, nullable: true);
        Field(x => x.Phone, nullable: true);
        Field(x => x.Address, nullable: true);
        Field(x => x.City, nullable: true);
        Field(x => x.PostalCode, nullable: true);
        Field(x => x.Province, nullable: true);
        Field(x => x.Country, nullable: true);
        Field(x => x.Notes, nullable: true);
        Field(x => x.Active);
    }
}
