import React, { useRef, useState, useEffect, useCallback, ReactNode, CSSProperties } from "react";
import ReactDOM from "react-dom";
import { directionalHint, DirectionalHint } from "../../../common/globals/constants";

interface CalloutProps {
  target: HTMLElement | string;
  onDismiss: (ev: MouseEvent) => void;
  setInitialFocus?: boolean;
  direction?: DirectionalHint;
  gapSpace?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const Callout: React.FC<CalloutProps> = ({ target, onDismiss, setInitialFocus = false, direction = directionalHint.bottomLeftEdge, gapSpace = 8, className = "", style = {}, children }) => {
  const calloutRef = useRef<HTMLDivElement>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const refPosition = useRef<{ top: number; left: number }>({ top: 0, left: 0 });

  // Risolvi il target (selector o elemento)
  useEffect(() => {
    let el: HTMLElement | null;
    if (typeof target === "string") {
      el = target.startsWith("#") ? document.getElementById(target.slice(1)) : document.querySelector<HTMLElement>(target);
    } else {
      el = target;
    }
    if (!el) {
      throw new Error(`Callout: no element found for target "${target}"`);
    }
    targetElRef.current = el;
  }, [target]);

  const updatePosition = useCallback(() => {
    const targetEl = targetElRef.current;
    const calloutEl = calloutRef.current;
    if (!targetEl || !calloutEl) return;

    const targetRect = targetEl.getBoundingClientRect();
    const calloutRect = calloutEl.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (direction) {
      case directionalHint.topLeftEdge:
        top = targetRect.top - calloutRect.height - gapSpace;
        left = targetRect.left;
        break;
      case directionalHint.bottomLeftEdge:
        top = targetRect.bottom + gapSpace;
        left = targetRect.left;
        break;
      case directionalHint.leftTopEdge:
        top = targetRect.top;
        left = targetRect.left - calloutRect.width - gapSpace;
        break;
      case directionalHint.rightTopEdge:
        top = targetRect.top;
        left = targetRect.right + gapSpace;
        break;
      default:
        top = targetRect.bottom + gapSpace;
        left = targetRect.left;
    }

    // Vincoli viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left < 0) left = gapSpace;
    if (left + calloutRect.width > vw) left = vw - calloutRect.width - gapSpace;
    if (top < 0) top = gapSpace;
    if (top + calloutRect.height > vh) top = vh - calloutRect.height - gapSpace;

    if (refPosition.current.left === left && refPosition.current.top === top) {
      return;
    }
    refPosition.current = { top, left };
    setPosition({ top, left });
  }, [direction, gapSpace]);

  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition]);

  // Focus iniziale
  useEffect(() => {
    if (setInitialFocus && calloutRef.current) {
      calloutRef.current.focus();
    }
  }, [setInitialFocus]);

  // Click esterno per dismiss
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const calloutEl = calloutRef.current;
      const targetEl = targetElRef.current;
      if (calloutEl && !calloutEl.contains(e.target as Node) && (!targetEl || !targetEl.contains(e.target as Node))) {
        onDismiss(e);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onDismiss]);

  const content = (
    <div
      ref={calloutRef}
      className={className}
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        zIndex: 1000,
        // opacity: 1,
        // transform: "translateY(0)",
        // transition: "opacity 150ms ease-in-out, transform 150ms ease-in-out",
        // outline: "none",
        ...style,
      }}
      tabIndex={-1}
      role="dialog"
    >
      {children}
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

export default Callout;
