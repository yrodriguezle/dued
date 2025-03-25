/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import isEmpty from "lodash/isEmpty";
import MuiAccordion from "@mui/material/Accordion";
import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import MuiAccordionSummary from "@mui/material/AccordionSummary";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import { useFormikContext } from "formik";
import { useSelector } from "react-redux";
import { styled } from "@mui/material/styles";

import useResizeObserver from "../hooks/useResizeObserver";
import { getBooleanFromString } from "../../../common/utils";
import { getElementByNameOrId, getErrorFields } from "../../../common/validators";

const Accordion = styled((props) => <MuiAccordion disableGutters elevation={0} square {...props} />)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  "&:before": {
    display: "none",
  },
}));

const AccordionSummary = styled((props) => <MuiAccordionSummary expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />} {...props} />)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, .05)" : "rgba(0, 0, 0, .03)",
  flexDirection: "row-reverse",
  "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
    transform: "rotate(90deg)",
  },
  "& .MuiAccordionSummary-content": {
    marginLeft: theme.spacing(1),
  },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: "1px solid rgba(0, 0, 0, .125)",
}));

function FormPanel({ defaultExpanded = true, header, subHeader, headerAsComponent, children, id, viewName, collapsed, disabled, disableCollapse, onClick }) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [isExpanded, toggleExpanded] = useState(defaultExpanded);
  const [height, setHeight] = useState();
  const [overflow, setOverflow] = useState("unset");
  const [bodyRef, { contentRect }] = useResizeObserver();
  const containerRef = useRef();
  const formikProps = useFormikContext();
  const { errors, values } = useMemo(() => formikProps || {}, [formikProps]);

  const setting = useSelector((state) => (state.viewSettings.viewSettings || {})[id] || {});

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isEmpty(setting) && mounted.current) {
        const toggle = getBooleanFromString(setting.settingValue);
        if (toggle) {
          setTimeout(() => setOverflow("unset"), 100);
          toggleExpanded(true);
        } else {
          setOverflow("hidden");
          toggleExpanded(false);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(setting), id]);

  useEffect(() => {
    if (contentRect && mounted.current) {
      setHeight(Math.round(contentRect.height));
    }
  }, [contentRect]);

  const handleExpanded = useCallback((toggle) => {
    if (mounted.current) {
      if (toggle) {
        setTimeout(() => setOverflow("unset"), 100);
        toggleExpanded(true);
      } else {
        setOverflow("hidden");
        toggleExpanded(false);
      }
    }
  }, []);

  const currentHeight = useMemo(() => (isExpanded ? height : 0), [height, isExpanded]);
  useEffect(() => {
    if (mounted.current && disabled !== undefined) {
      if (disabled) {
        setOverflow("hidden");
        toggleExpanded(false);
      } else {
        setTimeout(() => setOverflow("unset"), 100);
        toggleExpanded(true);
      }
    }
  }, [disabled]);

  useEffect(() => {
    if (mounted.current && collapsed !== undefined) {
      if (collapsed) {
        setTimeout(() => setOverflow("unset"), 100);
        toggleExpanded(true);
      } else {
        setOverflow("hidden");
        toggleExpanded(false);
      }
    }
  }, [collapsed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        mounted.current &&
        typeof errors === "object" &&
        Object.keys(errors).length &&
        Object.values(errors).some((error) => error) &&
        // && containerRef.current.contains(document.activeElement)
        !isExpanded
      ) {
        const [firstFieldError] = getErrorFields(errors);
        const element = getElementByNameOrId(firstFieldError);
        if (element && containerRef.current.contains(element)) {
          handleExpanded(true);
          setTimeout(() => {
            element.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });
          }, 150);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [errors, handleExpanded, isExpanded]);

  const handleClick = useCallback(() => {
    if (onClick && typeof onClick === "function") {
      onClick();
    } else {
      handleExpanded(!isExpanded);
    }
  }, [handleExpanded, isExpanded, onClick]);

  const renderChild = useMemo(() => {
    if (typeof children === "function") {
      return children({ isExpanded });
    }
    return children;
  }, [children, isExpanded]);

  const renderSubHeader = useMemo(() => {
    if (!isExpanded && !isEmpty(subHeader)) {
      return subHeader
        .map((key) => values[key] || "")
        .filter((required) => required)
        .join(" ");
    }
    return "";
  }, [isExpanded, subHeader, values]);

  return (
    <Accordion expanded={isExpanded} onChange={handleClick}>
      <AccordionSummary aria-controls="panel1d-content" id="panel1d-header">
        <Typography>{[header, renderSubHeader].filter((required) => required).join(" - ")}</Typography>
        {headerAsComponent}
      </AccordionSummary>
      <AccordionDetails>{renderChild}</AccordionDetails>
    </Accordion>
  );
}

export default FormPanel;
