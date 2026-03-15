using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RinominaMenuFornitori : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Aggiorna Lista Fornitori: percorso, nomeVista, percorsoFile
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/fornitori-list',
                    `NomeVista` = 'FornitoreList',
                    `PercorsoFile` = 'fornitori/FornitoreList.tsx'
                WHERE `Percorso` = '/gestionale/suppliers-list';
            ");

            // Aggiorna Gestione Fornitori: percorso, nomeVista, percorsoFile
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/fornitori-details',
                    `NomeVista` = 'FornitoreDetails',
                    `PercorsoFile` = 'fornitori/FornitoreDetails.tsx'
                WHERE `Percorso` = '/gestionale/suppliers-details';
            ");

            // Aggiorna Fatture Acquisto: percorso, nomeVista, percorsoFile
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/fatture-acquisto-list',
                    `NomeVista` = 'FatturaAcquistoList',
                    `PercorsoFile` = 'fattureAcquisto/FatturaAcquistoList.tsx'
                WHERE `Percorso` = '/gestionale/purchase-invoices-list';
            ");

            // Aggiorna Gestione Fatture Acquisto: percorso, nomeVista, percorsoFile
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/fatture-acquisto-details',
                    `NomeVista` = 'FatturaAcquistoDetails',
                    `PercorsoFile` = 'fattureAcquisto/FatturaAcquistoDetails.tsx'
                WHERE `Percorso` = '/gestionale/purchase-invoices-details';
            ");

            // Aggiorna DDT: percorso, nomeVista, percorsoFile
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/documenti-trasporto-list',
                    `NomeVista` = 'DocumentoTrasportoList',
                    `PercorsoFile` = 'documentiTrasporto/DocumentoTrasportoList.tsx'
                WHERE `Percorso` = '/gestionale/delivery-notes-list';
            ");

            // Aggiorna Gestione DDT: percorso, nomeVista, percorsoFile
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/documenti-trasporto-details',
                    `NomeVista` = 'DocumentoTrasportoDetails',
                    `PercorsoFile` = 'documentiTrasporto/DocumentoTrasportoDetails.tsx'
                WHERE `Percorso` = '/gestionale/delivery-notes-details';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Ripristina Lista Fornitori
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/suppliers-list',
                    `NomeVista` = 'SupplierList',
                    `PercorsoFile` = 'suppliers/SupplierList.tsx'
                WHERE `Percorso` = '/gestionale/fornitori-list';
            ");

            // Ripristina Gestione Fornitori
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/suppliers-details',
                    `NomeVista` = 'SupplierDetails',
                    `PercorsoFile` = 'suppliers/SupplierDetails.tsx'
                WHERE `Percorso` = '/gestionale/fornitori-details';
            ");

            // Ripristina Fatture Acquisto
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/purchase-invoices-list',
                    `NomeVista` = 'PurchaseInvoiceList',
                    `PercorsoFile` = 'purchases/PurchaseInvoiceList.tsx'
                WHERE `Percorso` = '/gestionale/fatture-acquisto-list';
            ");

            // Ripristina Gestione Fatture Acquisto
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/purchase-invoices-details',
                    `NomeVista` = 'PurchaseInvoiceDetails',
                    `PercorsoFile` = 'purchases/PurchaseInvoiceDetails.tsx'
                WHERE `Percorso` = '/gestionale/fatture-acquisto-details';
            ");

            // Ripristina DDT
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/delivery-notes-list',
                    `NomeVista` = 'DeliveryNoteList',
                    `PercorsoFile` = 'deliveryNotes/DeliveryNoteList.tsx'
                WHERE `Percorso` = '/gestionale/documenti-trasporto-list';
            ");

            // Ripristina Gestione DDT
            migrationBuilder.Sql(@"
                UPDATE `Menus`
                SET `Percorso` = '/gestionale/delivery-notes-details',
                    `NomeVista` = 'DeliveryNoteDetails',
                    `PercorsoFile` = 'deliveryNotes/DeliveryNoteDetails.tsx'
                WHERE `Percorso` = '/gestionale/documenti-trasporto-details';
            ");
        }
    }
}
