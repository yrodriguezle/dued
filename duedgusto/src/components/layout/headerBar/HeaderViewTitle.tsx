import { useContext, useEffect, useState } from "react";
import { Typography } from "@mui/material";
import "./HeaderViewTitle.css";
import PageTitleContext from "./PageTitleContext";

function HeaderViewTitle() {
  const { title } = useContext(PageTitleContext);
  const [show, setShow] = useState(false);
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (show) {
      setRender(true);
    } else {
      const timeout = setTimeout(() => setRender(false), 500); // 500ms = durata fade-out
      return () => clearTimeout(timeout);
    }
  }, [show]);

  useEffect(() => {
    const handleScroll = () => {
      const element = document.getElementById("view-title");
      if (element) {
        const rect = element.getBoundingClientRect();
        setShow(rect.top < 85);
      }
    };
    const scrollableElement = document.querySelector(".scrollable-box");
    if (scrollableElement) {
      scrollableElement.addEventListener("scroll", handleScroll);
      return () => scrollableElement.removeEventListener("scroll", handleScroll);
    }
  }, [title]);

  return render ? (
    <Typography
      component="h1"
      variant="h6"
      className={show ? "fade-in" : "fade-out"}
      sx={{
        marginLeft: 2,
        fontFamily: "BrunoAce Regular",
        color: (theme) => (theme.palette.mode === "light" ? theme.palette.secondary.light : theme.palette.primary.light),
      }}
    >
      {title}
    </Typography>
  ) : null;
}

export default HeaderViewTitle;
