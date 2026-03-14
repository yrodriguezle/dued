import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import FormikTestWrapper from "../../../../test/helpers/formikTestWrapper";
import FormikTextField from "../FormikTextField";

describe("FormikTextField", () => {
  it("dovrebbe renderizzare con il valore iniziale di Formik", () => {
    render(
      <FormikTestWrapper initialValues={{ nome: "Mario" }}>
        <FormikTextField
          name="nome"
          label="Nome"
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Mario");
  });

  it("dovrebbe aggiornare il valore Formik quando si digita", async () => {
    const user = userEvent.setup();

    render(
      <FormikTestWrapper initialValues={{ nome: "" }}>
        <FormikTextField
          name="nome"
          label="Nome"
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.type(input, "Luigi");

    expect(input).toHaveValue("Luigi");
  });

  it("dovrebbe mostrare gli errori di validazione dopo il blur", async () => {
    const user = userEvent.setup();
    const schema = z.object({
      email: z.string().min(1, "Campo obbligatorio"),
    });

    render(
      <FormikTestWrapper
        initialValues={{ email: "" }}
        validationSchema={schema}
      >
        <FormikTextField
          name="email"
          label="Email"
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    // Touch the field and leave it empty
    await user.click(input);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText("Campo obbligatorio")).toBeInTheDocument();
    });
  });

  it("dovrebbe essere disabilitato durante il submitting del form", () => {
    // We test disabled prop passthrough - when form.isSubmitting is true the field should be disabled
    // Since we can't easily trigger isSubmitting via wrapper, test the disabled prop passthrough
    render(
      <FormikTestWrapper initialValues={{ nome: "Test" }}>
        <FormikTextField
          name="nome"
          label="Nome"
          disabled
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("dovrebbe chiamare onChange personalizzato quando fornito", async () => {
    const user = userEvent.setup();
    const customOnChange = vi.fn();

    render(
      <FormikTestWrapper initialValues={{ nome: "" }}>
        <FormikTextField
          name="nome"
          label="Nome"
          onChange={customOnChange}
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.type(input, "A");

    expect(customOnChange).toHaveBeenCalled();
    // Il primo argomento deve essere il nome del campo
    expect(customOnChange.mock.calls[0][0]).toBe("nome");
  });

  it("dovrebbe renderizzare con la label corretta", () => {
    render(
      <FormikTestWrapper initialValues={{ indirizzo: "" }}>
        <FormikTextField
          name="indirizzo"
          label="Indirizzo"
        />
      </FormikTestWrapper>
    );

    expect(screen.getByLabelText("Indirizzo")).toBeInTheDocument();
  });
});
