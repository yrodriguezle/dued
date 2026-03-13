/**
 * Formik Test Wrapper
 *
 * Fornisce un wrapper Formik per testare componenti form
 * che dipendono dal contesto Formik (FormikTextField, FormikCheckbox, ecc.)
 */
import { ReactNode } from "react";
import { Formik, Form, FormikValues, FormikHelpers } from "formik";
import { ZodSchema } from "zod";

interface FormikTestWrapperProps<T extends FormikValues> {
  initialValues: T;
  validationSchema?: ZodSchema;
  onSubmit?: (values: T, helpers: FormikHelpers<T>) => void;
  children: ReactNode;
}

/**
 * Wrapper Formik per i test.
 * Avvolge i children in un contesto Formik con i valori iniziali forniti.
 */
export const FormikTestWrapper = <T extends FormikValues>({
  initialValues,
  validationSchema,
  onSubmit = () => {},
  children,
}: FormikTestWrapperProps<T>) => {
  // Se abbiamo un validationSchema Zod, lo convertiamo nel formato compatibile con Formik
  const validate = validationSchema
    ? (values: T) => {
        const result = validationSchema.safeParse(values);
        if (result.success) return {};
        const errors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          const path = err.path.join(".");
          errors[path] = err.message;
        });
        return errors;
      }
    : undefined;

  return (
    <Formik initialValues={initialValues} validate={validate} onSubmit={onSubmit}>
      <Form>{children}</Form>
    </Formik>
  );
};

export default FormikTestWrapper;
