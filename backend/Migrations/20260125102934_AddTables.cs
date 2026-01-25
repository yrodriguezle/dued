using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "BusinessSettings",
                columns: table => new
                {
                    SettingsId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    BusinessName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OpeningTime = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false, defaultValue: "09:00", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ClosingTime = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false, defaultValue: "18:00", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OperatingDays = table.Column<string>(type: "json", nullable: false, defaultValue: "[true,true,true,true,true,false,false]", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Timezone = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, defaultValue: "Europe/Rome", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Currency = table.Column<string>(type: "varchar(3)", maxLength: 3, nullable: false, defaultValue: "EUR", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    VatRate = table.Column<decimal>(type: "decimal(5,4)", nullable: false, defaultValue: 0.22m),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessSettings", x => x.SettingsId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "DenominazioniMoneta",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Valore = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Tipo = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OrdineVisualizzazione = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DenominazioniMoneta", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "Fornitori",
                columns: table => new
                {
                    FornitoreId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RagioneSociale = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PartitaIva = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CodiceFiscale = table.Column<string>(type: "varchar(16)", maxLength: 16, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Indirizzo = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Citta = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Cap = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Paese = table.Column<string>(type: "varchar(2)", maxLength: 2, nullable: false, defaultValue: "IT", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Email = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Telefono = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Attivo = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: true),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Fornitori", x => x.FornitoreId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "Menus",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Titolo = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Percorso = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Icona = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Visibile = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    Posizione = table.Column<int>(type: "int", nullable: false),
                    PercorsoFile = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NomeVista = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MenuPadreId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Menus", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Menus_Menus_MenuPadreId",
                        column: x => x.MenuPadreId,
                        principalTable: "Menus",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    ProductId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Code = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Price = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Category = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UnitOfMeasure = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true, defaultValue: "pz", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.ProductId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "Ruoli",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Nome = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Descrizione = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ruoli", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "FattureAcquisto",
                columns: table => new
                {
                    FatturaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    FornitoreId = table.Column<int>(type: "int", nullable: false),
                    NumeroFattura = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DataFattura = table.Column<DateTime>(type: "date", nullable: false),
                    DataScadenza = table.Column<DateTime>(type: "date", nullable: true),
                    Imponibile = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ImportoIva = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    TotaleConIva = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Stato = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "DA_PAGARE", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FattureAcquisto", x => x.FatturaId);
                    table.ForeignKey(
                        name: "FK_FattureAcquisto_Fornitori_FornitoreId",
                        column: x => x.FornitoreId,
                        principalTable: "Fornitori",
                        principalColumn: "FornitoreId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "RuoloMenu",
                columns: table => new
                {
                    MenuId = table.Column<int>(type: "int", nullable: false),
                    RuoloId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RuoloMenu", x => new { x.MenuId, x.RuoloId });
                    table.ForeignKey(
                        name: "FK_RuoloMenu_Menus_MenuId",
                        column: x => x.MenuId,
                        principalTable: "Menus",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RuoloMenu_Ruoli_RuoloId",
                        column: x => x.RuoloId,
                        principalTable: "Ruoli",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Utenti",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    NomeUtente = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Nome = table.Column<string>(type: "longtext", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Cognome = table.Column<string>(type: "longtext", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Descrizione = table.Column<string>(type: "longtext", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Disabilitato = table.Column<bool>(type: "tinyint(1)", nullable: true),
                    TokenAggiornamento = table.Column<string>(type: "longtext", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ScadenzaTokenAggiornamento = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    Hash = table.Column<byte[]>(type: "longblob", nullable: false),
                    Salt = table.Column<byte[]>(type: "longblob", nullable: false),
                    RuoloId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Utenti", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Utenti_Ruoli_RuoloId",
                        column: x => x.RuoloId,
                        principalTable: "Ruoli",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "DocumentiTrasporto",
                columns: table => new
                {
                    DdtId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    FatturaId = table.Column<int>(type: "int", nullable: true),
                    FornitoreId = table.Column<int>(type: "int", nullable: false),
                    NumeroDdt = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DataDdt = table.Column<DateTime>(type: "date", nullable: false),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentiTrasporto", x => x.DdtId);
                    table.ForeignKey(
                        name: "FK_DocumentiTrasporto_FattureAcquisto_FatturaId",
                        column: x => x.FatturaId,
                        principalTable: "FattureAcquisto",
                        principalColumn: "FatturaId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DocumentiTrasporto_Fornitori_FornitoreId",
                        column: x => x.FornitoreId,
                        principalTable: "Fornitori",
                        principalColumn: "FornitoreId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "ChiusureMensili",
                columns: table => new
                {
                    ChiusuraId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Anno = table.Column<int>(type: "int", nullable: false),
                    Mese = table.Column<int>(type: "int", nullable: false),
                    UltimoGiornoLavorativo = table.Column<DateTime>(type: "date", nullable: false),
                    RicavoTotale = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    TotaleContanti = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    TotaleElettronici = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    TotaleFatture = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    SpeseAggiuntive = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    RicavoNetto = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Stato = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "BOZZA", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ChiusaDa = table.Column<int>(type: "int", nullable: true),
                    ChiusaIl = table.Column<DateTime>(type: "datetime", nullable: true),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChiusureMensili", x => x.ChiusuraId);
                    table.ForeignKey(
                        name: "FK_ChiusureMensili_Utenti_ChiusaDa",
                        column: x => x.ChiusaDa,
                        principalTable: "Utenti",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "RegistriCassa",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Data = table.Column<DateTime>(type: "date", nullable: false),
                    UtenteId = table.Column<int>(type: "int", nullable: false),
                    TotaleApertura = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    TotaleChiusura = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    VenditeContanti = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    IncassoContanteTracciato = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    IncassiElettronici = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    IncassiFattura = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    TotaleVendite = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    SpeseFornitori = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    SpeseGiornaliere = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ContanteAtteso = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Differenza = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ContanteNetto = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ImportoIva = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Stato = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "DRAFT", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistriCassa", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegistriCassa_Utenti_UtenteId",
                        column: x => x.UtenteId,
                        principalTable: "Utenti",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "PagamentiFornitori",
                columns: table => new
                {
                    PagamentoId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    FatturaId = table.Column<int>(type: "int", nullable: true),
                    DdtId = table.Column<int>(type: "int", nullable: true),
                    DataPagamento = table.Column<DateTime>(type: "date", nullable: false),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    MetodoPagamento = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PagamentiFornitori", x => x.PagamentoId);
                    table.ForeignKey(
                        name: "FK_PagamentiFornitori_DocumentiTrasporto_DdtId",
                        column: x => x.DdtId,
                        principalTable: "DocumentiTrasporto",
                        principalColumn: "DdtId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PagamentiFornitori_FattureAcquisto_FatturaId",
                        column: x => x.FatturaId,
                        principalTable: "FattureAcquisto",
                        principalColumn: "FatturaId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "ConteggiMoneta",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RegistroCassaId = table.Column<int>(type: "int", nullable: false),
                    DenominazioneMonetaId = table.Column<int>(type: "int", nullable: false),
                    Quantita = table.Column<int>(type: "int", nullable: false),
                    Totale = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    IsApertura = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConteggiMoneta", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConteggiMoneta_DenominazioniMoneta_DenominazioneMonetaId",
                        column: x => x.DenominazioneMonetaId,
                        principalTable: "DenominazioniMoneta",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ConteggiMoneta_RegistriCassa_RegistroCassaId",
                        column: x => x.RegistroCassaId,
                        principalTable: "RegistriCassa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "IncassiCassa",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RegistroCassaId = table.Column<int>(type: "int", nullable: false),
                    Tipo = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IncassiCassa", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IncassiCassa_RegistriCassa_RegistroCassaId",
                        column: x => x.RegistroCassaId,
                        principalTable: "RegistriCassa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "Sales",
                columns: table => new
                {
                    SaleId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RegistroCassaId = table.Column<int>(type: "int", nullable: false),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    TotalPrice = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Timestamp = table.Column<DateTime>(type: "datetime", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales", x => x.SaleId);
                    table.ForeignKey(
                        name: "FK_Sales_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "ProductId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sales_RegistriCassa_RegistroCassaId",
                        column: x => x.RegistroCassaId,
                        principalTable: "RegistriCassa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "SpeseCassa",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RegistroCassaId = table.Column<int>(type: "int", nullable: false),
                    Descrizione = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpeseCassa", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SpeseCassa_RegistriCassa_RegistroCassaId",
                        column: x => x.RegistroCassaId,
                        principalTable: "RegistriCassa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "SpeseMensili",
                columns: table => new
                {
                    SpesaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ChiusuraId = table.Column<int>(type: "int", nullable: false),
                    PagamentoId = table.Column<int>(type: "int", nullable: true),
                    Descrizione = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Categoria = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpeseMensili", x => x.SpesaId);
                    table.ForeignKey(
                        name: "FK_SpeseMensili_ChiusureMensili_ChiusuraId",
                        column: x => x.ChiusuraId,
                        principalTable: "ChiusureMensili",
                        principalColumn: "ChiusuraId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SpeseMensili_PagamentiFornitori_PagamentoId",
                        column: x => x.PagamentoId,
                        principalTable: "PagamentiFornitori",
                        principalColumn: "PagamentoId",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_ChiusureMensili_Anno_Mese",
                table: "ChiusureMensili",
                columns: new[] { "Anno", "Mese" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChiusureMensili_ChiusaDa",
                table: "ChiusureMensili",
                column: "ChiusaDa");

            migrationBuilder.CreateIndex(
                name: "IX_ChiusureMensili_Stato",
                table: "ChiusureMensili",
                column: "Stato");

            migrationBuilder.CreateIndex(
                name: "IX_ConteggiMoneta_DenominazioneMonetaId",
                table: "ConteggiMoneta",
                column: "DenominazioneMonetaId");

            migrationBuilder.CreateIndex(
                name: "IX_ConteggiMoneta_RegistroCassaId",
                table: "ConteggiMoneta",
                column: "RegistroCassaId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentiTrasporto_DataDdt",
                table: "DocumentiTrasporto",
                column: "DataDdt");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentiTrasporto_FatturaId",
                table: "DocumentiTrasporto",
                column: "FatturaId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentiTrasporto_FornitoreId_NumeroDdt",
                table: "DocumentiTrasporto",
                columns: new[] { "FornitoreId", "NumeroDdt" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FattureAcquisto_DataFattura",
                table: "FattureAcquisto",
                column: "DataFattura");

            migrationBuilder.CreateIndex(
                name: "IX_FattureAcquisto_FornitoreId_NumeroFattura",
                table: "FattureAcquisto",
                columns: new[] { "FornitoreId", "NumeroFattura" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FattureAcquisto_Stato",
                table: "FattureAcquisto",
                column: "Stato");

            migrationBuilder.CreateIndex(
                name: "IX_Fornitori_Attivo",
                table: "Fornitori",
                column: "Attivo");

            migrationBuilder.CreateIndex(
                name: "IX_Fornitori_PartitaIva",
                table: "Fornitori",
                column: "PartitaIva",
                unique: true,
                filter: "[PartitaIva] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Fornitori_RagioneSociale",
                table: "Fornitori",
                column: "RagioneSociale");

            migrationBuilder.CreateIndex(
                name: "IX_IncassiCassa_RegistroCassaId",
                table: "IncassiCassa",
                column: "RegistroCassaId");

            migrationBuilder.CreateIndex(
                name: "IX_Menus_MenuPadreId",
                table: "Menus",
                column: "MenuPadreId");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiFornitori_DataPagamento",
                table: "PagamentiFornitori",
                column: "DataPagamento");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiFornitori_DdtId",
                table: "PagamentiFornitori",
                column: "DdtId");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiFornitori_FatturaId",
                table: "PagamentiFornitori",
                column: "FatturaId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Code",
                table: "Products",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegistriCassa_Data",
                table: "RegistriCassa",
                column: "Data",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegistriCassa_UtenteId",
                table: "RegistriCassa",
                column: "UtenteId");

            migrationBuilder.CreateIndex(
                name: "IX_RuoloMenu_RuoloId",
                table: "RuoloMenu",
                column: "RuoloId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ProductId",
                table: "Sales",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_RegistroCassaId",
                table: "Sales",
                column: "RegistroCassaId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Timestamp",
                table: "Sales",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseCassa_RegistroCassaId",
                table: "SpeseCassa",
                column: "RegistroCassaId");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensili_Categoria",
                table: "SpeseMensili",
                column: "Categoria");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensili_ChiusuraId",
                table: "SpeseMensili",
                column: "ChiusuraId");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensili_PagamentoId",
                table: "SpeseMensili",
                column: "PagamentoId");

            migrationBuilder.CreateIndex(
                name: "IX_Utenti_RuoloId",
                table: "Utenti",
                column: "RuoloId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BusinessSettings");

            migrationBuilder.DropTable(
                name: "ConteggiMoneta");

            migrationBuilder.DropTable(
                name: "IncassiCassa");

            migrationBuilder.DropTable(
                name: "RuoloMenu");

            migrationBuilder.DropTable(
                name: "Sales");

            migrationBuilder.DropTable(
                name: "SpeseCassa");

            migrationBuilder.DropTable(
                name: "SpeseMensili");

            migrationBuilder.DropTable(
                name: "DenominazioniMoneta");

            migrationBuilder.DropTable(
                name: "Menus");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "RegistriCassa");

            migrationBuilder.DropTable(
                name: "ChiusureMensili");

            migrationBuilder.DropTable(
                name: "PagamentiFornitori");

            migrationBuilder.DropTable(
                name: "Utenti");

            migrationBuilder.DropTable(
                name: "DocumentiTrasporto");

            migrationBuilder.DropTable(
                name: "Ruoli");

            migrationBuilder.DropTable(
                name: "FattureAcquisto");

            migrationBuilder.DropTable(
                name: "Fornitori");
        }
    }
}
