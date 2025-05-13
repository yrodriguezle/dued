import { PopperProps } from "@mui/material/";
import Paper from "@mui/material/Paper";
import Callout from "../../../callout/Callout";
import { useMemo } from "react";

interface FloatingPopperProps extends Omit<PopperProps, "anchorEl"> {
  anchorEl: HTMLElement | string | null;
}

function FloatingPopper(props: FloatingPopperProps) {
  const { anchorEl, children, ...popperProps } = props;
  const paperProps = useMemo(() => {
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      disablePortal,
      ...rest
    } = popperProps;
    return rest;
  }, [popperProps]);

  if (!anchorEl) return null;
  const content =
    typeof children === "function"
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children(props as any)
      : children;

  return (
    <Callout
      target={anchorEl}
      onDismiss={() => {
        /* handled by Autocomplete onClose */
      }}
      setInitialFocus={false}
      gapSpace={5}
    >
      <Paper {...paperProps} style={{ margin: 0 }}>
        {content}
      </Paper>
    </Callout>
  );
}

export default FloatingPopper;
