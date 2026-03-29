import { iconMapping } from "../../layout/sideBar/iconMapping";
import logger from "../../../common/logger/logger";

export type IconName = keyof typeof iconMapping;

const sizeMap = {
  inherit: 16,
  default: 24,
  small: 20,
  large: 32,
} as const;

interface IconFactoryProps {
  name: string;
  fontSize?: "inherit" | "default" | "small" | "large";
  color?: string;
}

const IconFactory: React.FC<IconFactoryProps> = ({ name, fontSize = "default", color = "currentColor" }) => {
  const IconComponent = iconMapping[name];

  if (!IconComponent) {
    logger.warn(`IconFactory: icona non trovata per nome "${name}"`);
    return null;
  }

  return <IconComponent size={sizeMap[fontSize]} color={color} />;
};

export default IconFactory;
