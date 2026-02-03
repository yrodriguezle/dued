# Piano di Refactoring - Chiusure Mensili (Opzione A: Modello Referenziale Puro)

**Data Inizio**: 2026-02-03
**Obiettivo**: Eliminare denormalizzazione e duplicazione dati in ChiusureMensile/SpeseMensili
**Approccio**: Modello referenziale puro con proprietà calcolate e audit trail completo

---

## Problema Identificato

### Modello Attuale (Problematico)

```
ChiusuraMensile
├── RicavoTotale (denormalizzato, NO FK) ⚠️
├── TotaleContanti (denormalizzato) ⚠️
├── SpeseAggiuntive (denormalizzato) ⚠️
└── Spese (1:N) → SpeseMensile
                   ├── Importo (duplicato) ⚠️
                   └── PagamentoId? (dualità semantica) ⚠️

RegistroCassa (disconnesso da ChiusuraMensile) ⚠️
```

### Problemi Critici

1. **P1: Denormalizzazione senza audit trail**
   - Totali persistiti come snapshot senza relazione FK
   - Impossibile ricostruire calcolo o verificare correttezza
   - Modifica post-chiusura di RegistroCassa non rilevabile

2. **P2: Dualità semantica in SpesaMensile**
   - Una tabella per due concetti: spese libere + pagamenti fatture
   - Importo duplicato (SpesaMensile.Importo vs PagamentoFornitore.Importo)
   - Rischio inconsistenza se importo pagamento cambia

3. **P3: Mancanza integrità referenziale temporale**
   - RegistriCassa del mese non vincolati a ChiusuraMensile
   - Possibile aggiungere/eliminare registri dopo chiusura
   - Nessun controllo completezza (tutti i giorni inclusi?)

---

## Soluzione: Opzione A - Modello Referenziale Puro

### Principi Architetturali

✅ **Single Source of Truth**: Totali calcolati da dati originali
✅ **Audit Completo**: Ogni modifica tracciabile via FK
✅ **Integrità Referenziale**: DeleteBehavior.Restrict impedisce eliminazioni inconsistenti
✅ **Separazione Semantica**: Spese libere vs pagamenti fatture in tabelle distinte
✅ **Immutabilità**: FK garantisce che dati inclusi non possano essere eliminati

### Diagramma Nuovo Modello

```
┌─────────────────────────────────────────┐
│        ChiusuraMensile                  │
│        (Aggregate Root)                 │
├─────────────────────────────────────────┤
│ • Anno, Mese, UltimoGiornoLavorativo    │
│ • Stato (BOZZA/CHIUSA/RICONCILIATA)     │
│                                         │
│ Proprietà calcolate (NotMapped):        │
│ • RicavoTotale     { get; }  ✅         │
│ • TotaleContanti   { get; }  ✅         │
│ • SpeseAggiuntive  { get; }  ✅         │
│ • RicavoNetto      { get; }  ✅         │
└───────┬─────────────────────┬───────────┘
        │ 1:N                 │ 1:N
        ↓                     ↓
┌──────────────────────┐  ┌──────────────────────┐
│ RegistroCassaMensile │  │  SpesaMensileLibera  │
│  (Join Table)        │  │                      │
├──────────────────────┤  ├──────────────────────┤
│ • ChiusuraId    FK   │  │ • ChiusuraId    FK   │
│ • RegistroId    FK ──┼─→│ • Descrizione        │
│ • Incluso      bool  │  │ • Importo            │
└──────────────────────┘  │ • Categoria (enum)   │
                          └──────────────────────┘

        │ 1:N
        ↓
┌─────────────────────────────────────┐
│  PagamentoMensileFornitori          │
│  (Join Table)                       │
├─────────────────────────────────────┤
│ • ChiusuraId           FK           │
│ • PagamentoFornitoreId FK ──────────┼──→ PagamentoFornitore
│ • InclusoInChiusura    bool         │        ├─ Importo
└─────────────────────────────────────┘        ├─ FatturaId?
                                               └─ DataPagamento
```

---

## Fasi di Implementazione

### ✅ FASE 1: Modelli di Dominio

#### Task 1.1: Creare enum CategoriaSpesa
**File**: `Models/CategoriaSpesa.cs`

```csharp
namespace duedgusto.Models;

public enum CategoriaSpesa
{
    Affitto,
    Utenze,
    Stipendi,
    Altro
}
```

**Perché**: Type-safety, elimina stringhe libere, facilita reportistica

---

#### Task 1.2: Creare RegistroCassaMensile
**File**: `Models/RegistroCassaMensile.cs`

```csharp
namespace duedgusto.Models;

public class RegistroCassaMensile
{
    public int ChiusuraId { get; set; }
    public int RegistroId { get; set; }
    public bool Incluso { get; set; } = true;

    // Navigation properties
    public ChiusuraMensile Chiusura { get; set; } = null!;
    public RegistroCassa Registro { get; set; } = null!;
}
```

**Dettagli**:
- Chiave composita: (ChiusuraId, RegistroId)
- Flag `Incluso`: Permette esclusioni temporanee senza eliminare link
- Traccia esplicitamente quali registri appartengono a quale chiusura

---

#### Task 1.3: Creare SpesaMensileLibera
**File**: `Models/SpesaMensileLibera.cs`

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models;

[Table("SpeseMensiliLibere")]
public class SpesaMensileLibera
{
    [Key]
    public int SpesaId { get; set; }

    [Required]
    public int ChiusuraId { get; set; }

    [Required]
    public string Descrizione { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "decimal(10,2)")]
    public decimal Importo { get; set; }

    [Required]
    public CategoriaSpesa Categoria { get; set; }

    public DateTime CreatoIl { get; set; } = DateTime.UtcNow;
    public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("ChiusuraId")]
    public ChiusuraMensile Chiusura { get; set; } = null!;
}
```

**Perché**:
- Semantica chiara per spese "libere" (non legate a fatture)
- Elimina PagamentoId nullable (fonte di confusione)
- Categoria type-safe con enum

---

#### Task 1.4: Creare PagamentoMensileFornitori
**File**: `Models/PagamentoMensileFornitori.cs`

```csharp
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models;

[Table("PagamentiMensiliFornitori")]
public class PagamentoMensileFornitori
{
    public int ChiusuraId { get; set; }
    public int PagamentoId { get; set; }
    public bool InclusoInChiusura { get; set; } = true;

    // Navigation properties
    [ForeignKey("ChiusuraId")]
    public ChiusuraMensile Chiusura { get; set; } = null!;

    [ForeignKey("PagamentoId")]
    public PagamentoFornitore Pagamento { get; set; } = null!;
}
```

**Dettagli**:
- Chiave composita: (ChiusuraId, PagamentoId)
- Separa pagamenti fatture da spese libere
- Single Source of Truth: Importo preso da `PagamentoFornitore.Importo`

---

#### Task 1.5: Modificare ChiusuraMensile
**File**: `Models/ChiusuraMensile.cs`

**Modifiche**:

1. **Rimuovere campi persistiti** (mantenere temporaneamente per migrazione):
   - `RicavoTotale?`
   - `TotaleContanti?`
   - `TotaleElettronici?`
   - `TotaleFatture?`
   - `SpeseAggiuntive?`
   - `RicavoNetto?`

2. **Aggiungere nuove navigation properties**:
```csharp
public ICollection<RegistroCassaMensile> RegistriInclusi { get; set; } = [];
public ICollection<SpesaMensileLibera> SpeseLibere { get; set; } = [];
public ICollection<PagamentoMensileFornitori> PagamentiInclusi { get; set; } = [];
```

3. **Aggiungere proprietà calcolate** (NotMapped):
```csharp
using System.ComponentModel.DataAnnotations.Schema;

[NotMapped]
public decimal RicavoTotaleCalcolato => RegistriInclusi
    .Where(r => r.Incluso)
    .Sum(r => r.Registro.TotaleVendite);

[NotMapped]
public decimal TotaleContantiCalcolato => RegistriInclusi
    .Where(r => r.Incluso)
    .Sum(r => r.Registro.IncassoContanteTracciato);

[NotMapped]
public decimal TotaleElettroniciCalcolato => RegistriInclusi
    .Where(r => r.Incluso)
    .Sum(r => r.Registro.IncassiElettronici);

[NotMapped]
public decimal TotaleFattureCalcolato => RegistriInclusi
    .Where(r => r.Incluso)
    .Sum(r => r.Registro.IncassiFattura);

[NotMapped]
public decimal SpeseAggiuntiveCalcolate =>
    SpeseLibere.Sum(s => s.Importo) +
    PagamentiInclusi.Where(p => p.InclusoInChiusura).Sum(p => p.Pagamento.Importo);

[NotMapped]
public decimal RicavoNettoCalcolato => RicavoTotaleCalcolato - SpeseAggiuntiveCalcolate;
```

**Nota**: Mantenere temporaneamente i vecchi campi con suffisso per confronto durante migrazione

---

### 📋 FASE 2: Persistenza e Configurazione

#### Task 2.1: Aggiornare AppDbContext
**File**: `DataAccess/AppDbContext.cs`

**Aggiungere DbSets**:
```csharp
public DbSet<RegistroCassaMensile> RegistriCassaMensili { get; set; }
public DbSet<SpesaMensileLibera> SpeseMensiliLibere { get; set; }
public DbSet<PagamentoMensileFornitori> PagamentiMensiliFornitori { get; set; }
```

**Aggiungere configurazioni in OnModelCreating**:

```csharp
// RegistroCassaMensile
modelBuilder.Entity<RegistroCassaMensile>(entity =>
{
    entity.ToTable("RegistriCassaMensili")
        .HasCharSet("utf8mb4")
        .UseCollation("utf8mb4_unicode_ci");

    entity.HasKey(e => new { e.ChiusuraId, e.RegistroId });

    entity.HasOne(e => e.Chiusura)
        .WithMany(c => c.RegistriInclusi)
        .HasForeignKey(e => e.ChiusuraId)
        .OnDelete(DeleteBehavior.Restrict); // Impedisce eliminazione chiusura

    entity.HasOne(e => e.Registro)
        .WithMany()
        .HasForeignKey(e => e.RegistroId)
        .OnDelete(DeleteBehavior.Restrict); // Impedisce eliminazione registro incluso

    entity.HasIndex(e => e.ChiusuraId);
    entity.HasIndex(e => e.RegistroId);
});

// SpesaMensileLibera
modelBuilder.Entity<SpesaMensileLibera>(entity =>
{
    entity.ToTable("SpeseMensiliLibere")
        .HasCharSet("utf8mb4")
        .UseCollation("utf8mb4_unicode_ci");

    entity.HasKey(e => e.SpesaId);

    entity.Property(e => e.SpesaId)
        .ValueGeneratedOnAdd();

    entity.Property(e => e.Categoria)
        .HasConversion<string>()
        .HasMaxLength(20)
        .IsRequired();

    entity.Property(e => e.Importo)
        .HasColumnType("decimal(10,2)")
        .IsRequired();

    entity.Property(e => e.CreatoIl)
        .HasColumnType("datetime")
        .HasDefaultValueSql("CURRENT_TIMESTAMP");

    entity.Property(e => e.AggiornatoIl)
        .HasColumnType("datetime")
        .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    entity.HasOne(e => e.Chiusura)
        .WithMany(c => c.SpeseLibere)
        .HasForeignKey(e => e.ChiusuraId)
        .OnDelete(DeleteBehavior.Cascade);

    entity.HasIndex(e => e.ChiusuraId);
    entity.HasIndex(e => e.Categoria);
});

// PagamentoMensileFornitori
modelBuilder.Entity<PagamentoMensileFornitori>(entity =>
{
    entity.ToTable("PagamentiMensiliFornitori")
        .HasCharSet("utf8mb4")
        .UseCollation("utf8mb4_unicode_ci");

    entity.HasKey(e => new { e.ChiusuraId, e.PagamentoId });

    entity.HasOne(e => e.Chiusura)
        .WithMany(c => c.PagamentiInclusi)
        .HasForeignKey(e => e.ChiusuraId)
        .OnDelete(DeleteBehavior.Restrict);

    entity.HasOne(e => e.Pagamento)
        .WithMany()
        .HasForeignKey(e => e.PagamentoId)
        .OnDelete(DeleteBehavior.Restrict);

    entity.HasIndex(e => e.ChiusuraId);
    entity.HasIndex(e => e.PagamentoId);
});

// Aggiornare ChiusuraMensile
modelBuilder.Entity<ChiusuraMensile>(entity =>
{
    // ... configurazioni esistenti ...

    // Ignorare proprietà calcolate
    entity.Ignore(e => e.RicavoTotaleCalcolato);
    entity.Ignore(e => e.TotaleContantiCalcolato);
    entity.Ignore(e => e.TotaleElettroniciCalcolato);
    entity.Ignore(e => e.TotaleFattureCalcolato);
    entity.Ignore(e => e.SpeseAggiuntiveCalcolate);
    entity.Ignore(e => e.RicavoNettoCalcolato);
});
```

---

#### Task 2.2: Creare ChiusuraMensileService
**File**: `Services/ChiusureMensili/ChiusuraMensileService.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.Services.ChiusureMensili;

public class ChiusuraMensileService
{
    private readonly AppDbContext _dbContext;

    public ChiusuraMensileService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Crea una nuova chiusura mensile con validazione completezza registri
    /// </summary>
    public async Task<ChiusuraMensile> CreaChiusuraAsync(int anno, int mese)
    {
        // 1. Validazione completezza registri
        var primoGiorno = new DateTime(anno, mese, 1);
        var ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        var registriMese = await _dbContext.RegistriCassa
            .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
            .Where(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED")
            .ToListAsync();

        // Controllo completezza
        var giorniMancanti = ElencoGiorniMancanti(registriMese, primoGiorno, ultimoGiorno);
        if (giorniMancanti.Any())
        {
            var giorniFormattati = string.Join(", ", giorniMancanti.Select(d => d.ToString("dd/MM/yyyy")));
            throw new InvalidOperationException($"Impossibile creare chiusura: registri mancanti per i giorni: {giorniFormattati}");
        }

        // 2. Verifica chiusura già esistente
        var esistente = await _dbContext.ChiusureMensili
            .FirstOrDefaultAsync(c => c.Anno == anno && c.Mese == mese);

        if (esistente != null)
        {
            throw new InvalidOperationException($"Chiusura mensile per {mese}/{anno} già esistente (ID: {esistente.ChiusuraId})");
        }

        // 3. Creazione chiusura
        var chiusura = new ChiusuraMensile
        {
            Anno = anno,
            Mese = mese,
            UltimoGiornoLavorativo = ultimoGiorno,
            Stato = "BOZZA"
        };

        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // 4. Associazione registri
        foreach (var registro in registriMese)
        {
            _dbContext.RegistriCassaMensili.Add(new RegistroCassaMensile
            {
                ChiusuraId = chiusura.ChiusuraId,
                RegistroId = registro.Id,
                Incluso = true
            });
        }

        // 5. Pagamenti fornitori del mese (automatici)
        var pagamentiMese = await _dbContext.PagamentiFornitori
            .Where(p => p.DataPagamento >= primoGiorno && p.DataPagamento <= ultimoGiorno)
            .ToListAsync();

        foreach (var pagamento in pagamentiMese)
        {
            _dbContext.PagamentiMensiliFornitori.Add(new PagamentoMensileFornitori
            {
                ChiusuraId = chiusura.ChiusuraId,
                PagamentoId = pagamento.PagamentoId,
                InclusoInChiusura = true
            });
        }

        await _dbContext.SaveChangesAsync();
        return chiusura;
    }

    /// <summary>
    /// Chiude definitivamente una chiusura mensile (transizione BOZZA → CHIUSA)
    /// </summary>
    public async Task<bool> ChiudiMensileAsync(int chiusuraId, int? utenteId)
    {
        var chiusura = await _dbContext.ChiusureMensili
            .Include(c => c.RegistriInclusi).ThenInclude(r => r.Registro)
            .Include(c => c.SpeseLibere)
            .Include(c => c.PagamentiInclusi).ThenInclude(p => p.Pagamento)
            .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

        if (chiusura == null)
            return false;

        if (chiusura.Stato != "BOZZA")
            throw new InvalidOperationException($"Impossibile chiudere: stato attuale è '{chiusura.Stato}', deve essere 'BOZZA'");

        // Validazione business rules
        if (chiusura.RicavoTotaleCalcolato <= 0)
            throw new InvalidOperationException("Impossibile chiudere con ricavi totali pari a zero");

        chiusura.Stato = "CHIUSA";
        chiusura.ChiusaDa = utenteId;
        chiusura.ChiusaIl = DateTime.UtcNow;
        chiusura.AggiornatoIl = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Aggiunge una spesa libera (non legata a fatture) alla chiusura
    /// </summary>
    public async Task<SpesaMensileLibera> AggiungiSpesaLiberaAsync(
        int chiusuraId,
        string descrizione,
        decimal importo,
        CategoriaSpesa categoria)
    {
        var chiusura = await _dbContext.ChiusureMensili
            .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

        if (chiusura == null)
            throw new InvalidOperationException($"Chiusura mensile con ID {chiusuraId} non trovata");

        if (chiusura.Stato != "BOZZA")
            throw new InvalidOperationException("Impossibile aggiungere spese a chiusura già chiusa");

        var spesa = new SpesaMensileLibera
        {
            ChiusuraId = chiusuraId,
            Descrizione = descrizione,
            Importo = importo,
            Categoria = categoria
        };

        _dbContext.SpeseMensiliLibere.Add(spesa);
        await _dbContext.SaveChangesAsync();

        return spesa;
    }

    /// <summary>
    /// Valida la completezza dei registri cassa per un mese
    /// </summary>
    public async Task<List<DateTime>> ValidaCompletezzaRegistriAsync(int anno, int mese)
    {
        var primoGiorno = new DateTime(anno, mese, 1);
        var ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        var registriMese = await _dbContext.RegistriCassa
            .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
            .Where(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED")
            .ToListAsync();

        return ElencoGiorniMancanti(registriMese, primoGiorno, ultimoGiorno);
    }

    private List<DateTime> ElencoGiorniMancanti(
        List<RegistroCassa> registri,
        DateTime primoGiorno,
        DateTime ultimoGiorno)
    {
        var giorniPresenti = registri.Select(r => r.Data.Date).ToHashSet();
        var giorniMancanti = new List<DateTime>();

        for (var data = primoGiorno; data <= ultimoGiorno; data = data.AddDays(1))
        {
            if (!giorniPresenti.Contains(data.Date))
                giorniMancanti.Add(data);
        }

        return giorniMancanti;
    }
}
```

---

#### Task 2.3: Creare Migration Strutturale
**Comando**:
```bash
dotnet ef migrations add RifacimentoChiusureMensiliOpzioneA
```

**Note**:
- Crea nuove tabelle: `RegistriCassaMensili`, `SpeseMensiliLibere`, `PagamentiMensiliFornitori`
- NON elimina tabella `SpeseMensili` (necessaria per migrazione dati)
- Ignora campi denormalizzati in `ChiusureMensile` (marcati `[NotMapped]`)

---

#### Task 2.4: Creare Service per Migrazione Dati
**File**: `Services/ChiusureMensili/MigrazioneChiusureMensiliService.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.Services.ChiusureMensili;

public class MigrazioneChiusureMensiliService
{
    private readonly AppDbContext _dbContext;

    public MigrazioneChiusureMensiliService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Migra dati dal vecchio modello al nuovo
    /// </summary>
    public async Task<MigrazioneResult> MigraDatiAsync()
    {
        var result = new MigrazioneResult();

        var chiusureVecchie = await _dbContext.ChiusureMensili
            .Include(c => c.Spese)
                .ThenInclude(s => s.Pagamento)
            .ToListAsync();

        foreach (var chiusura in chiusureVecchie)
        {
            try
            {
                // 1. Trova registri del mese
                var primoGiorno = new DateTime(chiusura.Anno, chiusura.Mese, 1);
                var ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

                var registriMese = await _dbContext.RegistriCassa
                    .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
                    .ToListAsync();

                // 2. Crea RegistroCassaMensile
                foreach (var registro in registriMese)
                {
                    var link = new RegistroCassaMensile
                    {
                        ChiusuraId = chiusura.ChiusuraId,
                        RegistroId = registro.Id,
                        Incluso = true
                    };
                    _dbContext.RegistriCassaMensili.Add(link);
                }

                // 3. Migra SpeseMensili
                foreach (var spesaVecchia in chiusura.Spese)
                {
                    if (spesaVecchia.PagamentoId.HasValue)
                    {
                        // È un pagamento fornitore
                        var pagamentoMensile = new PagamentoMensileFornitori
                        {
                            ChiusuraId = chiusura.ChiusuraId,
                            PagamentoId = spesaVecchia.PagamentoId.Value,
                            InclusoInChiusura = true
                        };
                        _dbContext.PagamentiMensiliFornitori.Add(pagamentoMensile);
                    }
                    else
                    {
                        // È una spesa libera
                        var categoria = MappaCategoria(spesaVecchia.Categoria);
                        var spesaLibera = new SpesaMensileLibera
                        {
                            ChiusuraId = chiusura.ChiusuraId,
                            Descrizione = spesaVecchia.Descrizione,
                            Importo = spesaVecchia.Importo,
                            Categoria = categoria,
                            CreatoIl = spesaVecchia.CreatoIl,
                            AggiornatoIl = spesaVecchia.AggiornatoIl
                        };
                        _dbContext.SpeseMensiliLibere.Add(spesaLibera);
                    }
                }

                await _dbContext.SaveChangesAsync();

                // 4. Validazione
                var erroriValidazione = ValidaChiusuraMigrata(chiusura, registriMese);
                if (erroriValidazione.Any())
                {
                    result.ChiusureConErrori.Add(chiusura.ChiusuraId, erroriValidazione);
                }
                else
                {
                    result.ChiusureMigrateConSuccesso++;
                }
            }
            catch (Exception ex)
            {
                result.ChiusureConErrori.Add(chiusura.ChiusuraId, new List<string> { ex.Message });
            }
        }

        return result;
    }

    private CategoriaSpesa MappaCategoria(string? categoriaStringa)
    {
        return categoriaStringa?.ToUpper() switch
        {
            "AFFITTO" => CategoriaSpesa.Affitto,
            "UTENZE" => CategoriaSpesa.Utenze,
            "STIPENDI" => CategoriaSpesa.Stipendi,
            _ => CategoriaSpesa.Altro
        };
    }

    private List<string> ValidaChiusuraMigrata(ChiusuraMensile chiusura, List<RegistroCassa> registri)
    {
        var errori = new List<string>();

        // Valida RicavoTotale
        var ricavoCalcolato = registri.Sum(r => r.TotaleVendite);
        var differenza = Math.Abs((chiusura.RicavoTotale ?? 0) - ricavoCalcolato);

        if (differenza > 0.01m) // Tolleranza 1 centesimo
        {
            errori.Add($"RicavoTotale: vecchio={chiusura.RicavoTotale}, calcolato={ricavoCalcolato}, diff={differenza}");
        }

        return errori;
    }
}

public class MigrazioneResult
{
    public int ChiusureMigrateConSuccesso { get; set; }
    public Dictionary<int, List<string>> ChiusureConErrori { get; set; } = new();
}
```

---

### 🔌 FASE 3: API GraphQL

#### Task 3.1: Aggiornare GraphQL Types
**Files da modificare**:
- `GraphQL/ChiusureMensili/Types/ChiusuraMensileType.cs`
- `GraphQL/ChiusureMensili/Types/ChiusuraMensileInputType.cs`

**Creare nuovi types**:
- `GraphQL/ChiusureMensili/Types/SpesaMensileTyperaType.cs`
- `GraphQL/ChiusureMensili/Types/SpesaMensileTyperaInputType.cs`
- `GraphQL/ChiusureMensili/Types/RegistroCassaMensileType.cs`
- `GraphQL/ChiusureMensili/Types/PagamentoMensileFornitoriType.cs`

#### Task 3.2: Aggiornare MonthlyClosuresMutations
**File**: `GraphQL/ChiusureMensili/MonthlyClosuresMutations.cs`

**Modifiche**:
- Sostituire logica inline con chiamate a `ChiusuraMensileService`
- Aggiungere mutation `aggiungiSpesaLibera`
- Aggiungere mutation `includiPagamentoFornitore`
- Aggiornare `mutazioneChiusuraMensile` per usare proprietà calcolate

#### Task 3.3: Aggiornare MonthlyClosuresQueries
**File**: `GraphQL/ChiusureMensili/MonthlyClosuresQueries.cs`

**Modifiche**:
- Includere nuove navigation properties: `RegistriInclusi`, `SpeseLibere`, `PagamentiInclusi`
- Esporre proprietà calcolate in ChiusuraMensileType

---

### ⚙️ FASE 4: Dependency Injection e Setup

#### Task 4.1: Registrare Service in Program.cs
**File**: `Program.cs`

```csharp
// Aggiungere dopo la registrazione di altri servizi
builder.Services.AddScoped<ChiusuraMensileService>();
builder.Services.AddScoped<MigrazioneChiusureMensiliService>();
```

---

### ✅ FASE 5: Testing e Validazione

#### Task 5.1: Test Creazione Chiusura
**Scenari**:
- ✅ Creazione chiusura con tutti i registri del mese
- ❌ Errore se mancano giorni
- ❌ Errore se chiusura per mese già esistente
- ✅ Associazione automatica pagamenti fornitori

#### Task 5.2: Test Proprietà Calcolate
**Scenari**:
- Modifica importo in RegistroCassa → RicavoTotaleCalcolato si aggiorna
- Aggiunta SpesaMensileLibera → SpeseAggiuntiveCalcolate si aggiorna
- Confronto valori denormalizzati vs calcolati (post-migrazione)

#### Task 5.3: Test Integrità Referenziale
**Scenari**:
- ❌ Tentativo eliminazione RegistroCassa incluso in chiusura CHIUSA → DbUpdateException
- ❌ Tentativo eliminazione PagamentoFornitore incluso in chiusura → DbUpdateException
- ✅ Eliminazione SpesaMensileLibera se chiusura in stato BOZZA

---

## Checklist Implementazione

### Fase 1: Modelli ✅
- [ ] Task 1.1: Enum CategoriaSpesa
- [ ] Task 1.2: RegistroCassaMensile
- [ ] Task 1.3: SpesaMensileLibera
- [ ] Task 1.4: PagamentoMensileFornitori
- [ ] Task 1.5: Modificare ChiusuraMensile

### Fase 2: Persistenza ⏳
- [ ] Task 2.1: Aggiornare AppDbContext
- [ ] Task 2.2: Creare ChiusuraMensileService
- [ ] Task 2.3: Creare Migration
- [ ] Task 2.4: Service Migrazione Dati

### Fase 3: GraphQL ⏳
- [ ] Task 3.1: Aggiornare Types
- [ ] Task 3.2: Aggiornare Mutations
- [ ] Task 3.3: Aggiornare Queries

### Fase 4: Setup ⏳
- [ ] Task 4.1: Registrazione DI

### Fase 5: Testing ⏳
- [ ] Task 5.1: Test Creazione
- [ ] Task 5.2: Test Proprietà Calcolate
- [ ] Task 5.3: Test Integrità

---

## Rischi e Mitigazioni

### Rischio 1: Dati Esistenti Inconsistenti
**Mitigazione**: Script di validazione pre-migrazione per identificare anomalie

### Rischio 2: Performance Query con Proprietà Calcolate
**Mitigazione**: Creare vista materializzata opzionale per report aggregati

### Rischio 3: Rollback Complesso
**Mitigazione**: Mantenere tabella SpeseMensili fino a validazione completa (2-4 settimane)

---

## Stima Complessità

| Fase | Complessità | Tempo Stimato |
|------|-------------|---------------|
| Fase 1: Modelli | Media | 2-3 ore |
| Fase 2: Persistenza | Alta | 4-5 ore |
| Fase 3: GraphQL | Media | 2-3 ore |
| Fase 4: Setup | Bassa | 30 min |
| Fase 5: Testing | Alta | 3-4 ore |
| **TOTALE** | | **12-15 ore** |

---

## Note di Implementazione

- **Deployment**: Richiede downtime per esecuzione migrazione dati
- **Backward Compatibility**: Frontend deve gestire transizione graduale
- **Monitoring**: Tracciare differenze tra valori vecchi/nuovi per 1 mese
- **Cleanup**: Eliminare tabella SpeseMensili e campi denormalizzati dopo validazione

---

**Ultimo Aggiornamento**: 2026-02-03
**Stato**: In Corso - Fase 1
