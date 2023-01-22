namespace DueD.Helpers
{
    public static class UtilityHelper
    {
        public static object? NormalizeDateTime(object? pvalue)
        {
            if (pvalue is not null && pvalue.GetType() == typeof(DateTime) && (Convert.ToDateTime(pvalue).Year == 1899 || Convert.ToDateTime(pvalue).Year == 1900))
            {
                pvalue = null;
            }
            return pvalue;
        }
    }
}
