import React, { useCallback, useEffect, useMemo } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { useFormikContext } from "formik";
import isEqual from "lodash/isEqual";
import { isEmpty } from "lodash";
import { EditOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useDispatch } from "react-redux";
import onInProgress from "../../../redux/actions/inProgress/onInProgress";
import { validateFormikForm } from "../../../common/validators";
import offInProgress from "../../../redux/actions/inProgress/offInProgress";

function FormToolbar({ isFormLocked, formStatus: formStatusAsProp, disabledSave: disabledSaveProp, entity, getFormikContext, setMessage, onFormChanged, onValidateView }) {
  const dispatch = useDispatch();
  const formikProps = useFormikContext();
  const { values, status, initialValues, isSubmitting } = formikProps;

  const formLocked = useMemo(() => (isFormLocked !== undefined ? isFormLocked : formikProps?.status?.isFormLocked), [formikProps?.status?.isFormLocked, isFormLocked]);
  const formStatus = useMemo(() => formStatusAsProp || formikProps?.status?.formStatus, [formStatusAsProp, formikProps?.status?.formStatus]);
  const formHasChanged = useMemo(() => {
    const valuesToCompare = typeof entity === "object" && entity !== null ? entity : initialValues;
    const hasChanged = !isEqual(valuesToCompare, values);
    return hasChanged;
  }, [entity, initialValues, values]);
  const disabledSave = useMemo(
    () => (disabledSaveProp !== undefined ? disabledSaveProp || formLocked || isSubmitting : !formHasChanged || formLocked || isSubmitting),
    [disabledSaveProp, formHasChanged, formLocked, isSubmitting]
  );

  useEffect(() => {
    if (getFormikContext && typeof getFormikContext === "function") {
      getFormikContext(formikProps);
    }
  }, [formikProps, getFormikContext]);

  useEffect(() => {
    if (onFormChanged && typeof onFormChanged === "function") {
      onFormChanged(formHasChanged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formHasChanged]);

  const handleSubmitAndFetchUpdatedEntity = useCallback(async () => {
    if (formikProps) {
      const { validateForm, setTouched, submitForm } = formikProps;
      dispatch(onInProgress("promiseLoading"));
      const isValid = onValidateView
        ? await onValidateView(() => validateFormikForm(formikProps.values, validateForm, setTouched, setMessage))
        : await validateFormikForm(formikProps.values, validateForm, setTouched, setMessage);
      dispatch(offInProgress("promiseLoading"));
      if (isValid) {
        dispatch(onInProgress("promiseLoading"));
        await submitForm();
        dispatch(offInProgress("promiseLoading"));
      }
    }
  }, [formikProps, dispatch, onValidateView, setMessage]);

  const renderUpdateButton = useMemo(() => {
    const disabled = status?.formStatus === "INSERT" || isEmpty(entity);
    const text = formLocked || formStatus === "INSERT" ? "Modifica" : "Blocca";
    return (
      <Button variant="contained" disableElevation color="secondary" disabled={disabled} startIcon={<EditOutlined />}>
        {text}
      </Button>
    );
  }, [entity, formLocked, formStatus, status?.formStatus]);

  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar variant="dense" className="header-bar">
        <Stack direction="row" spacing={2}>
          {renderUpdateButton}
          <Button variant="contained" disableElevation color="secondary" startIcon={<SaveOutlined />} disabled={disabledSave} onClick={handleSubmitAndFetchUpdatedEntity}>
            Salva
          </Button>
          <Button variant="contained" disableElevation color="secondary" startIcon={<SaveOutlined />} disabled={disabledSave}>
            Salva e nuovo
          </Button>
          <Button variant="contained" disableElevation color="secondary" startIcon={<PlusOutlined />} disabled={disabledSave}>
            Nuovo
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

export default FormToolbar;
