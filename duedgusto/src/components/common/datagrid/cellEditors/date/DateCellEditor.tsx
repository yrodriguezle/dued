import { useEffect, useRef, useState } from "react";
import type { CustomCellEditorProps } from "ag-grid-react";
import toDateInputValue from "./toDateInputValue";

/**
 * Editor di data basato su <input type="date">, in sostituzione di
 * `agDateStringCellEditor`.
 *
 * Quello di serie lascia il focus sul contenitore della cella invece che
 * sull'input interno. Ne derivano i due sintomi osservati:
 * - all'apertura nessun segmento e attivo, quindi non si puo digitare il giorno;
 * - il primo Tab *entra* nell'input, i successivi camminano fra i segmenti
 *   (giorno, mese, anno) e l'ultimo porta il focus fuori dalla griglia invece
 *   che alla cella successiva.
 *
 * Qui il focus va esplicitamente sull'input (il browser attiva il primo
 * segmento, il giorno con locale italiano) e il Tab viene neutralizzato solo
 * nella sua azione di default: l'evento continua a risalire, cosi AG Grid
 * gestisce lo spostamento di cella e resta valido l'auto-inserimento di riga
 * sull'ultima cella editabile.
 */

function DateCellEditor({ value, onValueChange, eventKey }: CustomCellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string>(() => toDateInputValue(value));

  useEffect(() => {
    // setTimeout: AG Grid sposta il focus sulla cella subito dopo il mount
    // dell'editor, quindi va rivendicato dopo di lui (stesso accorgimento di
    // MenuIconEditor).
    const timer = setTimeout(() => inputRef.current?.focus());
    return () => clearTimeout(timer);
  }, []);

  return (
    <input
      ref={inputRef}
      type="date"
      className="ag-input-field-input ag-text-field-input"
      value={draft}
      // Aprire la cella digitando non deve perdere il carattere iniziale: con
      // l'input date il browser lo gestisce da solo una volta preso il focus.
      data-event-key={eventKey ?? undefined}
      onChange={(event) => {
        setDraft(event.target.value);
        onValueChange(event.target.value || null);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Blocca SOLO la navigazione fra i segmenti dell'input nativo.
        // Nessuno stopPropagation: l'evento deve arrivare ad AG Grid.
        event.preventDefault();
      }}
      style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "transparent" }}
    />
  );
}

export default DateCellEditor;
