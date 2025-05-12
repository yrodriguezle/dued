import * as MuiIcons from "@mui/icons-material";
import logger from "../../../common/logger/logger";

type IconProps = React.ComponentType<{
  fontSize?: "inherit" | "default" | "small" | "large";
  color?: "inherit" | "primary" | "secondary" | "action" | "error" | "disabled";
}>;

export type IconName = keyof typeof MuiIcons;

interface IconFactoryProps {
  name: IconName;
  fontSize?: "inherit" | "default" | "small" | "large";
  color?: "inherit" | "primary" | "secondary" | "action" | "error" | "disabled";
}

const IconFactory: React.FC<IconFactoryProps> = ({ name, fontSize = "default", color = "inherit" }) => {
  const IconComponent = (MuiIcons as Record<string, IconProps>)[name];

  if (!IconComponent) {
    logger.warn(`IconFactory: icona non trovata per nome "${name}"`);
    return null;
  }

  return <IconComponent fontSize={fontSize} color={color} />;
};

export default IconFactory;
