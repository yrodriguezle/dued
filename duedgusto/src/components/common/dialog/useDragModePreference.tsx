import useStore from "../../../store/useStore";

// Valori ammessi per la modalita' di drag: fonte di verita' condivisa col tipo dominio DragModePreference.
const DRAG_MODES_AMMESSI: readonly DragModePreference[] = ["free", "elastic"];

// Fallback sicuro quando l'utente non e' caricato (bootstrap/logout) o il valore e' fuori whitelist.
const DEFAULT_DRAG_MODE_PREFERENCE: DragModePreference = "free";

// Centralizza la lettura della preferenza dallo userStore e il fallback "free",
// cosi' AppDialog resta disaccoppiato dallo store e i test mockano un solo hook.
function useDragModePreference(): DragModePreference {
  const preferenza = useStore((state) => state.utente?.preferenzaDragModale);
  // Robustezza in lettura: normalizza qualunque valore non in whitelist a "free".
  return preferenza && DRAG_MODES_AMMESSI.includes(preferenza) ? preferenza : DEFAULT_DRAG_MODE_PREFERENCE;
}

export default useDragModePreference;
