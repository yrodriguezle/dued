import { PopperProps } from "@mui/material/";
import Paper from "@mui/material/Paper";
import Callout from "../../../callout/Callout";

interface FloatingPopperProps extends PopperProps {
  target: HTMLElement | string | null;
}

function FloatingPopper(props: FloatingPopperProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { target, anchorEl, children, ...paperProps } = props;
  if (!target) return null;
  const content =
    typeof children === "function"
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children(props as any)
      : children;

  console.log("content", content);
  return (
    <Callout
      target={target}
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
