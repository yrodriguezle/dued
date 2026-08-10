import { DiagramCaption, DiagramEdge, DiagramFrame, DiagramNode } from "./DiagramPrimitives";

/**
 * Diagramma 4 — gli stati.
 * Due macchine a stati parallele, una per il giorno e una per il mese. Gli stati
 * tratteggiati esistono nel modello ma nessuna operazione li assegna: sono
 * riservati, e il codice li legge soltanto per bloccare le modifiche.
 */
function DiagrammaStati() {
  return (
    <DiagramFrame
      titolo="Diagramma 4 — Gli stati e chi li fa cambiare"
      didascalia="Lo stato è l'unico lucchetto del sistema: da CLOSED in poi il giorno non si tocca più senza un amministratore."
      viewBoxWidth={760}
      viewBoxHeight={320}
      minWidth={620}
    >
      <DiagramCaption
        x={20}
        y={28}
        text="Registro cassa — la giornata"
      />
      <DiagramNode
        x={40}
        y={48}
        width={140}
        height={48}
        title="DRAFT"
      />
      <DiagramNode
        tone="root"
        x={300}
        y={48}
        width={140}
        height={48}
        title="CLOSED"
      />
      <DiagramNode
        tone="external"
        x={560}
        y={48}
        width={140}
        height={48}
        title="RECONCILED"
      />
      <DiagramEdge
        points={[
          [180, 72],
          [300, 72],
        ]}
        label="chiudiRegistroCassa"
        labelAt={[240, 64]}
      />
      <DiagramEdge
        dashed
        points={[
          [440, 72],
          [560, 72],
        ]}
        label="non implementata"
        labelAt={[500, 64]}
      />
      <DiagramEdge
        points={[
          [340, 96],
          [340, 132],
          [110, 132],
          [110, 96],
        ]}
        label="riapriRegistroCassa · solo amministratori"
        labelAt={[225, 148]}
      />

      <DiagramCaption
        x={20}
        y={198}
        text="Chiusura mensile — il mese"
      />
      <DiagramNode
        x={40}
        y={218}
        width={140}
        height={48}
        title="BOZZA"
      />
      <DiagramNode
        tone="root"
        x={300}
        y={218}
        width={140}
        height={48}
        title="CHIUSA"
      />
      <DiagramNode
        tone="external"
        x={560}
        y={218}
        width={140}
        height={48}
        title="RICONCILIATA"
      />
      <DiagramEdge
        points={[
          [180, 242],
          [300, 242],
        ]}
        label="chiudiMensile"
        labelAt={[240, 234]}
      />
      <DiagramEdge
        dashed
        points={[
          [440, 242],
          [560, 242],
        ]}
        label="non implementata"
        labelAt={[500, 234]}
      />

      <DiagramCaption
        x={20}
        y={302}
        text="Tratteggiato: stato previsto dal modello che nessuna operazione assegna. Il codice lo legge solo per bloccare le modifiche."
      />
    </DiagramFrame>
  );
}

export default DiagrammaStati;
