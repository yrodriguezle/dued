import React from 'react';

import FastField from './FastField';
import TextField from './TextField';

const handleChange = (name, value, field, form, onChange) => {
  if (onChange && typeof onChange === 'function') {
    onChange(name, value, field, form);
    return;
  }

  form.setFieldValue(field.name, value);
};

const handleBlur = (event, field, form, onBlur) => {
  if (onBlur && typeof onBlur === 'function') {
    onBlur(event, field, form);
    return;
  }
  form.handleBlur(event);
};

function FormikTextField({
  name, onChange, onBlur, params, ...props
}) {
  return (
    <FastField name={name} params={params}>
      {({ field, form, meta }) => (
        <TextField
          name={field.name}
          value={field.value}
          onChange={(...innerProps) => handleChange(...innerProps, field, form, onChange)}
          onBlur={(event) => handleBlur(event, field, form, onBlur)}
          disabled={form.isSubmitting || form.status?.isFormLocked}
          error={Boolean(meta.touched && meta.error)}
          helperText={meta.touched && meta.error}
          {...props}
        />
      )}
    </FastField>
  );
}

export default FormikTextField;
