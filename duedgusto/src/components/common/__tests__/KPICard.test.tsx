import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import KPICard from "../KPICard";

const theme = createTheme();

function renderCard(props: Parameters<typeof KPICard>[0]) {
  return render(
    <ThemeProvider theme={theme}>
      <KPICard {...props} />
    </ThemeProvider>
  );
}

describe("KPICard — variant compact (default, retro-compatibile)", () => {
  it("renderizza label e valore senza prefisso € come prima dell'estensione", () => {
    renderCard({ label: "Totale vendite", value: 930.7 });
    expect(screen.getByText("Totale vendite")).toBeInTheDocument();
    expect(screen.getByText("930,70")).toBeInTheDocument();
    expect(screen.queryByText("€ 930,70")).not.toBeInTheDocument();
  });

  it("non renderizza trend, subtitle o sparkline anche se passati (solo hero)", () => {
    const { container } = renderCard({
      label: "Totale vendite",
      value: 930.7,
      trend: 10,
      subtitle: "Marzo 2026",
      sparklineData: [1, 2, 3],
    });
    expect(screen.queryByText("+10,0%")).not.toBeInTheDocument();
    expect(screen.queryByText("Marzo 2026")).not.toBeInTheDocument();
    expect(container.querySelector(".MuiChartsSurface-root")).toBeNull();
  });

  it("formatta lo zero come 0,00", () => {
    renderCard({ label: "Vuoto", value: 0 });
    expect(screen.getByText("0,00")).toBeInTheDocument();
  });
});

describe("KPICard — variant hero", () => {
  it("renderizza il valore grande con prefisso € e formattazione it-IT", () => {
    renderCard({ label: "Differenza", value: 128450.1, variant: "hero" });
    expect(screen.getByText("€ 128.450,10")).toBeInTheDocument();
  });

  it("mostra l'indicatore di trend con segno e una cifra decimale", () => {
    renderCard({ label: "Differenza", value: 100, variant: "hero", trend: 4.25 });
    expect(screen.getByText("+4,3%")).toBeInTheDocument();
  });

  it("mostra il trend negativo con segno meno", () => {
    renderCard({ label: "Differenza", value: 100, variant: "hero", trend: -12.5 });
    expect(screen.getByText("-12,5%")).toBeInTheDocument();
  });

  it("omette l'indicatore di trend quando trend è undefined", () => {
    renderCard({ label: "Differenza", value: 100, variant: "hero" });
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("mostra il subtitle quando fornito", () => {
    renderCard({ label: "Differenza", value: 100, variant: "hero", subtitle: "Luglio 2026" });
    expect(screen.getByText("Luglio 2026")).toBeInTheDocument();
  });

  it("renderizza la sparkline con almeno 2 valori con dati", () => {
    const { container } = renderCard({
      label: "Differenza",
      value: 100,
      variant: "hero",
      sparklineData: [0, 10, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(container.querySelector(".MuiChartsSurface-root")).not.toBeNull();
  });

  it("omette la sparkline con meno di 2 valori con dati", () => {
    const { container } = renderCard({
      label: "Differenza",
      value: 100,
      variant: "hero",
      sparklineData: [0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(container.querySelector(".MuiChartsSurface-root")).toBeNull();
  });

  it("omette la sparkline senza serie", () => {
    const { container } = renderCard({ label: "Differenza", value: 100, variant: "hero" });
    expect(container.querySelector(".MuiChartsSurface-root")).toBeNull();
  });
});
