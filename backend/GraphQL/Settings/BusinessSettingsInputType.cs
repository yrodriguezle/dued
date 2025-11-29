using GraphQL.Types;

namespace duedgusto.GraphQL.Settings;

public class BusinessSettingsInputType : InputObjectGraphType
{
    public BusinessSettingsInputType()
    {
        Field<IntGraphType>("settingsId");
        Field<StringGraphType>("businessName", "Nome dell'attività commerciale");
        Field<StringGraphType>("openingTime", "Orario di apertura (formato HH:mm)");
        Field<StringGraphType>("closingTime", "Orario di chiusura (formato HH:mm)");
        Field<StringGraphType>("operatingDays", "Array JSON dei giorni operativi");
        Field<StringGraphType>("timezone", "Fuso orario IANA (es. Europe/Rome)");
        Field<StringGraphType>("currency", "Codice valuta ISO 4217");
        Field<DecimalGraphType>("vatRate", "Aliquota IVA (es. 0.22 per 22%)");
    }
}
