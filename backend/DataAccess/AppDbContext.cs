using Microsoft.EntityFrameworkCore;
using duedgusto.Models;

namespace duedgusto.DataAccess;

public class AppDbContext : DbContext
{
    private readonly IConfiguration _configuration;

    public AppDbContext(DbContextOptions<AppDbContext> options, IConfiguration configuration) : base(options)
    {
        _configuration = configuration;
    }

    public DbSet<Utente> Utenti { get; set; }
    public DbSet<Ruolo> Ruoli { get; set; }
    public DbSet<Menu> Menus { get; set; }

    // Products and Sales
    public DbSet<Prodotto> Prodotti { get; set; }
    public DbSet<GruppoProdotti> GruppiProdotti { get; set; }
    public DbSet<ProdottoGruppo> ProdottiGruppi { get; set; }
    public DbSet<Vendita> Vendite { get; set; }

    // Ordini del punto vendita — il conto aperto al bancone. ⚠️ Un Ordine APERTO non ha mosso
    // alcun secchio: le Vendite (e con esse gli incassi) nascono solo alla sua chiusura.
    public DbSet<Ordine> Ordini { get; set; }
    public DbSet<RigaOrdine> RigheOrdine { get; set; }

    // Cash Management
    public DbSet<DenominazioneMoneta> DenominazioniMoneta { get; set; }
    public DbSet<RegistroCassa> RegistriCassa { get; set; }
    public DbSet<ConteggioMoneta> ConteggiMoneta { get; set; }
    public DbSet<SpesaCassa> SpeseCassa { get; set; }
    public DbSet<RegistroCassaIva> RegistriCassaIva { get; set; }

    // Business Settings
    public DbSet<BusinessSettings> BusinessSettings { get; set; }
    public DbSet<PeriodoProgrammazione> PeriodiProgrammazione { get; set; }
    public DbSet<GiornoNonLavorativo> GiorniNonLavorativi { get; set; }

    // Supplier Management
    public DbSet<Fornitore> Fornitori { get; set; }
    public DbSet<FatturaAcquisto> FattureAcquisto { get; set; }
    public DbSet<DocumentoTrasporto> DocumentiTrasporto { get; set; }
    public DbSet<PagamentoFornitore> PagamentiFornitori { get; set; }

    // Monthly Closure
    public DbSet<ChiusuraMensile> ChiusureMensili { get; set; }

    // Monthly Closure - New Referential Model
    public DbSet<RegistroCassaMensile> RegistriCassaMensili { get; set; }

    // Media (vetrina del sito)
    public DbSet<MediaAsset> MediaAssets { get; set; }

    // Impostazioni del sito vetrina — UNA sola riga, imposta dal database (vedi OnModelCreating)
    public DbSet<ImpostazioniVetrina> ImpostazioniVetrina { get; set; }

    // Recensioni RIPORTATE sul sito: citazioni scelte dall'amministratore, non giudizi raccolti
    // dal sito. Nessuna rotta pubblica scrive qui.
    public DbSet<RecensioneVetrina> RecensioniVetrina { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            string connectionString = _configuration.GetConnectionString("Default") ?? string.Empty;
            optionsBuilder.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Utente>(entity =>
        {
            entity
                .ToTable("Utenti")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            // Colonna varchar(20) NOT NULL con default schema "free": gli utenti esistenti
            // ereditano "free" alla migration senza backfill manuale.
            entity.Property(x => x.PreferenzaDragModale)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue("free");

            entity.HasOne(x => x.Ruolo)
                .WithMany(r => r.Utenti)
                .HasForeignKey(x => x.RuoloId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Ruolo>(entity =>
        {
            entity
                .ToTable("Ruoli")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<Ruolo>()
            .HasMany(r => r.Menus)
            .WithMany(m => m.Ruoli)
            .UsingEntity<Dictionary<string, object>>(
                "RuoloMenu",
                j => j.HasOne<Menu>()
                      .WithMany()
                      .HasForeignKey("MenuId")
                      .OnDelete(DeleteBehavior.Cascade),
                j => j.HasOne<Ruolo>()
                      .WithMany()
                      .HasForeignKey("RuoloId")
                      .OnDelete(DeleteBehavior.Cascade)
            );

        modelBuilder.Entity<Menu>(entity =>
        {
            entity
                .ToTable("Menus")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.HasOne(m => m.MenuPadre)
                .WithMany(m => m.Figli)
                .HasForeignKey(m => m.MenuPadreId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Cash Management Configuration
        modelBuilder.Entity<DenominazioneMoneta>(entity =>
        {
            entity
                .ToTable("DenominazioniMoneta")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Valore)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Tipo)
                .HasMaxLength(10)
                .IsRequired();

            entity.Property(x => x.OrdineVisualizzazione)
                .IsRequired();
        });

        modelBuilder.Entity<RegistroCassa>(entity =>
        {
            entity
                .ToTable("RegistriCassa")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Data)
                .HasColumnType("date")
                .IsRequired();

            // Unique index on Data to prevent duplicate cash registers for the same date
            entity.HasIndex(x => x.Data)
                .IsUnique();

            entity.Property(x => x.TotaleApertura)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleChiusura)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.VenditeContanti)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.IncassiElettronici)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleVendite)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.SpeseFornitori)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.SpeseGiornaliere)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.ContanteNetto)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.RestoFornitore)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Ecc)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Resto)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.ImportoIva)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.Stato)
                .HasMaxLength(20)
                .HasDefaultValue("DRAFT");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Utente)
                .WithMany()
                .HasForeignKey(x => x.UtenteId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(x => x.ConteggiMoneta)
                .WithOne(x => x.RegistroCassa)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(x => x.SpeseCassa)
                .WithOne(x => x.RegistroCassa)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(x => x.BreakdownIva)
                .WithOne(x => x.RegistroCassa)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Breakdown IVA per aliquota del registro cassa
        modelBuilder.Entity<RegistroCassaIva>(entity =>
        {
            entity
                .ToTable("RegistriCassaIva")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            // Aliquota in percentuale (es. 22.00), come Prodotto.AliquotaIva
            entity.Property(x => x.Aliquota)
                .HasColumnType("decimal(5,2)")
                .IsRequired();

            entity.Property(x => x.Imponibile)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Imposta)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Stimato)
                .IsRequired();

            // Lookup DataLoader per registro
            entity.HasIndex(x => x.RegistroCassaId);

            // Un registro può avere al più UNA riga per coppia (Aliquota, Stimato):
            // guardia contro doppie insert in caso di rigenerazione non pulita
            entity.HasIndex(x => new { x.RegistroCassaId, x.Aliquota, x.Stimato })
                .IsUnique();
        });

        modelBuilder.Entity<ConteggioMoneta>(entity =>
        {
            entity
                .ToTable("ConteggiMoneta")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Quantita)
                .IsRequired();

            entity.Property(x => x.Totale)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.IsApertura)
                .IsRequired();

            entity.HasOne(x => x.RegistroCassa)
                .WithMany(x => x.ConteggiMoneta)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Denominazione)
                .WithMany(x => x.ConteggiMoneta)
                .HasForeignKey(x => x.DenominazioneMonetaId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SpesaCassa>(entity =>
        {
            entity
                .ToTable("SpeseCassa")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Descrizione)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.Importo)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Categoria)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired()
                .HasDefaultValue(CategoriaSpesa.Altro)
                // Sentinel = Altro (valore di default CLR della proprietà): così un valore esplicito
                // Affitto (CLR default dell'enum) viene inviato al DB e non scambiato per "non impostato".
                .HasSentinel(CategoriaSpesa.Altro);

            entity.HasOne(x => x.RegistroCassa)
                .WithMany(x => x.SpeseCassa)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Product Configuration (Prodotto)
        modelBuilder.Entity<Prodotto>(entity =>
        {
            entity
                .ToTable("Prodotti")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.ProdottoId);

            entity.Property(x => x.ProdottoId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Codice)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Nome)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.Descrizione)
                .HasColumnType("text");

            entity.Property(x => x.Prezzo)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Categoria)
                .HasMaxLength(100);

            entity.Property(x => x.UnitaDiMisura)
                .HasMaxLength(20)
                .HasDefaultValue("pz");

            entity.Property(x => x.Attivo)
                .HasDefaultValue(true);

            // Aliquota IVA in percentuale (es. 22.00), come Fornitore.AliquotaIva
            entity.Property(x => x.AliquotaIva)
                .HasColumnType("decimal(5,2)")
                .IsRequired()
                .HasDefaultValue(22.00m);

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasMany(x => x.Vendite)
                .WithOne(x => x.Prodotto)
                .HasForeignKey(x => x.ProdottoId)
                .OnDelete(DeleteBehavior.Restrict);

            // Index on Codice for faster lookups
            entity.HasIndex(x => x.Codice)
                .IsUnique();

            // Ordine manuale delle tessere al punto vendita. Il default a database è ciò che
            // rende la migrazione additiva su un listino già popolato: tutte le righe nascono
            // a 0, e con il pareggio su Codice la griglia si presenta esattamente come prima.
            entity.Property(x => x.Ordinamento)
                .HasDefaultValue(0);

            // Nullable senza default: l'assenza significa «usa il colore generato dalla
            // categoria», che è il comportamento di prima del campo. Un default qui darebbe a
            // ogni prodotto un colore esplicito che nessuno ha scelto.
            entity.Property(x => x.Colore)
                .HasMaxLength(20);

            // ── Campi vetrina ────────────────────────────────────────────────────────
            // Default espliciti anche dove coinciderebbero con il default di CLR: sono ciò
            // che rende additiva la migrazione su un listino già popolato, perché il backfill
            // delle righe esistenti lo fa il database e non un aggiornamento di massa.
            entity.Property(x => x.VisibileSulSito)
                .HasDefaultValue(false);

            entity.Property(x => x.NomeVetrina)
                .HasMaxLength(255);

            entity.Property(x => x.DescrizioneVetrina)
                .HasColumnType("text");

            entity.Property(x => x.CategoriaVetrina)
                .HasMaxLength(100);

            // decimal(10,2) come ogni altro importo del progetto
            entity.Property(x => x.PrezzoVetrina)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.OrdinamentoVetrina)
                .HasDefaultValue(0);

            entity.Property(x => x.Allergeni)
                .HasMaxLength(255);

            entity.Property(x => x.Novita)
                .HasDefaultValue(false);

            entity.Property(x => x.Consigliato)
                .HasDefaultValue(false);

            // `date` e non `datetime`: la lavagna è di un GIORNO. Con un datetime il confronto
            // «è di oggi» diventerebbe un intervallo fra due istanti, e la prima riga inserita
            // con un'ora diversa da mezzanotte sparirebbe dalla lavagna senza spiegazione.
            entity.Property(x => x.InLavagnaDal)
                .HasColumnType("date");

            entity.HasIndex(x => x.InLavagnaDal)
                .HasDatabaseName("IX_Prodotti_InLavagnaDal");

            // Restrict e non Cascade: eliminare un media ancora assegnato a un prodotto deve
            // FALLIRE. Con Cascade sparirebbe il prodotto insieme all'immagine; con SetNull il
            // prodotto resterebbe pubblicato e muto. Il rifiuto è l'unico esito che non mente,
            // e vale anche per una cancellazione fatta a mano direttamente a database.
            entity.HasOne(x => x.Immagine)
                .WithMany(x => x.Prodotti)
                .HasForeignKey(x => x.ImmagineId)
                .OnDelete(DeleteBehavior.Restrict);

            // Filtro dell'API pubblica di Fase 2
            entity.HasIndex(x => x.VisibileSulSito);
        });

        // Media Configuration (MediaAsset)
        modelBuilder.Entity<MediaAsset>(entity =>
        {
            entity
                .ToTable("MediaAssets")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.MediaAssetId);

            entity.Property(x => x.MediaAssetId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Chiave)
                .HasMaxLength(255)
                .IsRequired();

            // L'unicità della chiave è garantita QUI, non dal generatore di slug: il suffisso
            // casuale rende la collisione improbabile, l'indice la rende impossibile.
            entity.HasIndex(x => x.Chiave)
                .IsUnique();

            entity.Property(x => x.NomeOriginale)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.MimeType)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.LarghezzeDisponibili)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.TestoAlternativo)
                .HasMaxLength(500);

            entity.Property(x => x.Didascalia)
                .HasMaxLength(500);

            entity.Property(x => x.Focale)
                .HasMaxLength(20);

            // text e non varchar: il LQIP base64 supera comodamente i limiti di una colonna
            // indicizzabile, e non c'è alcuna ragione per interrogarlo.
            entity.Property(x => x.Placeholder)
                .HasColumnType("text");

            entity.Property(x => x.Cartella)
                .HasMaxLength(100)
                .HasDefaultValue("generale");

            entity.Property(x => x.Pubblicato)
                .HasDefaultValue(true);

            // Elenco della libreria: raggruppato per cartella e ordinato dentro ciascuna
            entity.HasIndex(x => new { x.Cartella, x.Ordinamento });

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        });

        // Impostazioni Vetrina Configuration (singleton IRRIGIDITO)
        //
        // 🔴 Perché qui il singleton è imposto e in BusinessSettings no. I due casi non sono
        //    simmetrici: BusinessSettings è scritta da una schermata, da un tipo di utente, ed è
        //    lì da anni. Questa è scritta da un amministratore, SEEDATA all'avvio, e letta da una
        //    rotta ANONIMA. Un duplicato qui produce il guasto peggiore possibile per un dato
        //    pubblico — il sito mostra un indirizzo e l'amministratore ne modifica un altro —
        //    con zero errori da qualunque parte si guardi.
        //
        // ⚠️ DEBITO NOTO, dichiarato e non dimenticato: il singleton di BusinessSettings resta
        //    permissivo (chiave auto-incrementale, nessun vincolo, letture con
        //    FirstOrDefaultAsync senza criterio). Irrigidirlo è un CHANGE DEDICATO: una riga di
        //    configurazione, ma su una tabella che cassa e chiusure mensili leggono e scrivono,
        //    quindi con i suoi test e la sua verifica su dati reali. Non è una svista di questa
        //    change: è un lavoro che non si fa di straforo dentro un'altra migrazione.
        modelBuilder.Entity<ImpostazioniVetrina>(entity =>
        {
            entity
                .ToTable("ImpostazioniVetrina", t =>
                {
                    t.HasCheckConstraint(
                        "CK_ImpostazioniVetrina_Singleton", "`ImpostazioniVetrinaId` = 1");

                    // 🔴 L'indice del giorno è un intero, e un intero accetta 7 — che non è un
                    //    giorno. Il vincolo sta a database e non solo nel resolver perché il
                    //    danno di un valore fuori scala è **muto**: il sito indicizzerebbe
                    //    `GIORNI[7]`, cioè `undefined`, e scriverebbe «Il piatto del undefined»
                    //    in un titolo, in un `<h1>` e nei dati per i motori di ricerca.
                    t.HasCheckConstraint(
                        "CK_ImpostazioniVetrina_PiattoGiorno",
                        "`PiattoGiorno` BETWEEN 0 AND 6");
                })
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.ImpostazioniVetrinaId);

            // 🔴 ValueGeneratedNever non è cosmesi: l'id è un valore di dominio ("la riga"), non
            //    un contatore. Con l'auto-increment un INSERT senza id creerebbe la riga 2 IN
            //    SILENZIO, e il CHECK è l'unico strato che nessuno può saltare — vale anche per
            //    un INSERT scritto a mano in una sessione MySQL alle due di notte.
            entity.Property(x => x.ImpostazioniVetrinaId)
                .ValueGeneratedNever();

            entity.Property(x => x.InsegnaPubblica)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Via)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Cap)
                .HasMaxLength(10)
                .IsRequired();

            entity.Property(x => x.Citta)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Provincia)
                .HasMaxLength(5)
                .IsRequired();

            // ⚠️ Il default vive QUI e non solo nel seed: il seed salta quando la riga esiste,
            //    quindi una colonna aggiunta in futuro non riceverebbe MAI il valore del seed
            //    sulle installazioni già avviate — prenderebbe il default del database. Vale per
            //    Paese, OraInizioTemaSera, PrenotazioniPreavvisoOre e PrenotazioniCopertiMax.
            entity.Property(x => x.Paese)
                .HasMaxLength(2)
                .IsRequired()
                .HasDefaultValue("IT");

            // decimal(9,6): ~11 cm di risoluzione, più che sufficiente per un ingresso, e non
            // un double — le coordinate si confrontano e si serializzano, non si sommano.
            entity.Property(x => x.Latitudine)
                .HasColumnType("decimal(9,6)");

            entity.Property(x => x.Longitudine)
                .HasColumnType("decimal(9,6)");

            entity.Property(x => x.Telefono)
                .HasMaxLength(50);

            entity.Property(x => x.Email)
                .HasMaxLength(255);

            // URL completi: 500 copre qualunque profilo social reale senza diventare un campo
            // che nessuno può indicizzare.
            entity.Property(x => x.UrlInstagram)
                .HasMaxLength(500);

            entity.Property(x => x.UrlFacebook)
                .HasMaxLength(500);

            entity.Property(x => x.MetaTitoloDefault)
                .HasMaxLength(200);

            // text e non varchar: una meta description supera comodamente i limiti utili di una
            // colonna indicizzabile, e non c'è alcuna ragione per interrogarla.
            entity.Property(x => x.MetaDescrizioneDefault)
                .HasColumnType("text");

            entity.Property(x => x.OraInizioTemaSera)
                .HasMaxLength(5)
                .IsRequired()
                .HasDefaultValue("18:00");

            entity.Property(x => x.PrenotazioniPreavvisoOre)
                .HasDefaultValue(2);

            entity.Property(x => x.PrenotazioniCopertiMax)
                .HasDefaultValue(20);

            entity.Property(x => x.TurnstileSiteKey)
                .HasMaxLength(255);

            // ── I testi editoriali ────────────────────────────────────────────────────────
            // I titoli hanno un limite perché sono titoli: uno che non ci sta in 200 caratteri
            // non è un titolo, è un paragrafo scritto nel campo sbagliato, e il limite lo dice
            // al momento del salvataggio invece che al primo che guarda il sito.
            entity.Property(x => x.ClaimVetrina)
                .HasColumnType("text");

            entity.Property(x => x.StoriaTitolo)
                .HasMaxLength(200);

            entity.Property(x => x.StoriaTesto)
                .HasColumnType("text");

            entity.Property(x => x.AperitivoTitolo)
                .HasMaxLength(200);

            entity.Property(x => x.AperitivoTesto)
                .HasColumnType("text");

            entity.Property(x => x.AperitivoPunti)
                .HasColumnType("text");

            entity.Property(x => x.AperitivoCategorie)
                .HasColumnType("text");

            entity.Property(x => x.PiattoTitolo)
                .HasMaxLength(200);

            entity.Property(x => x.PiattoTesto)
                .HasColumnType("text");

            // 🔴 Il default sta anche a DATABASE, e non solo nell'inizializzatore del modello:
            //    la colonna nasce su una riga che esiste già, e senza un default MySQL la
            //    riempirebbe di zeri — cioè metterebbe il piatto di lunedì su ogni installazione
            //    esistente, in silenzio. Con il default la riga preesistente nasce al mercoledì,
            //    che è lo stesso valore che vedrebbe un'installazione nuova.
            entity.Property(x => x.PiattoGiorno)
                .HasDefaultValue(2);

            // ── Reputazione ───────────────────────────────────────────────────────────────
            // decimal(2,1): da 0.0 a 9.9, cioè esattamente la forma di un punteggio su cinque.
            // Un decimal(9,2) accetterebbe 4712,50 stelle senza che nulla protesti.
            entity.Property(x => x.PunteggioGoogle)
                .HasColumnType("decimal(2,1)");

            entity.Property(x => x.UrlProfiloGoogle)
                .HasMaxLength(500);

            // 🔴 WithMany() ESPLICITO e SENZA argomento. MediaAsset ha già
            //    ICollection<Prodotto> Prodotti: se questa seconda relazione non dichiarasse di
            //    non avere navigazione inversa, EF potrebbe tentare di riusare quella collezione
            //    o creare una FK ombra, e la migrazione produrrebbe una colonna su MediaAssets
            //    che nessuno ha chiesto — su una tabella che questa change ha promesso di non
            //    toccare.
            //
            //    Restrict e non Cascade/SetNull, per la stessa ragione dell'immagine di
            //    prodotto: cancellare un media assegnato deve FALLIRE. Con Cascade sparirebbero
            //    le impostazioni del sito insieme a una foto; con SetNull l'anteprima social si
            //    romperebbe in silenzio su ogni condivisione.
            entity.HasOne(x => x.ImmagineOg)
                .WithMany()
                .HasForeignKey(x => x.ImmagineOgId)
                .OnDelete(DeleteBehavior.Restrict);

            // ── I quattro slot immagine delle pagine ──────────────────────────────────────
            // Stessa forma dell'anteprima social, per le stesse due ragioni, e vale ripeterle
            // perché qui si moltiplicano per quattro:
            //
            // 🔴 WithMany() esplicito e SENZA argomento su tutti e quattro. Con la navigazione
            //    inversa EF creerebbe quattro collezioni su MediaAsset, cioè quattro colonne
            //    ombra su
            //    una tabella che questa change ha promesso di non toccare — e la migrazione le
            //    porterebbe senza che nessuno le abbia chieste.
            //
            //    Restrict e non Cascade/SetNull: cancellare un media assegnato deve FALLIRE. Con
            //    Cascade sparirebbero le impostazioni del sito insieme a una foto; con SetNull la
            //    pagina perderebbe la sua immagine in silenzio, ricadendo sul ripiego posizionale
            //    — cioè proprio l'effetto che gli slot esistono per togliere.
            entity.HasOne(x => x.ImmagineEroeHome)
                .WithMany()
                .HasForeignKey(x => x.ImmagineEroeHomeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.ImmagineRitrattoLocale)
                .WithMany()
                .HasForeignKey(x => x.ImmagineRitrattoLocaleId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.ImmagineEroeAperitivo)
                .WithMany()
                .HasForeignKey(x => x.ImmagineEroeAperitivoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.ImmagineEroePiatto)
                .WithMany()
                .HasForeignKey(x => x.ImmagineEroePiattoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        });

        // ── Recensioni riportate sul sito ────────────────────────────────────────────────
        modelBuilder.Entity<RecensioneVetrina>(entity =>
        {
            entity
                .ToTable("RecensioniVetrina", t => t.HasCheckConstraint(
                    // 🔴 A database e non solo nel resolver: una recensione a sei stelle in
                    //    pagina è un errore che nessuno rilegge, e le righe di questa tabella si
                    //    inseriscono anche a mano quando si migra del contenuto.
                    "CK_RecensioniVetrina_Punteggio", "`Punteggio` BETWEEN 1 AND 5"))
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.RecensioneVetrinaId);

            entity.Property(x => x.Autore)
                .HasMaxLength(120)
                .IsRequired();

            entity.Property(x => x.Testo)
                .HasColumnType("text")
                .IsRequired();

            entity.Property(x => x.Fonte)
                .HasMaxLength(60);

            entity.Property(x => x.Punteggio)
                .HasDefaultValue(5);

            // L'indice serve alla lettura pubblica, che filtra le pubblicate e le ordina: è
            // l'unica query che questa tabella riceve, e la riceve a ogni caricamento della home.
            entity.HasIndex(x => new { x.Pubblicata, x.Ordinamento })
                .HasDatabaseName("IX_RecensioniVetrina_Pubblicata_Ordinamento");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        });

        // Business Settings Configuration
        modelBuilder.Entity<BusinessSettings>(entity =>
        {
            entity
                .ToTable("BusinessSettings")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.SettingsId);

            entity.Property(x => x.SettingsId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.BusinessName)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.OpeningTime)
                .HasMaxLength(5)
                .IsRequired()
                .HasDefaultValue("09:00");

            entity.Property(x => x.ClosingTime)
                .HasMaxLength(5)
                .IsRequired()
                .HasDefaultValue("18:00");

            entity.Property(x => x.OperatingDays)
                .HasColumnType("json")
                .IsRequired()
                .HasDefaultValue("[true,true,true,true,true,false,false]");

            entity.Property(x => x.Timezone)
                .HasMaxLength(50)
                .IsRequired()
                .HasDefaultValue("Europe/Rome");

            entity.Property(x => x.Currency)
                .HasMaxLength(3)
                .IsRequired()
                .HasDefaultValue("EUR");

            entity.Property(x => x.VatRate)
                .HasColumnType("decimal(5,4)")
                .IsRequired()
                .HasDefaultValue(0.10m);

            entity.Property(x => x.GiornaleImportoSabato)
                .HasColumnType("decimal(10,2)")
                .IsRequired()
                .HasDefaultValue(5.00m);

            entity.Property(x => x.GiornaleImportoFeriale)
                .HasColumnType("decimal(10,2)")
                .IsRequired()
                .HasDefaultValue(3.20m);

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        });

        // Periodo Programmazione Configuration
        modelBuilder.Entity<PeriodoProgrammazione>(entity =>
        {
            entity
                .ToTable("PeriodiProgrammazione")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.PeriodoId);

            entity.Property(x => x.PeriodoId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.DataInizio)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.DataFine)
                .HasColumnType("date");

            entity.Property(x => x.GiorniOperativi)
                .HasColumnType("json")
                .IsRequired()
                .HasDefaultValue("[true,true,true,true,true,false,false]");

            entity.Property(x => x.OrarioApertura)
                .HasColumnType("time")
                .IsRequired()
                .HasDefaultValue(new TimeOnly(9, 0));

            entity.Property(x => x.OrarioChiusura)
                .HasColumnType("time")
                .IsRequired()
                .HasDefaultValue(new TimeOnly(18, 0));

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Settings)
                .WithMany(s => s.Periodi)
                .HasForeignKey(x => x.SettingsId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indice su SettingsId + DataInizio per ricerca periodo per data
            entity.HasIndex(x => new { x.SettingsId, x.DataInizio });
        });

        // Giorno Non Lavorativo Configuration
        modelBuilder.Entity<GiornoNonLavorativo>(entity =>
        {
            entity
                .ToTable("GiorniNonLavorativi")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.GiornoId);

            entity.Property(x => x.GiornoId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Data)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.Descrizione)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.CodiceMotivo)
                .HasMaxLength(50)
                .IsRequired()
                .HasDefaultValue("FESTIVITA_NAZIONALE");

            entity.Property(x => x.Ricorrente)
                .HasDefaultValue(false);

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Settings)
                .WithMany(s => s.GiorniNonLavorativi)
                .HasForeignKey(x => x.SettingsId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indice univoco su SettingsId + Data (un solo record per data per settings)
            entity.HasIndex(x => new { x.SettingsId, x.Data })
                .IsUnique();
        });

        // Sale Configuration (Vendita)
        modelBuilder.Entity<Vendita>(entity =>
        {
            entity
                .ToTable("Vendite")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.VenditaId);

            entity.Property(x => x.VenditaId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Quantita)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.PrezzoUnitario)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.PrezzoTotale)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            // Il secchio dell'incasso: uno dei tre valori di MetodiPagamentoVendita.
            // ⚠️ Il default a livello di colonna è il NON tracciato, l'unico che non muove
            //    alcun campo del registro: una riga inserita da una via che non conosce questo
            //    campo non può gonfiare un incasso per sbaglio.
            entity.Property(x => x.MetodoPagamento)
                .HasMaxLength(30)
                .IsRequired()
                .HasDefaultValue(Common.MetodiPagamentoVendita.ContanteNonTracciato);

            // Snapshot IVA di riga (aliquota in percentuale, importi scorporati)
            entity.Property(x => x.AliquotaIva)
                .HasColumnType("decimal(5,2)")
                .IsRequired()
                .HasDefaultValue(22.00m);

            entity.Property(x => x.Imponibile)
                .HasColumnType("decimal(10,2)")
                .IsRequired()
                .HasDefaultValue(0m);

            entity.Property(x => x.ImportoIva)
                .HasColumnType("decimal(10,2)")
                .IsRequired()
                .HasDefaultValue(0m);

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.DataOra)
                .HasColumnType("datetime")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.RegistroCassa)
                .WithMany()
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Prodotto)
                .WithMany(x => x.Vendite)
                .HasForeignKey(x => x.ProdottoId)
                .OnDelete(DeleteBehavior.Restrict);

            // L'ordine alla cui chiusura la vendita è nata.
            // ⚠️ Restrict e non Cascade: un ordine che ha incassato non si cancella a database, si
            //    STORNA — e lo storno cancella le Vendite esplicitamente, dopo aver applicato il
            //    delta inverso. Una cascata renderebbe possibile far sparire l'incasso passando
            //    dalla porta di servizio, senza che nessun secchio se ne accorga.
            entity.HasOne(x => x.Ordine)
                .WithMany(x => x.Vendite)
                .HasForeignKey(x => x.OrdineId)
                .OnDelete(DeleteBehavior.Restrict);

            // Index on RegistroCassaId for faster queries by register
            entity.HasIndex(x => x.RegistroCassaId);

            // Index on DataOra for time-based filtering
            entity.HasIndex(x => x.DataOra);

            // Serve allo storno, che deve ritrovare tutte le vendite di un ordine.
            entity.HasIndex(x => x.OrdineId);
        });

        // Ordini del punto vendita (Ordine + RigaOrdine)
        modelBuilder.Entity<Ordine>(entity =>
        {
            entity
                .ToTable("Ordini")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.OrdineId);

            entity.Property(x => x.OrdineId)
                .ValueGeneratedOnAdd();

            // 🔴 LA GUARDIA DELLA TRANSIZIONE, e sta qui — non nel chiamante.
            //    Con IsConcurrencyToken ogni UPDATE su un Ordine porta in coda
            //    "AND Stato = <valore letto>", ed EF lancia DbUpdateConcurrencyException se tocca
            //    zero righe. È ciò che rende chiusura, annullo e storno una-e-una-sola-volta senza
            //    SQL grezzo e senza il Reload() che il SQL grezzo imporrebbe.
            //    Serve perché SecchiIncassiApplier.ApplicaDelta NON è idempotente: applicarlo due
            //    volte raddoppia l'incasso e nessun controllo a valle se ne accorge.
            entity.Property(x => x.Stato)
                .HasMaxLength(20)
                .IsRequired()
                .HasDefaultValue(Common.StatiOrdine.Aperto)
                .IsConcurrencyToken();

            // ⚠️ NON nullable, e non è una svista: in MySQL (come in Sqlite) più NULL sono
            //    distinti dentro un indice unico. Con SuffissoSplit nullable la terna
            //    (RegistroCassaId, Numero, NULL) sarebbe duplicabile in silenzio, cioè l'indice
            //    qui sotto smetterebbe di proteggere il caso normale — l'ordine non splittato,
            //    che è la quasi totalità. Vuoto se non splittato, "A"/"B"/… sui figli.
            entity.Property(x => x.SuffissoSplit)
                .HasMaxLength(2)
                .IsRequired()
                .HasDefaultValue(string.Empty);

            entity.Property(x => x.MetodoPagamento)
                .HasMaxLength(30);

            entity.Property(x => x.TotaleOrdine)
                .HasColumnType("decimal(10,2)")
                .IsRequired()
                .HasDefaultValue(0m);

            // Il contante dato dal cliente: aiuto all'operatore per il resto da rendere, MAI un
            // dato contabile. Non confondere con RegistroCassa.Resto (colonna AG del foglio).
            entity.Property(x => x.ContanteRicevuto)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.MotivoAnnullamento)
                .HasColumnType("text");

            entity.Property(x => x.MotivoStorno)
                .HasColumnType("text");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.ApertoIl)
                .HasColumnType("datetime")
                .IsRequired();

            entity.Property(x => x.ChiusoIl)
                .HasColumnType("datetime");

            entity.Property(x => x.AnnullatoIl)
                .HasColumnType("datetime");

            entity.Property(x => x.StornatoIl)
                .HasColumnType("datetime");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            // Restrict: un registro con ordini non si porta via gli ordini in cascata. La guardia
            // parlante sta in EliminaRegistroCassaOrchestrator; questo è il fondo che regge se
            // qualcuno arrivasse da un'altra strada.
            entity.HasOne(x => x.RegistroCassa)
                .WithMany()
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Restrict);

            // Restrict anche qui: cancellare un padre non deve far sparire i figli CHIUSO, che
            // hanno mosso i secchi. Il padre comunque non si cancella — passa a SPLITTATO.
            entity.HasOne(x => x.OrdinePadre)
                .WithMany(x => x.Figli)
                .HasForeignKey(x => x.OrdinePadreId)
                .OnDelete(DeleteBehavior.Restrict);

            // 🔴 Correttezza, non ottimizzazione. MAX(Numero)+1 all'apertura ha una corsa: due
            //    aperture concorrenti leggono lo stesso massimo. Senza questo indice la collisione
            //    è MUTA — due ticket stampati identici, scoperti quando qualcuno incassa quello
            //    sbagliato. Con l'indice diventa un insert fallito, e apriOrdine è ritentabile
            //    perché non crea nient'altro.
            entity.HasIndex(x => new { x.RegistroCassaId, x.Numero, x.SuffissoSplit })
                .IsUnique();

            // 🔴 STATO PER PRIMO, e la ragione è la query che NON filtra sul registro.
            //    Le letture sugli ordini sono due: la guardia della chiusura di cassa
            //    (RegistroCassaId + Stato) e l'elenco degli ordini aperti di TUTTI i registri
            //    (Stato soltanto), che non può filtrare su oggi o un ordine aperto a cavallo di
            //    mezzanotte sparirebbe dall'elenco bloccando per sempre la chiusura di ieri.
            //    Con (RegistroCassaId, Stato) la seconda non ha il prefisso e legge tutta la
            //    tabella; con (Stato, RegistroCassaId) le serve entrambe — la prima è un doppio
            //    confronto di uguaglianza, a cui l'ordine delle colonne è indifferente.
            //    ⚠️ Le letture per solo RegistroCassaId (MAX(Numero) dell'apertura, la guardia
            //    dell'eliminazione registro) non restano scoperte: hanno già il prefisso
            //    dell'indice unico qui sopra. Un secondo indice sarebbe stato costo di scrittura
            //    senza copertura nuova.
            entity.HasIndex(x => new { x.Stato, x.RegistroCassaId });
        });

        modelBuilder.Entity<RigaOrdine>(entity =>
        {
            entity
                .ToTable("RigheOrdine")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.RigaOrdineId);

            entity.Property(x => x.RigaOrdineId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Quantita)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.PrezzoUnitario)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.PrezzoTotale)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            // Snapshot dell'aliquota al momento del tocco, stessa forma di Vendita.AliquotaIva.
            // ⚠️ Qui NON vivono Imponibile/ImportoIva: lo scorporo ha un solo posto in cui accade,
            //    RicalcolaImportiSnapshot, e avviene sulla Vendita alla chiusura.
            entity.Property(x => x.AliquotaIva)
                .HasColumnType("decimal(5,2)")
                .IsRequired()
                .HasDefaultValue(10.00m);

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.DataOra)
                .HasColumnType("datetime")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            // Cascade: le righe di un ordine cancellato a database non hanno vita propria.
            // ⚠️ Nessuna transizione dell'ordine le cancella: lo storno conserva le righe e
            //    cancella le Vendite, non il contrario.
            entity.HasOne(x => x.Ordine)
                .WithMany(x => x.Righe)
                .HasForeignKey(x => x.OrdineId)
                .OnDelete(DeleteBehavior.Cascade);

            // Restrict come Vendita → Prodotto: un prodotto battuto in un ordine non si cancella.
            entity.HasOne(x => x.Prodotto)
                .WithMany()
                .HasForeignKey(x => x.ProdottoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.OrdineId);
        });

        // Supplier Management Configuration
        modelBuilder.Entity<Fornitore>(entity =>
        {
            entity
                .ToTable("Fornitori")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.FornitoreId);

            entity.Property(x => x.FornitoreId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.RagioneSociale)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.PartitaIva)
                .HasMaxLength(20);

            entity.Property(x => x.CodiceFiscale)
                .HasMaxLength(16);

            entity.Property(x => x.Indirizzo)
                .HasColumnType("text");

            entity.Property(x => x.Citta)
                .HasMaxLength(100);

            entity.Property(x => x.Cap)
                .HasMaxLength(10);

            entity.Property(x => x.Paese)
                .HasMaxLength(2)
                .HasDefaultValue("IT");

            entity.Property(x => x.Email)
                .HasMaxLength(255);

            entity.Property(x => x.Telefono)
                .HasMaxLength(50);

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.Attivo)
                .HasDefaultValue(true);

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            // Indice univoco su PartitaIva (solo se presente)
            entity.HasIndex(x => x.PartitaIva)
                .IsUnique()
                .HasFilter("[PartitaIva] IS NOT NULL");

            // Indice su RagioneSociale per ricerca
            entity.HasIndex(x => x.RagioneSociale);

            // Indice su Attivo per filtrare fornitori attivi
            entity.HasIndex(x => x.Attivo);
        });

        modelBuilder.Entity<FatturaAcquisto>(entity =>
        {
            entity
                .ToTable("FattureAcquisto")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.FatturaId);

            entity.Property(x => x.FatturaId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.NumeroFattura)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.DataFattura)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.DataScadenza)
                .HasColumnType("date");

            entity.Property(x => x.Imponibile)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.ImportoIva)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleConIva)
                .HasColumnType("decimal(10,2)");

            // Default true: lo storico precedente al campo è tutto IVA calcolata da aliquota
            // (l'inserimento manuale dell'IVA non esisteva), quindi il backfill è esatto.
            entity.Property(x => x.IvaCalcolata)
                .IsRequired()
                .HasDefaultValue(true);

            entity.Property(x => x.Stato)
                .HasMaxLength(20)
                .HasDefaultValue("DA_PAGARE");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Fornitore)
                .WithMany(f => f.FattureAcquisto)
                .HasForeignKey(x => x.FornitoreId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indice univoco su FornitoreId + NumeroFattura
            entity.HasIndex(x => new { x.FornitoreId, x.NumeroFattura })
                .IsUnique();

            // Indice su DataFattura per ordinamento/filtri
            entity.HasIndex(x => x.DataFattura);

            // Indice su Stato per filtri
            entity.HasIndex(x => x.Stato);
        });

        modelBuilder.Entity<DocumentoTrasporto>(entity =>
        {
            entity
                .ToTable("DocumentiTrasporto")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.DdtId);

            entity.Property(x => x.DdtId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.NumeroDdt)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.DataDdt)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.Importo)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Fornitore)
                .WithMany(f => f.DocumentiTrasporto)
                .HasForeignKey(x => x.FornitoreId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Fattura)
                .WithMany(f => f.DocumentiTrasporto)
                .HasForeignKey(x => x.FatturaId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indice univoco su FornitoreId + NumeroDdt
            entity.HasIndex(x => new { x.FornitoreId, x.NumeroDdt })
                .IsUnique();

            // Indice su DataDdt per ordinamento/filtri
            entity.HasIndex(x => x.DataDdt);

            // Indice su FatturaId per join
            entity.HasIndex(x => x.FatturaId);
        });

        modelBuilder.Entity<PagamentoFornitore>(entity =>
        {
            entity
                .ToTable("PagamentiFornitori")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.PagamentoId);

            entity.Property(x => x.PagamentoId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.DataPagamento)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.Importo)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.MetodoPagamento)
                .HasMaxLength(50);

            entity.Property(x => x.Categoria)
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Fattura)
                .WithMany(f => f.Pagamenti)
                .HasForeignKey(x => x.FatturaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Ddt)
                .WithMany(d => d.Pagamenti)
                .HasForeignKey(x => x.DdtId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.RegistroCassa)
                .WithMany(r => r.PagamentiFornitori)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indice su DataPagamento per ordinamento/filtri
            entity.HasIndex(x => x.DataPagamento);

            // Indice su FatturaId per join
            entity.HasIndex(x => x.FatturaId);

            // Indice su DdtId per join
            entity.HasIndex(x => x.DdtId);

            // Indice su RegistroCassaId per join
            entity.HasIndex(x => x.RegistroCassaId);
        });

        modelBuilder.Entity<ChiusuraMensile>(entity =>
        {
            entity
                .ToTable("ChiusureMensili")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.ChiusuraId);

            entity.Property(x => x.ChiusuraId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Anno)
                .IsRequired();

            entity.Property(x => x.Mese)
                .IsRequired();

            entity.Property(x => x.Stato)
                .HasMaxLength(20)
                .HasDefaultValue("BOZZA");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.ChiusaIl)
                .HasColumnType("datetime");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.ChiusaDaUtente)
                .WithMany()
                .HasForeignKey(x => x.ChiusaDa)
                .OnDelete(DeleteBehavior.SetNull);

            // Indice univoco su Anno + Mese
            entity.HasIndex(x => new { x.Anno, x.Mese })
                .IsUnique();

            // Indice su Stato per filtri
            entity.HasIndex(x => x.Stato);
        });

        // ✅ NEW REFERENTIAL MODEL CONFIGURATIONS

        // RegistroCassaMensile (Join Table)
        modelBuilder.Entity<RegistroCassaMensile>(entity =>
        {
            entity.ToTable("RegistriCassaMensili")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci");

            // Chiave composita
            entity.HasKey(e => new { e.ChiusuraId, e.RegistroId });

            entity.Property(e => e.Incluso)
                .HasDefaultValue(true);

            entity.HasOne(e => e.Chiusura)
                .WithMany(c => c.RegistriInclusi)
                .HasForeignKey(e => e.ChiusuraId)
                .OnDelete(DeleteBehavior.Restrict); // Impedisce eliminazione chiusura

            entity.HasOne(e => e.Registro)
                .WithMany()
                .HasForeignKey(e => e.RegistroId)
                .OnDelete(DeleteBehavior.Restrict); // Impedisce eliminazione registro incluso

            // Indici per performance
            entity.HasIndex(e => e.ChiusuraId);
            entity.HasIndex(e => e.RegistroId);
        });

        modelBuilder.Entity<GruppoProdotti>(entity =>
        {
            entity.ToTable("GruppiProdotti")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci");

            entity.HasKey(e => e.GruppoProdottiId);

            entity.Property(e => e.Codice)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Nome)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.Colore)
                .HasMaxLength(20);

            entity.Property(e => e.Ordinamento)
                .HasDefaultValue(0);

            entity.Property(e => e.Attivo)
                .HasDefaultValue(true);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            // Come Prodotto.Codice: la chiave stabile è univoca, e il vincolo sta a database
            // perché è lì che regge anche contro due scritture in corsa.
            entity.HasIndex(e => e.Codice)
                .IsUnique();
        });

        modelBuilder.Entity<ProdottoGruppo>(entity =>
        {
            entity.ToTable("ProdottiGruppi")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci");

            // Chiave composita: un prodotto sta in un gruppo una volta sola, e il vincolo lo
            // dice lo schema invece di un controllo applicativo che qualcuno dimenticherà.
            entity.HasKey(e => new { e.GruppoProdottiId, e.ProdottoId });

            entity.Property(e => e.Ordinamento)
                .HasDefaultValue(0);

            // 🔴 Cascade sul gruppo, Restrict sul prodotto, e l'asimmetria è deliberata:
            //    sciogliere un gruppo è un'operazione ordinaria e deve portarsi via le sole
            //    appartenenze; un prodotto invece non si elimina affatto — non esiste
            //    `eliminaProdotto` — quindi la Restrict qui non blocca nulla che accada
            //    davvero, e vale come dichiarazione che quel verso non è previsto.
            entity.HasOne(e => e.Gruppo)
                .WithMany(g => g.Membri)
                .HasForeignKey(e => e.GruppoProdottiId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Prodotto)
                .WithMany(p => p.Gruppi)
                .HasForeignKey(e => e.ProdottoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.ProdottoId);
        });

    }
}