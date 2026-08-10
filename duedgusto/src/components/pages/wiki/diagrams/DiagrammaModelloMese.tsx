import { DiagramEdge, DiagramFrame, DiagramNode } from "./DiagramPrimitives";

/**
 * Diagramma 2 — il mese.
 * ChiusuraMensile non contiene numeri: contiene un elenco di registri. I totali
 * sono proprietà calcolate a runtime su quell'elenco.
 */
function DiagrammaModelloMese() {
  return (
    <DiagramFrame
      titolo="Diagramma 2 — Il mese: ChiusuraMensile e chi la governa"
      didascalia="La chiusura non copia i numeri dei giorni: tiene i riferimenti e somma al momento della lettura."
      viewBoxWidth={1000}
      viewBoxHeight={500}
      minWidth={820}
    >
      {/* Colonna dei servizi */}
      <DiagramNode
        tone="service"
        x={40}
        y={40}
        width={280}
        height={132}
        title="ChiusuraMensileService"
        subtitle="Services/ChiusureMensili"
        lines={["SincronizzaRegistriBozza: la BOZZA si", "riallinea al mese a ogni lettura", "ChiudiMensile: BOZZA → CHIUSA,", "da lì in poi i link restano congelati"]}
      />
      <DiagramNode
        tone="service"
        x={40}
        y={210}
        width={280}
        height={104}
        title="ChiusuraMensileValidator"
        subtitle="Services/ChiusureMensili"
        lines={["Elenca i giorni operativi senza registro", "CLOSED: se ce ne sono, niente chiusura"]}
      />
      <DiagramNode
        tone="external"
        x={40}
        y={352}
        width={280}
        height={104}
        title="Giorni operativi"
        subtitle="PeriodiProgrammazione, BusinessSettings"
        lines={["GiorniNonLavorativi: le eccezioni,", "ricorrenti e una tantum"]}
      />

      {/* Colonna delle entità */}
      <DiagramNode
        tone="root"
        x={400}
        y={40}
        width={260}
        height={132}
        title="ChiusuraMensile"
        subtitle="ChiusureMensili"
        lines={["Anno + Mese, uno solo per mese", "Stato: BOZZA / CHIUSA / RICONCILIATA", "GiorniEsclusi: JSON", "Tutti i totali sono [NotMapped]"]}
      />
      <DiagramNode
        tone="join"
        x={400}
        y={230}
        width={260}
        height={104}
        title="RegistroCassaMensile"
        subtitle="RegistriCassaMensili"
        lines={["Chiave: ChiusuraId + RegistroId", "Incluso: esclude senza sciogliere il link"]}
      />
      <DiagramNode
        x={400}
        y={400}
        width={260}
        height={58}
        title="RegistroCassa"
        subtitle="RegistriCassa"
      />

      {/* Colonna di contorno */}
      <DiagramNode
        tone="external"
        x={720}
        y={60}
        width={240}
        height={104}
        title="GiornoEscluso"
        subtitle="JSON, non è una tabella"
        lines={["Data, CodiceMotivo, Note", "Giustifica un giorno senza registro"]}
      />
      <DiagramNode
        tone="service"
        x={720}
        y={250}
        width={240}
        height={132}
        title="GestioneCassaGuards"
        subtitle="GraphQL/GestioneCassa"
        lines={["GuardMeseChiuso", "GuardGiornoOperativoConPeriodi", "GuardUtenteAmministratore"]}
      />

      {/* Relazioni */}
      <DiagramEdge
        points={[
          [320, 106],
          [400, 106],
        ]}
        label="crea, chiude"
        labelAt={[360, 98]}
      />
      <DiagramEdge
        points={[
          [320, 140],
          [370, 140],
          [370, 282],
          [400, 282],
        ]}
        label="sincronizza"
        labelAt={[376, 194]}
        labelAnchor="start"
      />
      <DiagramEdge
        points={[
          [180, 172],
          [180, 210],
        ]}
        label="delega"
        labelAt={[196, 196]}
        labelAnchor="start"
      />
      <DiagramEdge
        points={[
          [320, 262],
          [340, 262],
          [340, 429],
          [400, 429],
        ]}
        label="quali giorni sono scoperti"
        labelAt={[346, 362]}
        labelAnchor="start"
      />
      <DiagramEdge
        muted
        points={[
          [180, 352],
          [180, 314],
        ]}
        label="definiscono i giorni operativi"
        labelAt={[196, 338]}
        labelAnchor="start"
      />
      <DiagramEdge
        points={[
          [530, 172],
          [530, 230],
        ]}
        label="1 → N"
        labelAt={[546, 206]}
        labelAnchor="start"
      />
      <DiagramEdge
        points={[
          [530, 334],
          [530, 400],
        ]}
        label="N → 1"
        labelAt={[546, 372]}
        labelAnchor="start"
      />
      <DiagramEdge
        muted
        points={[
          [720, 112],
          [660, 112],
        ]}
      />
      <DiagramEdge
        dashed
        points={[
          [660, 150],
          [690, 150],
          [690, 316],
          [720, 316],
        ]}
        label="stato del mese"
        labelAt={[696, 240]}
        labelAnchor="start"
      />
      <DiagramEdge
        points={[
          [840, 382],
          [840, 429],
          [660, 429],
        ]}
        label="blocca le scritture sul mese chiuso"
        labelAt={[750, 450]}
      />
    </DiagramFrame>
  );
}

export default DiagrammaModelloMese;
