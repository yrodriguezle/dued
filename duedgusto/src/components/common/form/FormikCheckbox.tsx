import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox, { CheckboxProps } from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import FastField from "./FastField";
import { FastFieldProps, FieldInputProps, FormikProps } from "formik";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type $FixMe = any;

const handleChange = <Values,>(
  event: React.ChangeEvent<HTMLInputElement>,
  field: FieldInputProps<boolean>,
  form: FormikProps<Values>,
  onChange?: (
    name: string,
    value: boolean,
    field: FieldInputProps<boolean>,
    form: FormikProps<Values>
  ) => void
) => {
  if (onChange && typeof onChange === "function") {
    onChange(field.name, event.target.checked, field, form);
    return;
  }

  if (typeof field.value === "boolean") {
    form.setFieldValue(field.name, event.target.checked);
  } else {
    form.setFieldValue(field.name, event.target.checked ? 1 : 0);
  }
};

interface FormikCheckboxProps<Values>
  extends Omit<CheckboxProps, "onChange" | "onBlur"> {
  name: string;
  label: string;
  onChange?: (
    name: string,
    value: boolean,
    field: FieldInputProps<boolean>,
    form: FormikProps<Values>
  ) => void;
  // onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>, field: FieldInputProps<boolean>, form: FormikProps<Values>) => void
  params?: {
    [key: string]: $FixMe;
  };
}

function FormikCheckbox<Values>({
  name,
  label,
  params,
  onChange,
  ...props
}: FormikCheckboxProps<Values>) {
  return (
    <FastField name={name} params={{ params }}>
      {({ field, form }: FastFieldProps) => (
        <FormControlLabel
          control={
            <Checkbox
              id={field.name}
              checked={Boolean(field.value)}
              onChange={(event) => handleChange(event, field, form, onChange)}
              color="primary"
              disabled={form.isSubmitting}
              {...props}
            />
          }
          label={<Typography variant="body1">{label}</Typography>}
        />
      )}
    </FastField>
  );
}

export default FormikCheckbox;
