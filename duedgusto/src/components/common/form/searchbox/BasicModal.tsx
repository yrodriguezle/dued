import * as React from "react";
import { Box, Button, Modal, Typography } from "@mui/material";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  borderRadius: "12px",
  boxShadow: 24,
  p: 4,
};

export default function BasicModal() {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <div>
      <Button variant="contained" onClick={handleOpen}>
        Apri Modal
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-titolo"
        aria-describedby="modal-descrizione"
      >
        <Box sx={style}>
          <Typography id="modal-titolo" variant="h6" component="h2">
            Titolo della Modal
          </Typography>
          <Typography id="modal-descrizione" sx={{ mt: 2 }}>
            Questo è un esempio di contenuto dentro una Modal di MUI.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            sx={{ mt: 3 }}
            onClick={handleClose}
          >
            Chiudi
          </Button>
        </Box>
      </Modal>
    </div>
  );
}
