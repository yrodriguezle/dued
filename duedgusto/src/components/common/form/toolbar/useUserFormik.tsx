import { useFormik } from "formik";
import { z } from "zod";

const UserSchema = z.object({
  userId: z.number(),
  roleId: z.number().min(1, "L'utente deve avere un Ruolo"),
  userName: z.string().nonempty("Nome utente è obbligatorio"),
  firstName: z.string().nonempty("Nome è obbligatorio"),
  lastName: z.string().nonempty("Cognome è obbligatorio"),
  description: z.string().optional(),
  disabled: z.boolean(),
});

export type UserValues = z.infer<typeof UserSchema>;

function useUserFormik() {
  const formik = useFormik<UserValues>({
    initialValues,
    validationSchema: toFormikValidationSchema(userSchema),
    onSubmit: (values) => {
      onSubmit(values);
    },
  });
}

export default useUserFormik;
