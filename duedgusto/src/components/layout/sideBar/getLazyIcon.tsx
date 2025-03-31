import { JSX, Suspense } from "react";
import { iconMapping } from "./iconMapping"; // assicurati di usare il percorso corretto

function getLazyIcon(iconName?: string): JSX.Element | undefined {
  if (!iconName || !iconMapping[iconName]) {
    return undefined;
  }
  const IconComponent = iconMapping[iconName];
  return (
    <Suspense fallback={null}>
      <IconComponent />
    </Suspense>
  );
}

export default getLazyIcon;
