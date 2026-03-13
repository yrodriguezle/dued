import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormikTestWrapper from "../../../../test/helpers/formikTestWrapper";
import FormikCheckbox from "../FormikCheckbox";

describe("FormikCheckbox", () => {
  it("dovrebbe renderizzare con stato iniziale unchecked (false)", () => {
    render(
      <FormikTestWrapper initialValues={{ attivo: false }}>
        <FormikCheckbox name="attivo" label="Attivo" />
      </FormikTestWrapper>
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("dovrebbe renderizzare con stato iniziale checked (true)", () => {
    render(
      <FormikTestWrapper initialValues={{ attivo: true }}>
        <FormikCheckbox name="attivo" label="Attivo" />
      </FormikTestWrapper>
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("dovrebbe aggiornare il valore Formik al toggle", async () => {
    const user = userEvent.setup();

    render(
      <FormikTestWrapper initialValues={{ attivo: false }}>
        <FormikCheckbox name="attivo" label="Attivo" />
      </FormikTestWrapper>
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    // Click per attivare
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    // Click per disattivare
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("dovrebbe mostrare la label correttamente", () => {
    render(
      <FormikTestWrapper initialValues={{ newsletter: false }}>
        <FormikCheckbox name="newsletter" label="Iscriviti alla newsletter" />
      </FormikTestWrapper>
    );

    expect(screen.getByText("Iscriviti alla newsletter")).toBeInTheDocument();
  });

  it("dovrebbe chiamare onChange personalizzato quando fornito", async () => {
    const user = userEvent.setup();
    const customOnChange = vi.fn();

    render(
      <FormikTestWrapper initialValues={{ attivo: false }}>
        <FormikCheckbox name="attivo" label="Attivo" onChange={customOnChange} />
      </FormikTestWrapper>
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(customOnChange).toHaveBeenCalledTimes(1);
    // Verifica che il nome del campo sia passato come primo argomento
    expect(customOnChange.mock.calls[0][0]).toBe("attivo");
    // Verifica che il valore booleano sia passato come secondo argomento
    expect(customOnChange.mock.calls[0][1]).toBe(true);
  });
});
