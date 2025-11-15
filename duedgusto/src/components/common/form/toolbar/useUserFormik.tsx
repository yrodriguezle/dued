import { useFormik } from "formik";
import { z } from "zod";

const userSchema = z.object({
  userId: z.number(),
  roleId: z.number().min(1, "L'utente deve avere un Ruolo"),
  userName: z.string().nonempty("Nome utente è obbligatorio"),
  firstName: z.string().nonempty("Nome è obbligatorio"),
  lastName: z.string().nonempty("Cognome è obbligatorio"),
  description: z.string().optional(),
  disabled: z.boolean(),
});

export type UserValues = z.infer<typeof userSchema>;

interface UseUserFormikProps {
  initialValues: UserValues;
  onSubmit: (values: UserValues) => void;
}

function useUserFormik({ initialValues, onSubmit }: UseUserFormikProps) {
  const formik = useFormik<UserValues>({
    initialValues,
    validate: (values) => {
      const result = userSchema.safeParse(values);
      if (result.success) {
        return {};
      }
      return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
    },
    onSubmit,
  });

  return formik;
}

export default useUserFormik;
