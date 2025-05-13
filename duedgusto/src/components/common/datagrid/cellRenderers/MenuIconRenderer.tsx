import Typography from "@mui/material/Typography";
import type { CustomCellRendererProps } from "ag-grid-react";
import IconFactory from "../../icon/IconFactory";

interface MenuIconRenderer extends CustomCellRendererProps {
  fontSize?: "inherit" | "default" | "small" | "large";
}

function MenuIconRenderer(props: MenuIconRenderer) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
      {props.value ? <IconFactory name={props.value} fontSize={props.fontSize || "inherit"} /> : null}
      <Typography sx={{ marginLeft: 1 }}>{props.value}</Typography>
    </div>
  );
}

export default MenuIconRenderer;
