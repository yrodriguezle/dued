namespace duedgusto.Models
{
    /// <summary>
    /// Classe POCO per serializzazione/deserializzazione JSON dei giorni esclusi dalla chiusura mensile.
    /// Non è un'entità EF — viene memorizzata come JSON nella colonna GiorniEsclusi di ChiusuraMensile.
    /// </summary>
    public class GiornoEscluso
    {
        public DateTime Data { get; set; }

        /// <summary>
        /// Codice motivo dell'esclusione: ATTIVITA_NON_AVVIATA, CHIUSURA_PROGRAMMATA, EVENTO_ECCEZIONALE
        /// </summary>
        public string CodiceMotivo { get; set; } = "";

        public string? Note { get; set; }

        public DateTime DataEsclusione { get; set; }

        public int UtenteEsclusione { get; set; }
    }
}
