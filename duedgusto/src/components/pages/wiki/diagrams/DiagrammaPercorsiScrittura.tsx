import { DiagramCaption, DiagramEdge, DiagramFrame, DiagramJunction, DiagramNode } from "./DiagramPrimitives";

/**
 * Diagramma 3 — i percorsi di scrittura.
 * Tre mutation diverse possono toccare lo stesso giorno; tutte e tre finiscono
 * nello stesso punto di calcolo, ed è questo che tiene la quadratura coerente.
 */
function DiagrammaPercorsiScrittura() {
  return (
    <DiagramFrame
      titolo="Diagramma 3 — Chi scrive sul registro, e dove finisce ogni scrittura"
      didascalia="Le formule di quadratura vivono in un metodo solo: chiunque tocchi spese o pagamenti ci ripassa."
      viewBoxWidth={1090}
      viewBoxHeight={460}
      minWidth={880}
    >
      {/* Le mutation GraphQL che entrano nel dominio */}
      <DiagramNode
        tone="external"
        x={40}
        y={40}
        width={230}
        height={58}
        title="mutateRegistroCassa"
        subtitle="salvataggio della giornata"
      />
      <DiagramNode
        tone="external"
        x={300}
        y={40}
        width={230}
        height={58}
        title="mutateSpesaCassa"
        subtitle="griglia spese della chiusura"
      />
      <DiagramNode
        tone="external"
        x={560}
        y={40}
        width={230}
        height={58}
        title="mutatePagamentoFornitore"
        subtitle="pagina fatture e DDT"
      />
      <DiagramNode
        tone="external"
        x={820}
        y={40}
        width={230}
        height={58}
        title="chiudi / riapriRegistroCassa"
        subtitle="solo cambio di stato"
      />

      {/* Gli orchestrator che le eseguono */}
      <DiagramNode
        tone="service"
        x={40}
        y={150}
        width={230}
        height={104}
        title="MutateRegistroCassa"
        subtitle="Orchestrator · GestioneCassa"
        lines={["Sostituisce in blocco conteggi,", "spese e pagamenti del giorno"]}
      />
      <DiagramNode
        tone="service"
        x={300}
        y={150}
        width={230}
        height={104}
        title="MutateSpesaCassa"
        subtitle="Orchestrator · GestioneCassa"
        lines={["Una riga per volta, sul giorno", "scelto: crea il registro se manca"]}
      />
      <DiagramNode
        tone="service"
        x={560}
        y={150}
        width={230}
        height={104}
        title="RegistroCassaSync"
        subtitle="Service · Services/Fornitori"
        lines={["Riallinea SpeseFornitori quando il", "pagamento nasce fuori dalla cassa"]}
      />
      <DiagramNode
        tone="service"
        x={820}
        y={150}
        width={230}
        height={104}
        title="Chiudi / Riapri"
        subtitle="Orchestrator · GestioneCassa"
        lines={["Toccano solo Stato: nessun", "totale viene ricalcolato"]}
      />

      {/* Mutation → orchestrator */}
      <DiagramEdge
        points={[
          [155, 98],
          [155, 150],
        ]}
      />
      <DiagramEdge
        points={[
          [415, 98],
          [415, 150],
        ]}
      />
      <DiagramEdge
        points={[
          [675, 98],
          [675, 150],
        ]}
      />
      <DiagramEdge
        points={[
          [935, 98],
          [935, 150],
        ]}
      />

      {/* Il collettore verso la fonte unica della quadratura */}
      <DiagramCaption
        x={168}
        y={288}
        text="ogni scrittura sui soldi passa da qui"
      />
      <DiagramEdge
        arrow={false}
        points={[
          [155, 254],
          [155, 300],
        ]}
      />
      <DiagramEdge
        arrow={false}
        points={[
          [415, 254],
          [415, 300],
        ]}
      />
      <DiagramEdge
        arrow={false}
        points={[
          [675, 254],
          [675, 300],
        ]}
      />
      <DiagramEdge
        arrow={false}
        points={[
          [155, 300],
          [675, 300],
        ]}
      />
      <DiagramJunction
        x={155}
        y={300}
      />
      <DiagramJunction
        x={415}
        y={300}
      />
      <DiagramJunction
        x={675}
        y={300}
      />
      <DiagramEdge
        points={[
          [450, 300],
          [450, 330],
        ]}
      />

      <DiagramNode
        tone="root"
        x={300}
        y={330}
        width={300}
        height={96}
        title="CalcolaTotali"
        subtitle="MutateRegistroCassaOrchestrator"
        lines={["Fonte UNICA delle quattro formule", "ContanteNetto · RestoFornitore · Ecc · Resto"]}
      />
      <DiagramNode
        tone="derived"
        x={660}
        y={330}
        width={280}
        height={96}
        title="BreakdownIvaApplier"
        subtitle="GraphQL/GestioneCassa"
        lines={["Punto di calcolo unico dell'IVA", "Riscrive TotaleVendite e le righe IVA"]}
      />
      <DiagramEdge
        points={[
          [600, 378],
          [660, 378],
        ]}
        label="poi"
        labelAt={[630, 370]}
      />
    </DiagramFrame>
  );
}

export default DiagrammaPercorsiScrittura;
