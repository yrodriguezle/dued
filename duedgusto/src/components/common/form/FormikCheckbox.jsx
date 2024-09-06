import React from 'react';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';

import FastField from './FastField';

const handleChange = (event, field, form, onChange) => {
  if (onChange && typeof onChange === 'function') {
    onChange(event.target.checked, field, form);
    return;
  }

  if (typeof field.value === 'boolean') {
    form.setFieldValue(field.name, event.target.checked);
  } else {
    form.setFieldValue(field.name, event.target.checked ? 1 : 0);
  }
};

const FormikCheckbox = ({
  name,
  label,
  params,
  onChange,
  ...props
}) => (
  <FastField name={name} params={{ params }}>
    {({ field, form }) => (
      <FormControlLabel
        control={(
          <Checkbox
            id={field.name}
            checked={Boolean(field.value)}
            onChange={(event) => handleChange(event, field, form, onChange)}
            color="primary"
            disabled={form.isSubmitting || form.status.isFormLocked}
            {...props}
          />
        )}
        label={<Typography variant="body1">{label}</Typography>}
      />
    )}
  </FastField>
);

export default FormikCheckbox;
