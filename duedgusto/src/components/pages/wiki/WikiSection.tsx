import { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface WikiSectionProps {
  /** Ancora usata dall'indice in cima alla voce: deve coincidere con quella dichiarata lì. */
  id: string;
  titolo: string;
  /** Riga sotto il titolo che dice al lettore cosa sta per leggere. */
  occhiello?: string;
  children: ReactNode;
}

/** Sezione di una voce della wiki: titolo ancorabile e contenuto. */
function WikiSection({ id, titolo, occhiello, children }: WikiSectionProps) {
  return (
    <Box
      component="section"
      id={id}
      sx={{ scrollMarginTop: 16, mb: 5 }}
    >
      <Typography
        variant="h6"
        fontWeight={600}
        sx={{ mb: occhiello ? 0.25 : 1.5 }}
      >
        {titolo}
      </Typography>
      {occhiello && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1.5 }}
        >
          {occhiello}
        </Typography>
      )}
      {children}
    </Box>
  );
}

export default WikiSection;
