import { DiagramEdge, DiagramFrame, DiagramNode } from "./DiagramPrimitives";

/**
 * Diagramma 1 — il giorno.
 * RegistroCassa al centro con le quattro collezioni che gli appartengono, il
 * breakdown IVA derivato e le tabelle di lookup a cui ciascuna collezione punta.
 */
function DiagrammaModelloGiorno() {
  return (
    <DiagramFrame
      titolo="Diagramma 1 — Il giorno: RegistroCassa e ciò che gli appartiene"
      didascalia="Una riga di RegistriCassa per ogni giornata. Tutto il resto pende da lì."
      viewBoxWidth={1120}
      viewBoxHeight={640}
      minWidth={860}
    >
      {/* Aggregate root */}
      <DiagramNode
        tone="root"
        x={420}
        y={40}
        width={240}
        height={132}
        title="RegistroCassa"
        subtitle="RegistriCassa"
        lines={["Data — una riga per giornata", "Stato: DRAFT / CLOSED / RECONCILED", "TotaleApertura, TotaleChiusura", "ContanteNetto, RestoFornitore, Ecc, Resto"]}
      />

      {/* Breakdown IVA: derivato, mai scritto a mano */}
      <DiagramNode
        tone="derived"
        x={760}
        y={40}
        width={240}
        height={112}
        title="RegistroCassaIva"
        subtitle="RegistriCassaIva"
        lines={["Aliquota, Imponibile, Imposta", "Stimato = riga del residuo", "Cancellata e riscritta a ogni calcolo"]}
      />
      <DiagramEdge
        points={[
          [660, 96],
          [760, 96],
        ]}
        label="1 → N"
        labelAt={[710, 88]}
      />

      {/* Le quattro collezioni */}
      <DiagramNode
        x={80}
        y={280}
        width={200}
        height={104}
        title="ConteggioMoneta"
        subtitle="ConteggiMoneta"
        lines={["Quantita × Valore = Totale", "IsApertura: apertura o chiusura"]}
      />
      <DiagramNode
        x={320}
        y={280}
        width={200}
        height={104}
        title="SpesaCassa"
        subtitle="SpeseCassa"
        lines={["Spesa NON tracciata (contanti)", "Descrizione, Importo, Note"]}
      />
      <DiagramNode
        x={560}
        y={280}
        width={200}
        height={104}
        title="PagamentoFornitore"
        subtitle="PagamentiFornitori"
        lines={["Spesa TRACCIATA", "Importo, MetodoPagamento, Note"]}
      />
      <DiagramNode
        x={800}
        y={280}
        width={200}
        height={104}
        title="Vendita"
        subtitle="Vendite"
        lines={["Riga di vendita itemizzata", "AliquotaIva, Imponibile, ImportoIva"]}
      />

      {/* Fan-out dal root: due binari a quote diverse per non incrociarsi */}
      <DiagramEdge
        points={[
          [450, 172],
          [450, 214],
          [180, 214],
          [180, 280],
        ]}
        label="1 → N"
        labelAt={[196, 268]}
        labelAnchor="start"
      />
      <DiagramEdge
        points={[
          [490, 172],
          [490, 246],
          [420, 246],
          [420, 280],
        ]}
        label="1 → N"
        labelAt={[436, 268]}
        labelAnchor="start"
      />
      <DiagramEdge
        points={[
          [590, 172],
          [590, 246],
          [660, 246],
          [660, 280],
        ]}
        label="1 → N"
        labelAt={[676, 268]}
        labelAnchor="start"
      />
      <DiagramEdge
        points={[
          [630, 172],
          [630, 214],
          [900, 214],
          [900, 280],
        ]}
        label="1 → N"
        labelAt={[916, 268]}
        labelAnchor="start"
      />

      {/* Le vendite alimentano le righe esatte del breakdown IVA */}
      <DiagramEdge
        dashed
        points={[
          [1000, 320],
          [1060, 320],
          [1060, 96],
          [1000, 96],
        ]}
        label="alimenta"
        labelAt={[1052, 202]}
        labelAnchor="end"
      />

      {/* Lookup e contorno */}
      <DiagramNode
        tone="external"
        x={80}
        y={440}
        width={200}
        height={78}
        title="DenominazioneMoneta"
        subtitle="DenominazioniMoneta"
        lines={["Valore, Tipo: COIN o BANKNOTE"]}
      />
      <DiagramNode
        tone="external"
        x={320}
        y={440}
        width={200}
        height={78}
        title="CategoriaSpesa"
        subtitle="enum — non è una tabella"
        lines={["Affitto · Utenze · Stipendi · Altro"]}
      />
      <DiagramNode
        tone="external"
        x={560}
        y={440}
        width={200}
        height={78}
        title="FatturaAcquisto / DDT"
        subtitle="FattureAcquisto, DocumentiTrasporto"
        lines={["Il documento che giustifica la spesa"]}
      />
      <DiagramNode
        tone="external"
        x={800}
        y={440}
        width={200}
        height={78}
        title="Prodotto"
        subtitle="Prodotti"
        lines={["AliquotaIva copiata sulla vendita"]}
      />
      <DiagramNode
        tone="external"
        x={560}
        y={560}
        width={200}
        height={58}
        title="Fornitore"
        subtitle="Fornitori"
      />

      <DiagramEdge
        muted
        points={[
          [180, 384],
          [180, 440],
        ]}
        label="N → 1"
        labelAt={[196, 418]}
        labelAnchor="start"
      />
      <DiagramEdge
        muted
        points={[
          [420, 384],
          [420, 440],
        ]}
        label="Categoria"
        labelAt={[436, 418]}
        labelAnchor="start"
      />
      <DiagramEdge
        muted
        points={[
          [660, 384],
          [660, 440],
        ]}
        label="N → 1"
        labelAt={[676, 418]}
        labelAnchor="start"
      />
      <DiagramEdge
        muted
        points={[
          [900, 384],
          [900, 440],
        ]}
        label="N → 1"
        labelAt={[916, 418]}
        labelAnchor="start"
      />
      <DiagramEdge
        muted
        points={[
          [660, 518],
          [660, 560],
        ]}
        label="N → 1"
        labelAt={[676, 545]}
        labelAnchor="start"
      />
    </DiagramFrame>
  );
}

export default DiagrammaModelloGiorno;
