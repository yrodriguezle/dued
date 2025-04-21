import { forwardRef, Ref } from "react";
import { FastFieldProps, FieldInputProps, FormikProps } from "formik";
import FastField from "./FastField";
import TextField, { TextFieldProps, TextFieldRef } from "./TextField";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type $FixMe = any;

const handleChange = <Values,>(
  name: string,
  value: string,
  field: FieldInputProps<string>,
  form: FormikProps<Values>,
  onChange?: (name: string, value: string, field: FieldInputProps<string>, form: FormikProps<Values>) => void
) => {
  if (onChange && typeof onChange === "function") {
    onChange(name, value, field, form);
    return;
  }
  form.setFieldValue(field.name, value);
};

const handleBlur = <Values,>(
  event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>,
  field: FieldInputProps<string>,
  form: FormikProps<Values>,
  onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>, field: FieldInputProps<string>, form: FormikProps<Values>) => void
) => {
  if (onBlur && typeof onBlur === "function") {
    onBlur(event, field, form);
    return;
  }
  form.handleBlur(event);
};

interface FormikTextFieldProps<Values> extends Omit<TextFieldProps, "onChange" | "onBlur"> {
  name: string;
  onChange?: (name: string, value: string, field: FieldInputProps<string>, form: FormikProps<Values>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>, field: FieldInputProps<string>, form: FormikProps<Values>) => void;
  params?: {
    [key: string]: $FixMe;
  };
}

function FormikTextField<Values>({ name, onChange, onBlur, params, ...props }: FormikTextFieldProps<Values>, ref: Ref<TextFieldRef>) {
  return (
    <FastField name={name} params={params}>
      {({ field, form, meta }: FastFieldProps) => {
        return (
          <TextField
            name={field.name}
            value={field.value}
            onChange={(...innerProps) => handleChange(...innerProps, field, form, onChange)}
            onBlur={(event) => handleBlur(event, field, form, onBlur)}
            disabled={form.isSubmitting || form.status?.isFormLocked}
            error={Boolean(meta.touched && meta.error)}
            helperText={meta.touched && meta.error}
            {...props}
            ref={ref}
          />
        );
      }}
    </FastField>
  );
}

export default forwardRef(FormikTextField);
