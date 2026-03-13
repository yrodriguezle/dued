import { useContext, useEffect, useState } from "react";
import { Typography, useMediaQuery, useTheme } from "@mui/material";
import "./HeaderViewTitle.css";
import PageTitleContext from "./PageTitleContext";

function HeaderViewTitle() {
  const { title } = useContext(PageTitleContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [show, setShow] = useState(false);
  const [render, setRender] = useState(false);

  // Su mobile il titolo è sempre visibile (il brand name è nascosto)
  const visible = isMobile || show;

  useEffect(() => {
    if (visible) {
      setRender(true);
    } else {
      const timeout = setTimeout(() => setRender(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [visible]);

  useEffect(() => {
    if (isMobile) return; // Su mobile non serve il listener di scroll
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
  }, [title, isMobile]);

  return render ? (
    <Typography
      component="h1"
      variant="h6"
      noWrap
      className={isMobile ? "fade-in" : visible ? "fade-in" : "fade-out"}
      sx={{
        marginLeft: 2,
        fontFamily: "BrunoAce Regular",
        color: (theme) => (theme.palette.mode === "light" ? theme.palette.secondary.light : theme.palette.primary.light),
        minWidth: 0,
        flexShrink: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {title}
    </Typography>
  ) : null;
}

export default HeaderViewTitle;
