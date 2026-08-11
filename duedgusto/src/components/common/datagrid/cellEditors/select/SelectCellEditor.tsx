import { useEffect, useRef, useState } from "react";
import type { CustomCellEditorProps } from "ag-grid-react";

/**
 * Editor a tendina in sostituzione di `agSelectCellEditor`.
 *
 * Quello di serie chiude l'editing appena si sceglie una voce. La cella torna
 * quindi in sola presentazione e il Tab successivo si limita a spostare il
 * focus: per digitare nella cella dopo serve un Enter in piu.
 *
 * Qui la selezione aggiorna il valore ma NON chiude l'editor. La cella resta in
 * editing, cosi il Tab segue la regola normale di AG Grid — chiude la modifica
 * corrente e apre in editing la cella successiva — e l'inserimento da tastiera
 * scorre senza Enter intermedi.
 */

interface SelectCellEditorProps extends CustomCellEditorProps {
  /** Opzioni della tendina, da `cellEditorParams.values`. */
  values?: unknown[];
}

/**
 * Colori espliciti dal tema della griglia (light e dark).
 *
 * Servono perche lo sfondo trasparente del select disattiva il rendering
 * nativo della tendina: Chrome la disegna su fondo bianco mentre le voci
 * ereditano il testo chiaro del tema scuro, e restano leggibili solo quella
 * evidenziata e nessun'altra.
 */
const OPTION_STYLE = {
  color: "var(--ag-foreground-color)",
  backgroundColor: "var(--ag-background-color)",
} as const;

function SelectCellEditor({ value, values, onValueChange }: SelectCellEditorProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [draft, setDraft] = useState<string>(() => (value == null ? "" : String(value)));

  const options = (values ?? []).map((option) => String(option));

  useEffect(() => {
    // setTimeout: AG Grid rivendica il focus sulla cella subito dopo il mount
    // dell'editor (stesso accorgimento di DateCellEditor e MenuIconEditor).
    const timer = setTimeout(() => {
      const select = selectRef.current;
      if (!select) return;
      select.focus();
      // Apre subito la tendina come faceva l'editor di serie. Non tutti i
      // browser espongono showPicker sui select: se manca, il focus basta.
      try {
        (select as HTMLSelectElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        // Alcuni browser lo rifiutano fuori da un gesto utente: ignorabile.
      }
    });
    return () => clearTimeout(timer);
  }, []);

  return (
    <select
      ref={selectRef}
      className="ag-input-field-input ag-select-field-input"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        // Nessuno stopEditing: la cella resta in editing di proposito.
        onValueChange(event.target.value);
      }}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        background: "transparent",
        color: "var(--ag-foreground-color)",
      }}
    >
      {/* Un valore fuori elenco (es. dato storico) non deve sparire in silenzio. */}
      {!options.includes(draft) && draft !== "" && (
        <option
          value={draft}
          style={OPTION_STYLE}
        >
          {draft}
        </option>
      )}
      {options.map((option) => (
        <option
          key={option}
          value={option}
          style={OPTION_STYLE}
        >
          {option}
        </option>
      ))}
    </select>
  );
}

export default SelectCellEditor;
