/* eslint-disable no-unused-vars */
import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { useSelector } from 'react-redux';
import last from '../../../../common/bones/last';
import lowerFirst from '../../../../common/bones/lowerFirst';
import logger from '../../../../common/logger';
import { findSearchboxRecordResult, sleep } from '../../../../common/utils';

import TextField from '../TextField';
import ContainerGridResults from './ContainerGridResults';
import useFetchData from './useFetchData';
import useQueryParams, { sqlSanitizeValue } from './useQueryParams';

const selectedItemFromResults = (value, itemsData, fieldName, lookup, handleSelectedItem) => {
  const found = findSearchboxRecordResult(value, itemsData);
  if (found && lookup.id) {
    const selectedItem = {
      ...found,
      key: found[lookup.id],
    };
    handleSelectedItem(selectedItem);
    return true;
  }
  return false;
};

function Searchbox({
  textUpperCase,
  value,
  label,
  name,
  disabled,
  openOnFocus = false,
  lookup = {},
  lookupFieldName,
  lookupWhere,
  lookupMasterWhere,
  lookupJoin,
  lookupWhereModal,
  lookupOrderBy,
  lookupMasterOrderBy,
  lookupMasterFieldName,
  lookupDirection,
  maxHeight,
  isPrimary,
  entitySelected,
  textFieldOnly,
  numericOnly,
  skipQuery,
  queryFetchPolicy,
  disableOpenView,
  queryString,
  containerHeight,
  onChange,
  onResetForm,
  onSelectItem,
  onSelectItemOnMaster,
  onBlur,
  onSetFieldError,
  onSelectedItemOnBlur,
  onBeforeStart,
  ...props
}, ref) {
  const inputRef = useRef(null);
  const eventTrigger = useRef(null);
  const resultListRef = useRef(null);
  const caretSelection = useRef();
  const containerRef = useRef();
  const [innerValue, setValue] = useState(value || '');
  const [prevValue, setPrevValue] = useState();
  const [resultsVisible, setResultsVisible] = useState(false);
  const [showModal, onShowModal] = useState(false);
  const [userSelectedItem, setSelection] = useState(false);
  const [isShiftF9, setIsShiftF9] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fieldName = useMemo(() => (lookupFieldName || name || ''), [lookupFieldName, name]);
  const sanitizeFieldName = useMemo(() => lowerFirst(last(fieldName.split('.'))), [fieldName]);

  const additionalWhere = useMemo(() => {
    const where = lookup.additionalWhere || '';
    return where.replace(/\$value/g, sqlSanitizeValue(innerValue));
  }, [innerValue, lookup.additionalWhere]);

  const { query, variables } = useQueryParams({
    fieldNamePrimary: fieldName,
    fields: lookup.items,
    queryName: lookup.query,
    value: innerValue,
    lookupSelect: lookup.select,
    lookupTableName: lookup.tableName,
    lookupJoin: lookupJoin || lookup.join,
    lookupWhere,
    additionalWhere,
    lookupOrderBy,
    direction: lookupDirection,
    pageItems: maxHeight ? 100 : 50,
    param: lookup.param,
  });
  const searchBoxId = useMemo(() => props.id || `${lookup.query}-${name}-searchbox`, [lookup.query, name, props.id]);
  const uiFunctions = useSelector((state) => state.uiFunctions);
  const skip = useMemo(
    () => (openOnFocus ? false : !innerValue || Boolean(textFieldOnly) || skipQuery || !dirty),
    [openOnFocus, innerValue, textFieldOnly, skipQuery, dirty],
  );

  const {
    loading,
    items,
    fetchedCount,
    fetchItems,
    loadMoreIntoGrid,
  } = useFetchData({
    query,
    queryName: lookup.query,
    variables,
    skip,
    fetchPolicy: queryFetchPolicy,
    resetData: !innerValue,
  });

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setValue(value || '');
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current.focus();
      },
      getValue: () => {
        if (onSelectedItemOnBlur) {
          onSelectedItemOnBlur({
            fetchItems,
            value: inputRef.current.value,
            params: props,
          });
        }
        return inputRef.current.value;
      },
      setValue,
      setDirty,
      isCancelBeforeStart: () => {
        if (onBeforeStart) {
          onBeforeStart(props);
        }
      },
    }),
    [fetchItems, onBeforeStart, onSelectedItemOnBlur, props],
  );

  const isEditor = useMemo(() => Boolean(props.api), [props.api]);

  useEffect(() => {
    if (isEditor) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
    }
  }, [isEditor]);

  useEffect(() => () => {
    eventTrigger.current = null;
    resultListRef.current = null;
    caretSelection.current = null;
    setSelection(false);
    onShowModal(false);
    setResultsVisible(false);
    setDirty(false);
    setIsShiftF9(false);
  }, []);

  useEffect(() => {
    setSelection(entitySelected);
  }, [entitySelected]);

  useEffect(() => {
    if (textFieldOnly) {
      setResultsVisible(false);
      setDirty(false);
      setIsShiftF9(false);
    }
  }, [textFieldOnly]);

  useEffect(() => {
    if (showModal) {
      setResultsVisible(false);
    }
  }, [showModal]);

  useEffect(() => {
    if (textUpperCase && inputRef.current && caretSelection.current) {
      const { selectionStart, selectionEnd } = inputRef.current;
      const update = (caretSelection.current.start !== false && caretSelection.current?.start !== selectionStart)
        || (caretSelection.current.end !== false && caretSelection.current.end !== selectionEnd);
      if (update) {
        inputRef.current.setSelectionStart(caretSelection.current.start);
        inputRef.current.setSelectionEnd(caretSelection.current.end);
      }
    }
  }, [innerValue, textUpperCase]);

  const handleSelectedItem = useCallback(
    async (item) => {
      if (onChange && item && item[sanitizeFieldName]) {
        onChange(name, item[sanitizeFieldName]);
      }
      setValue(item[sanitizeFieldName]);
      if (onSelectItem) {
        await sleep(0); // Code will execute after the synchronous top-level functions (including event propagation)
        if (props.api) {
          onSelectItem(inputRef.current?.value, props, item, inputRef.current);
        } else {
          await onSelectItem(item, name, onChange, inputRef.current);
        }
      }
      if (onBlur) {
        const inputEvent = {
          target: {
            name,
            value: item && item[fieldName],
          },
        };
        onBlur(inputEvent);
      }
    },
    [fieldName, name, onBlur, onChange, onSelectItem, props, sanitizeFieldName],
  );

  const handleSelectedItemAndFocusToSearchBox = useCallback(
    async (item) => {
      setSelection(true);
      onShowModal(false);
      setResultsVisible(false);
      setIsShiftF9(false);
      if (isShiftF9 && onSelectItemOnMaster && typeof onSelectItemOnMaster === 'function') {
        await onSelectItemOnMaster(item);
      } else {
        await handleSelectedItem(item);
      }
      if (inputRef.current) {
        await sleep(1);
        inputRef.current.focus();
      }
    },
    [handleSelectedItem, isShiftF9, onSelectItemOnMaster],
  );

  const handleSelectedItemOnBlur = useCallback(
    async (event) => {
      event.persist();
      const { data } = await fetchItems();
      const itemsData = (data && data[lookup.query].items) || [];
      if (itemsData.length) {
        const isItemSelected = selectedItemFromResults(innerValue, itemsData, sanitizeFieldName, lookup, handleSelectedItem);
        if (isItemSelected && mounted.current) {
          setSelection(true);
          onShowModal(false);
          setResultsVisible(false);
          setIsShiftF9(false);
        }
      }
    },
    [fetchItems, handleSelectedItem, innerValue, lookup, sanitizeFieldName],
  );

  const handleOpenTabOnF10 = useCallback(
    () => {
      if (lookup.view && uiFunctions.length && !disableOpenView) {
        const { origin } = window.location;
        const root = `${origin}${global.ROOT_URL}`;
        const uiFunction = uiFunctions.find(({ viewName }) => viewName === lookup.view);
        if (uiFunction) {
          const addQueryString = queryString ? `${queryString}&` : '';
          const url = `${root}${uiFunction.uRLPath}?${addQueryString}${sanitizeFieldName}=${innerValue}`;
          window.open(url, '_blank');
        } else {
          logger.warning('uiFunction not found');
        }
      }
    },
    [lookup.view, uiFunctions, disableOpenView, queryString, sanitizeFieldName, innerValue],
  );

  const handleKeyDown = useCallback(
    (event) => {
      event.persist();
      eventTrigger.current = event;
      if (innerValue && event.key === 'ArrowDown' && resultListRef.current && !resultListRef.current.api.destroyCalled) {
        resultListRef.current.api.deselectAll();
        const node = resultListRef.current.api.getDisplayedRowAtIndex(0);
        if (node) {
          node.setSelected(true);
        }
      }
      if (event.key === 'Escape' || event.key === 'Tab') {
        setResultsVisible(false);
      }
      if (event.key === 'Enter') {
        if (!userSelectedItem && innerValue && items?.length) {
          const isItemSelected = selectedItemFromResults(innerValue, items, sanitizeFieldName, lookup, handleSelectedItem);
          if (isItemSelected) {
            setSelection(true);
            onShowModal(false);
            setResultsVisible(false);
            setIsShiftF9(false);
          }
        }
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
      if (event.key === 'F9') {
        if (event.shiftKey) {
          setIsShiftF9(true);
        }
        onShowModal(true);
      }
      if (event.key === 'F10' && !event.ctrlKey) {
        handleOpenTabOnF10();
      }
      if (event.key === 'F10' && event.ctrlKey) {
        logger.log('TODO: Ctrl+F10');
      }
    },
    [handleOpenTabOnF10, handleSelectedItem, items, lookup, sanitizeFieldName, userSelectedItem, innerValue],
  );

  const handleFocus = useCallback(
    () => {
      setPrevValue(innerValue);
      if (!userSelectedItem && openOnFocus && items.length) {
        setResultsVisible(true);
      } else if (innerValue && userSelectedItem && !textFieldOnly) {
        setResultsVisible(false);
        setIsShiftF9(false);
      }
    },
    [innerValue, openOnFocus, items.length, userSelectedItem, textFieldOnly],
  );

  const handleBlur = useCallback(
    (event) => {
      if (
        !textFieldOnly
        && !userSelectedItem
        && isPrimary
        && innerValue
        && eventTrigger.current
        && eventTrigger.current.key !== 'ArrowDown'
        && eventTrigger.current.key !== 'F9'
      ) {
        handleSelectedItemOnBlur(event);
      }
      if (!textFieldOnly && isPrimary && !innerValue && entitySelected && onResetForm) {
        onResetForm();
      }
      if (onBlur && eventTrigger?.current?.key !== 'ArrowDown' && !resultsVisible) {
        onBlur(event, prevValue);
      }

      setDirty(false);
    },
    [textFieldOnly, userSelectedItem, isPrimary, innerValue, entitySelected, onResetForm, onBlur, resultsVisible, handleSelectedItemOnBlur, prevValue],
  );

  const handleChange = useCallback(
    (event, newValue) => {
      let returnValue = newValue;
      if (textUpperCase) {
        caretSelection.current = {
          start: event.target.selectionStart,
          end: event.target.selectionEnd,
        };
        returnValue = returnValue.toUpperCase();
      }
      if (numericOnly) {
        returnValue = newValue.replace(/[^0-9]+/g, '');
      }

      if (onChange) {
        onChange(name, returnValue);
      }
      setValue(returnValue);
      if (!textFieldOnly) {
        setDirty(true);
      }
      if (innerValue !== newValue) {
        if (!textFieldOnly) {
          setResultsVisible(true);
          setSelection(false);
          setIsShiftF9(false);
        }
        if (onSetFieldError) {
          onSetFieldError(name, false);
        }
      }
    },
    [textUpperCase, numericOnly, onChange, textFieldOnly, innerValue, name, onSetFieldError],
  );

  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    const debouncedMessage = setTimeout(() => {
      setErrorMessage(props.errorMessage);
    }, 200);
    return () => clearTimeout(debouncedMessage);
  }, [props.errorMessage]);

  const handleGridReady = useCallback((params) => {
    resultListRef.current = params;
  }, []);

  const sortedItems = useMemo(() => items.sort((a, b) => {
    const aValue = a[sanitizeFieldName]?.toString().toLowerCase();
    const bValue = b[sanitizeFieldName]?.toString().toLowerCase();
    if (innerValue) {
      const aStarts = aValue?.startsWith(innerValue.toString().toLowerCase());
      const bStarts = bValue?.startsWith(innerValue.toString().toLowerCase());
      const options = typeof innerValue === 'number' ? { numeric: true } : undefined;
      if (aStarts && bStarts) return aValue.localeCompare(bValue, undefined, options);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return -1;
    }
    return aValue?.localeCompare(bValue);
  }), [innerValue, items, sanitizeFieldName]);

  const handleCloseModal = useCallback(
    () => {
      onShowModal(false);
      setIsShiftF9(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    [],
  );

  const handleShowModal = useCallback(
    (event) => {
      event.stopPropagation();
      onShowModal(true);
    },
    [],
  );

  const handleOutsideClick = useCallback(
    (event) => {
      if (!containerRef.current.contains(event.target)) {
        setResultsVisible(false);
      }
    },
    [],
  );

  const handleContainerBlur = useCallback(
    (event) => {
      const { currentTarget } = event;
      const browserActive = ((typeof document.hasFocus === 'function' ? document.hasFocus() : 1) ? 1 : 0);
    },
    [],
  );

  return (
    <div onBlur={handleContainerBlur} ref={containerRef}>
      <TextField
        id={searchBoxId}
        name={name}
        disabled={disabled}
        value={innerValue}
        error={!disabled ? errorMessage : ''}
        role="presentation"
        autoComplete="off"
        onChange={handleChange}
        onKeyDown={!textFieldOnly ? handleKeyDown : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {
        (!textFieldOnly && (openOnFocus || innerValue) && resultsVisible && !disabled) ? (
          <ContainerGridResults
            items={sortedItems}
            fetchedCount={fetchedCount}
            lookup={lookup}
            variables={variables}
            query={query}
            maxHeight={maxHeight}
            searchBoxId={searchBoxId}
            hasError={props.errorMessage}
            loadMore={loadMoreIntoGrid}
            onSelectedItem={handleSelectedItemAndFocusToSearchBox}
            onOpenModal={() => onShowModal(true)}
            onGridReady={handleGridReady}
            setResultsVisible={setResultsVisible}
            onOutsideClick={handleOutsideClick}
            isEditor={Boolean(props.api)}
            containerHeight={containerHeight}
          />
        ) : null
      }
    </div>
  );
}

export default forwardRef(Searchbox);
