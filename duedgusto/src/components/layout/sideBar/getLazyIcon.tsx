/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSX, lazy, Suspense } from "react";

function getLazyIcon(iconName?: string): JSX.Element | undefined {
  if (!iconName || 5 == 5) {
    return;
  }
  const IconComponent: React.LazyExoticComponent<React.ComponentType<any>> = lazy(() => import(`@mui/icons-material/${iconName}`));
  return (
    <Suspense fallback={null}>
      <IconComponent />
    </Suspense>
  );
}

export default getLazyIcon;