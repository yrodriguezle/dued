import { useState } from "react";
import { Paper, Typography, Box, Button, TextField, Chip, IconButton, CircularProgress } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery } from "@apollo/client";

import { getCategorieSpesa } from "../../../graphql/registroCassa/queries";
import { mutationMutateCategoriaSpesa, mutationEliminaCategoriaSpesa } from "../../../graphql/registroCassa/mutations";
import showToast from "../../../common/toast/showToast";

/**
 * Sezione «Categorie di spesa» dentro Impostazioni: l'elenco delle categorie configurabili
 * usate dalle griglie spese (cassa, chiusura mensile, liquidità). Si possono aggiungere,
 * rinominare e disattivare/eliminare le categorie (eliminazione bloccata se già in uso).
 */
function CategorieSpesaSection() {
  const { data, loading, refetch } = useQuery(getCategorieSpesa);
  const [mutateCategoria] = useMutation(mutationMutateCategoriaSpesa);
  const [eliminaCategoria] = useMutation(mutationEliminaCategoriaSpesa);

  const [nuovoNome, setNuovoNome] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNome, setEditingNome] = useState("");

  const categorie = data?.gestioneCassa.categorieSpesa ?? [];

  const handleAggiungi = async () => {
    const nome = nuovoNome.trim();
    if (!nome) return;
    try {
      await mutateCategoria({ variables: { categoria: { categoriaId: null, nome, attiva: true, ordine: categorie.length } } });
      setNuovoNome("");
      await refetch();
      showToast({ type: "success", position: "bottom-right", message: `Categoria "${nome}" aggiunta`, autoClose: 2000, toastId: "cat-add" });
    } catch (err: unknown) {
      showToast({ type: "error", position: "bottom-right", message: err instanceof Error ? err.message : "Errore", toastId: "cat-add-error" });
    }
  };

  const handleRinomina = async (id: number) => {
    const nome = editingNome.trim();
    if (!nome) return;
    try {
      await mutateCategoria({ variables: { categoria: { categoriaId: id, nome } } });
      setEditingId(null);
      setEditingNome("");
      await refetch();
      showToast({ type: "success", position: "bottom-right", message: "Categoria aggiornata", autoClose: 2000, toastId: "cat-rename" });
    } catch (err: unknown) {
      showToast({ type: "error", position: "bottom-right", message: err instanceof Error ? err.message : "Errore", toastId: "cat-rename-error" });
    }
  };

  const handleElimina = async (id: number, nome: string) => {
    try {
      await eliminaCategoria({ variables: { categoriaId: id } });
      await refetch();
      showToast({ type: "success", position: "bottom-right", message: `Categoria "${nome}" eliminata`, autoClose: 2000, toastId: "cat-del" });
    } catch (err: unknown) {
      showToast({ type: "error", position: "bottom-right", message: err instanceof Error ? err.message : "Errore", toastId: "cat-del-error" });
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
      <Typography
        variant="subtitle1"
        fontWeight={600}
        sx={{ mb: 0.5 }}
      >
        Categorie di spesa
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 2 }}
      >
        Le categorie usate dalle griglie delle spese. Si può aggiungerne di nuove (es. Beni, Macchinari)
        o rinominare quelle esistenti; le categorie già usate da spese o pagamenti non sono eliminabili.
      </Typography>

      {loading && <CircularProgress size={20} />}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        {categorie.map((c) => (
          <Box
            key={c.id}
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            {editingId === c.id ? (
              <>
                <TextField
                  size="small"
                  value={editingNome}
                  onChange={(e) => setEditingNome(e.target.value)}
                  sx={{ width: 140 }}
                />
                <Button
                  size="small"
                  onClick={() => handleRinomina(c.id)}
                >OK</Button>
                <Button
                  size="small"
                  onClick={() => { setEditingId(null); setEditingNome(""); }}
                >Annulla</Button>
              </>
            ) : (
              <>
                <Chip
                  label={c.nome}
                  color={c.attiva ? "primary" : "default"}
                  variant={c.attiva ? "filled" : "outlined"}
                  onClick={() => { setEditingId(c.id); setEditingNome(c.nome); }}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleElimina(c.id, c.nome)}
                  aria-label={`Elimina ${c.nome}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          size="small"
          label="Nuova categoria"
          value={nuovoNome}
          onChange={(e) => setNuovoNome(e.target.value)}
          sx={{ width: 200 }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAggiungi}
          disabled={!nuovoNome.trim()}
        >
          Aggiungi
        </Button>
      </Box>
    </Paper>
  );
}

export default CategorieSpesaSection;
