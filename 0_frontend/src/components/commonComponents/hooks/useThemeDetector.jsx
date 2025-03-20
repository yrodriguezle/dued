import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import receiveDarkThemeMode from '../../../redux/actions/settings/receiveDarkThemeMode';

function useThemeDetector() {
  const effectRan = useRef(false);
  const dispatch = useDispatch();
  const isThemeDark = useSelector((state) => state.settings?.darkTheme);

  useEffect(() => {
    if (effectRan.current || process.env.NODE_ENV !== 'development') {
      const isSystemDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
      dispatch(receiveDarkThemeMode(isSystemDarkTheme));
    }
    return () => { effectRan.current = true; };
  }, [dispatch]);

  const handleChangeSystemTheme = useCallback(
    (event) => {
      const isSystemDarkTheme = event.matches;
      dispatch(receiveDarkThemeMode(isSystemDarkTheme));
    },
    [dispatch],
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryList.addEventListener('change', handleChangeSystemTheme);
    return () => mediaQueryList.removeEventListener('change', handleChangeSystemTheme);
  }, [handleChangeSystemTheme]);

  useEffect(() => {
    if (isThemeDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [isThemeDark]);
}

export default useThemeDetector;
