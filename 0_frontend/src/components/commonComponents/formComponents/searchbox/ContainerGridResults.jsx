import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { useSelector } from 'react-redux';
import { Button } from '@mui/material';
import isEmpty from 'lodash/isEmpty';

import useResizeObserver from '../../hooks/useResizeObserver';
import useEventListener from '../../hooks/useEventListener';
import GridResults from './GridResults';
import OutsideClickHandler from '../../outsideHandler/OutsideClickHandler';

// import useResizeObserver from '../hooks/useResizeObserver';
// import useEventListener from '../hooks/useEventListener';
// import GridResults from './GridResults';
// import OutsideClickHandler from '../OutsideClickHandler';

function ContainerGridResults({
  items,
  lookup,
  fetchedCount,
  loadMore,
  onSelectedItem,
  // onOpenModal,
  isEditor,
  setResultsVisible,
  searchBoxId,
  containerHeight,
  onGridReady,
  onOutsideClick,
}) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const calloutRef = useRef(null);
  const [setRef, { contentRect }] = useResizeObserver();

  const userID = useSelector((state) => +(state.user?.userID || 0));
  const { viewSettings, setViewSetting, viewName } = useSelector((state) => state.viewSettings);
  const searchBoxSettings = useMemo(() => viewSettings[searchBoxId] || {}, [searchBoxId, viewSettings]);
  const viewSettingsID = useMemo(() => searchBoxSettings?.viewSettingsID || 0, [searchBoxSettings?.viewSettingsID]);
  const settingValues = useMemo(
    () => (!isEmpty(searchBoxSettings.settingValue)
      ? JSON.parse(searchBoxSettings.settingValue)
      : {}),
    [searchBoxSettings.settingValue],
  );

  const saveContainerWidth = useCallback((width) => {
    if (settingValues.calloutWidth !== width && typeof setViewSetting === 'function' && mounted.current) {
      setViewSetting({
        viewSettingsID,
        objectType: 0,
        objectID: userID,
        viewName,
        settingValueType: 0,
        controlName: 'searchBoxCallout',
        settingName: searchBoxId,
        settingValue: JSON.stringify({
          ...settingValues,
          calloutWidth: width,
        }),
      });
    }
  }, [settingValues, setViewSetting, viewSettingsID, userID, viewName, searchBoxId]);

  useEffect(() => {
    const debounced = setTimeout(() => {
      if (contentRect && contentRect.width > global.SEARCHBOX_CONTAINER_MIN_WIDTH) {
        saveContainerWidth(Math.round(contentRect.width));
      }
    }, 500);
    return () => clearTimeout(debounced);
  }, [contentRect, saveContainerWidth]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && setResultsVisible) {
        setResultsVisible(false);
      }
    },
    [setResultsVisible],
  );
  useEventListener('keydown', handleKeyDown, calloutRef.current);

  const commonBody = useMemo(() => (
    <div
      ref={setRef}
      style={{
        resize: 'horizontal',
        overflow: 'auto',
        width: settingValues.calloutWidth,
        minWidth: global.SEARCHBOX_CONTAINER_MIN_WIDTH,
      }}
    >
      <div
        ref={calloutRef}
      >
        <GridResults
          searchBoxId={searchBoxId}
          isEditor={isEditor}
          userID={userID}
          lookup={lookup}
          items={items}
          viewName={viewName}
          viewSettingsID={viewSettingsID}
          settings={settingValues}
          fetchedCount={fetchedCount}
          loadMore={loadMore}
          containerHeight={containerHeight}
          onGridReady={onGridReady}
          onSelectedItem={onSelectedItem}
          setViewSetting={setViewSetting}
        />
      </div>
      <div className="text-right">
        <Button variant="text">Seleziona da elenco completo</Button>
      </div>
    </div>
  ), [containerHeight, fetchedCount, isEditor, items, loadMore, lookup, onGridReady, onSelectedItem, searchBoxId, setRef, setViewSetting, settingValues, userID, viewName, viewSettingsID]);

  return (
    <div>
      <OutsideClickHandler onOutsideClick={onOutsideClick}>
        <div className="lookup-content">
          {commonBody}
        </div>
      </OutsideClickHandler>
    </div>
  );
}

export default ContainerGridResults;
