import { describe, it, expect } from "vitest";
import { hiddenColumnProperties } from "../datagridUtils";

describe("datagridUtils", () => {
  describe("hiddenColumnProperties", () => {
    it("deve avere hide impostato a true", () => {
      expect(hiddenColumnProperties.hide).toBe(true);
    });

    it("deve avere editable impostato a false", () => {
      expect(hiddenColumnProperties.editable).toBe(false);
    });

    it("deve sopprimere il pannello colonne", () => {
      expect(hiddenColumnProperties.suppressColumnsToolPanel).toBe(true);
    });

    it("deve sopprimere il pannello filtri", () => {
      expect(hiddenColumnProperties.suppressFiltersToolPanel).toBe(true);
    });

    it("deve sopprimere il pulsante menu header", () => {
      expect(hiddenColumnProperties.suppressHeaderMenuButton).toBe(true);
    });

    it("deve avere esattamente 5 proprietà", () => {
      expect(Object.keys(hiddenColumnProperties)).toHaveLength(5);
    });
  });
});
