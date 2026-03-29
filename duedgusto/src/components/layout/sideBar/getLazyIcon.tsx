import { JSX } from "react";
import { iconMapping } from "./iconMapping";

function getLazyIcon(iconName?: string): JSX.Element | undefined {
  if (!iconName || !iconMapping[iconName]) {
    return undefined;
  }
  const IconComponent = iconMapping[iconName];
  return <IconComponent size={24} />;
}

export default getLazyIcon;
