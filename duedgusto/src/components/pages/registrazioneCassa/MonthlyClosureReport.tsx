import React from "react";
import PrintIcon from "@mui/icons-material/Print";
import dayjs from "dayjs";
import FormikToolbarButton from "../../common/form/toolbar/FormikToolbarButton";

interface MonthlyClosureReportProps {
  closure: ChiusuraMensile;
}

const MOTIVO_LABELS_REPORT: Record<string, string> = {
  ATTIVITA_NON_AVVIATA: "Attività non avviata",
  CHIUSURA_PROGRAMMATA: "Chiusura programmata",
  EVENTO_ECCEZIONALE: "Evento eccezionale",
};

const MonthlyClosureReport: React.FC<MonthlyClosureReportProps> = ({ closure }) => {
  const giorniEsclusiParsed: GiornoEscluso[] = (() => {
    if (!closure.giorniEsclusi) return [];
    try {
      return JSON.parse(closure.giorniEsclusi) as GiornoEscluso[];
    } catch {
      return [];
    }
  })();

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const monthName = dayjs()
      .month(closure.mese - 1)
      .format("MMMM")
      .toUpperCase();

    printWindow.document.write(`
            <html>
            <head>
                <title>Report Chiusura Mensile - ${monthName} ${closure.anno}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h1 { text-align: center; margin-bottom: 5px; }
                    h2 { border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 25px; }
                    .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; font-weight: bold; }
                    .text-right { text-align: right; }
                    .summary-row { background-color: #f9f9f9; font-weight: bold; }
                    .total-row { background-color: #e8e8e8; font-weight: bold; font-size: 1.1em; }
                    .negative { color: #d32f2f; }
                    .footer { margin-top: 30px; text-align: center; color: #999; font-size: 0.8em; border-top: 1px solid #ddd; padding-top: 10px; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <h1>REPORT CHIUSURA MENSILE</h1>
                <p class="subtitle">${monthName} ${closure.anno} - Stato: ${closure.stato}</p>

                <h2>Riepilogo Entrate</h2>
                <table>
                    <tr><td>Totale Lordo (Entrate)</td><td class="text-right">€ ${closure.totaleLordoCalcolato.toFixed(2)}</td></tr>
                    <tr><td style="padding-left: 20px;">di cui Imponibile</td><td class="text-right">€ ${closure.totaleImponibileCalcolato.toFixed(2)}</td></tr>
                    <tr><td style="padding-left: 20px;">di cui IVA</td><td class="text-right">€ ${closure.totaleIvaCalcolato.toFixed(2)}</td></tr>
                    <tr><td>Pago in Contanti</td><td class="text-right">€ ${closure.totaleContantiCalcolato.toFixed(2)}</td></tr>
                    <tr><td>Pagamenti Elettronici</td><td class="text-right">€ ${closure.totaleElettroniciCalcolato.toFixed(2)}</td></tr>
                    <tr><td>Pagamenti con Fattura</td><td class="text-right">€ ${closure.totaleFattureCalcolato.toFixed(2)}</td></tr>
                </table>

                <h2>Registri Giornalieri (${closure.registriInclusi.length})</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th class="text-right">Vendite</th>
                            <th class="text-right">Contanti</th>
                            <th class="text-right">Elettronici</th>
                            <th class="text-right">Fattura</th>
                            <th class="text-right">Differenza</th>
                            <th>Stato</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${closure.registriInclusi
                          .map(
                            (ri) => `
                            <tr>
                                <td>${dayjs(ri.registro.data).format("DD/MM/YYYY")}</td>
                                <td class="text-right">€ ${(ri.registro.totaleVendite ?? 0).toFixed(2)}</td>
                                <td class="text-right">€ ${(ri.registro.incassoContanteTracciato ?? 0).toFixed(2)}</td>
                                <td class="text-right">€ ${(ri.registro.incassiElettronici ?? 0).toFixed(2)}</td>
                                <td class="text-right">€ ${(ri.registro.incassiFattura ?? 0).toFixed(2)}</td>
                                <td class="text-right ${(ri.registro as { differenza?: number }).differenza !== 0 ? "negative" : ""}"}>€ ${((ri.registro as { differenza?: number }).differenza ?? 0).toFixed(2)}</td>
                                <td>${ri.registro.stato}</td>
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>

                ${
                  closure.speseLibere.length > 0
                    ? `
                    <h2>Spese Mensili</h2>
                    <table>
                        <thead>
                            <tr><th>Categoria</th><th>Descrizione</th><th class="text-right">Importo</th></tr>
                        </thead>
                        <tbody>
                            ${closure.speseLibere
                              .map(
                                (s) => `
                                <tr><td>${s.categoria}</td><td>${s.descrizione}</td><td class="text-right">€ ${s.importo.toFixed(2)}</td></tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                `
                    : ""
                }

                ${
                  closure.pagamentiInclusi.length > 0
                    ? `
                    <h2>Pagamenti Fornitori</h2>
                    <table>
                        <thead>
                            <tr><th>Data</th><th class="text-right">Importo</th><th>Metodo</th><th>Note</th></tr>
                        </thead>
                        <tbody>
                            ${closure.pagamentiInclusi
                              .map(
                                (p) => `
                                <tr>
                                    <td>${dayjs(p.pagamento.dataPagamento).format("DD/MM/YYYY")}</td>
                                    <td class="text-right">€ ${p.pagamento.importo.toFixed(2)}</td>
                                    <td>${p.pagamento.metodoPagamento || "-"}</td>
                                    <td>${p.pagamento.note || "-"}</td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                `
                    : ""
                }

                ${
                  giorniEsclusiParsed.length > 0
                    ? `
                    <h2>Giorni Esclusi dalla Chiusura</h2>
                    <table>
                        <thead>
                            <tr><th>Data</th><th>Motivo</th><th>Note</th><th>Data Esclusione</th></tr>
                        </thead>
                        <tbody>
                            ${giorniEsclusiParsed
                              .map(
                                (ge) => `
                                <tr>
                                    <td>${dayjs(ge.data).format("DD/MM/YYYY")}</td>
                                    <td>${MOTIVO_LABELS_REPORT[ge.codiceMotivo] || ge.codiceMotivo}</td>
                                    <td>${ge.note || "-"}</td>
                                    <td>${dayjs(ge.dataEsclusione).format("DD/MM/YYYY HH:mm")}</td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                    <p>Totale giorni esclusi: ${giorniEsclusiParsed.length}</p>
                `
                    : ""
                }

                <h2>Riepilogo Finale</h2>
                <table>
                    <tr><td>Totale Entrate (Lordo)</td><td class="text-right">€ ${closure.totaleLordoCalcolato.toFixed(2)}</td></tr>
                    <tr><td>Totale IVA</td><td class="text-right">€ ${closure.totaleIvaCalcolato.toFixed(2)}</td></tr>
                    <tr><td>Totale Spese</td><td class="text-right negative">€ ${closure.speseAggiuntiveCalcolate.toFixed(2)}</td></tr>
                    ${
                      closure.totaleDifferenzeCassaCalcolato !== 0
                        ? `
                        <tr><td>Differenze di Cassa</td><td class="text-right ${closure.totaleDifferenzeCassaCalcolato < 0 ? "negative" : ""}">€ ${closure.totaleDifferenzeCassaCalcolato.toFixed(2)}</td></tr>
                    `
                        : ""
                    }
                    <tr class="total-row"><td>RICAVO NETTO MENSILE</td><td class="text-right">€ ${closure.ricavoNettoCalcolato.toFixed(2)}</td></tr>
                    <tr><td>Registri chiusi</td><td class="text-right">${closure.registriInclusi.length}</td></tr>
                </table>

                <div class="footer">
                    Report generato il ${dayjs().format("DD/MM/YYYY HH:mm")}
                    ${closure.chiusaDaUtente ? ` | Chiusura effettuata da ${closure.chiusaDaUtente.nomeUtente} il ${dayjs(closure.chiusaIl).format("DD/MM/YYYY HH:mm")}` : ""}
                </div>
            </body>
            </html>
        `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <FormikToolbarButton startIcon={<PrintIcon />} onClick={handlePrint}>
      Stampa Report
    </FormikToolbarButton>
  );
};

export default MonthlyClosureReport;
