import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { isFirstGreaterThanSecondVersion } from './common/semver';
import logger from './common/logger';
// import { isAuthenticated } from './common/auth';

const useClearCache = () => {
  const effectRan = useRef(false);
  const location = useLocation();
  const user = useSelector((state) => state.user);

  const refreshCacheAndReload = useCallback(
    async () => {
      if (caches) {
        logger.log('caches', caches);
        // Service worker cache should be cleared with caches.delete()
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
        // delete browser cache and hard reload
        window.location.reload();
      }
    },
    [],
  );

  useEffect(() => {
    // const handleWindowClose = (event) => {
    //   event.preventDefault();
    //   if (isAuthenticated() && user && user.userId) {
    //     event.returnValue = ''; // eslint-disable-line no-param-reassign
    //   }
    // };

    if (effectRan.current) {
      fetch('/meta.json', { cache: 'no-store' })
        .then((response) => response.json())
        .then((meta) => {
          const latestVersion = meta.version;
          const currentVersion = global.appVersion;
          const shouldForceRefresh = isFirstGreaterThanSecondVersion(latestVersion, currentVersion);
          if (shouldForceRefresh) {
            logger.log(`We have a new version - ${latestVersion}. Should force refresh.`);
            refreshCacheAndReload();
          } else {
            logger.log(`version - ${currentVersion}`);
            // window.addEventListener('beforeunload', handleWindowClose);
          }
        });
    }
    return function cleanup() {
      // window.removeEventListener('beforeunload', handleWindowClose);
      effectRan.current = true;
    };
  }, [location, refreshCacheAndReload, user]);
};

export default useClearCache;
