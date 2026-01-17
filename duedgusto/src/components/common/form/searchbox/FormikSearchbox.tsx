import { FastFieldProps, FieldInputProps, FormikProps } from "formik";
import FastField from "../FastField";
import Searchbox, { SearchboxProps } from "./Searchbox";

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

const getDisabled = <Values,>(disabled: boolean | ((form?: FormikProps<Values>) => boolean) | undefined, form: FormikProps<Values>) => {
  if (typeof disabled === "function") {
    return disabled(form);
  }
  if (typeof disabled === "boolean") {
    return disabled;
  }
  return !!(form.isSubmitting || form.status?.isFormLocked);
};

interface FormikSearchboxProps<Values, T extends Record<string, unknown>> extends Omit<SearchboxProps<T>, "value" | "disabled" | "onChange" | "onBlur"> {
  disabled?: boolean | ((form?: FormikProps<Values>) => boolean);
  onChange?: (name: string, value: string, field: FieldInputProps<string>, form: FormikProps<Values>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>, field: FieldInputProps<string>, form: FormikProps<Values>) => void;
  params?: {
    [key: string]: $FixMe;
  };
}

function FormikSearchbox<Values, T extends Record<string, unknown>>({ name, onChange, onBlur, params, ...props }: FormikSearchboxProps<Values, T>) {
  return (
    <FastField name={name} params={params}>
      {({ field, form, meta }: FastFieldProps) => (
        <Searchbox
          name={field.name}
          onBlur={(event) => handleBlur(event, field, form, onBlur)}
          error={Boolean(meta.touched && meta.error)}
          helperText={meta.touched && meta.error}
          {...props}
          value={field.value}
          onChange={(...innerProps) => handleChange(...innerProps, field, form, onChange)}
          disabled={getDisabled(props.disabled, form)}
        />
      )}
    </FastField>
  );
}

export default FormikSearchbox;
