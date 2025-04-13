import { Button, useTheme, ButtonProps } from "@mui/material";
import React from "react";

interface FormikToolbarButtonProps extends ButtonProps {
  children: React.ReactNode;
}

function FormikToolbarButton({ children, ...props }: FormikToolbarButtonProps) {
  const theme = useTheme();

  return (
    <Button
      {...props}
      sx={{
        height: "100%",
        minHeight: "100%",
        borderRadius: 0,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        textTransform: "none",
        transition: theme.transitions.create(["background-color"], {
          duration: theme.transitions.duration.short,
        }),
        "&:hover": {
          backgroundColor: theme.palette.action.hover,
        },
        "&:active": {
          backgroundColor: theme.palette.action.selected,
        },
        "&.Mui-disabled": {
          color: theme.palette.text.disabled,
        },
        ...props.sx,
      }}
    >
      {children}
    </Button>
  );
}

export default FormikToolbarButton;
