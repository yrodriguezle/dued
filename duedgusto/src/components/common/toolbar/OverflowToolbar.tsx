import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";

export interface OverflowAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface OverflowToolbarProps {
  actions: OverflowAction[];
  iconOnly?: boolean;
}

/**
 * Toolbar che mostra i bottoni che ci stanno nello spazio disponibile
 * e collassa quelli che non ci stanno in un menu a tendina (⋮).
 */
function OverflowToolbar({ actions, iconOnly = false }: OverflowToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const MORE_BUTTON_WIDTH = 40;
  const BUTTON_GAP = 8;

  const calculate = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const containerWidth = container.clientWidth;
    const buttons = Array.from(measure.children) as HTMLElement[];

    // Prima verifica: ci stanno tutti senza il bottone menu?
    const totalWidth = buttons.reduce((sum, btn, i) => sum + btn.offsetWidth + (i > 0 ? BUTTON_GAP : 0), 0);
    if (totalWidth <= containerWidth) {
      setVisibleCount(actions.length);
      return;
    }

    // Altrimenti calcola quanti ci stanno lasciando spazio per il bottone ⋮
    const availableWidth = containerWidth - MORE_BUTTON_WIDTH - BUTTON_GAP;
    let usedWidth = 0;
    let count = 0;

    buttons.some((btn, i) => {
      const btnWidth = btn.offsetWidth + (i > 0 ? BUTTON_GAP : 0);
      if (usedWidth + btnWidth > availableWidth) return true;
      usedWidth += btnWidth;
      count++;
      return false;
    });

    setVisibleCount(count);
  }, [actions.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(calculate);
    observer.observe(container);
    // Calcolo iniziale
    calculate();
    return () => observer.disconnect();
  }, [calculate]);

  const visibleActions = actions.slice(0, visibleCount);
  const overflowActions = actions.slice(visibleCount);

  return (
    <Box
      ref={containerRef}
      sx={{ display: "flex", alignItems: "center", width: "100%", minWidth: 0, overflow: "hidden" }}
    >
      {/* Div nascosto fuori schermo per misurare la larghezza reale di ogni bottone */}
      <Box
        ref={measureRef}
        sx={{ position: "fixed", left: -9999, top: -9999, visibility: "hidden", pointerEvents: "none", display: "flex", gap: `${BUTTON_GAP}px`, whiteSpace: "nowrap" }}
      >
        {actions.map((action) =>
          iconOnly ? (
            <IconButton key={action.key} size="small" sx={{ flexShrink: 0 }}>
              {action.icon}
            </IconButton>
          ) : (
            <Button
              key={action.key}
              size="small"
              variant="text"
              startIcon={action.icon}
              sx={{ minHeight: 0, height: 32, paddingY: 0.5, paddingX: 1.5, flexShrink: 0 }}
            >
              {action.label}
            </Button>
          )
        )}
      </Box>

      {/* Bottoni visibili */}
      <Box sx={{ display: "flex", alignItems: "center", gap: `${BUTTON_GAP}px`, overflow: "hidden", flexShrink: 1 }}>
        {visibleActions.map((action) =>
          iconOnly ? (
            <Tooltip key={action.key} title={action.label}>
              <span>
                <IconButton
                  size="small"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  sx={{ flexShrink: 0 }}
                >
                  {action.icon}
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Button
              key={action.key}
              size="small"
              variant="text"
              startIcon={action.icon}
              onClick={action.onClick}
              disabled={action.disabled}
              sx={{ minHeight: 0, height: 32, paddingY: 0.5, paddingX: 1.5, flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {action.label}
            </Button>
          )
        )}
      </Box>

      {/* Menu overflow */}
      {overflowActions.length > 0 && (
        <>
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{ ml: "auto", flexShrink: 0 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            {overflowActions.map((action) => (
              <MenuItem
                key={action.key}
                disabled={action.disabled}
                onClick={() => {
                  action.onClick();
                  setMenuAnchor(null);
                }}
              >
                <ListItemIcon>{action.icon}</ListItemIcon>
                <ListItemText>{action.label}</ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
}

export default OverflowToolbar;
