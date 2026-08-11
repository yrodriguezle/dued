import { describe, it, expect, beforeEach } from "vitest";

import { larghezzaAnteprima, mediaSrcSet, mediaUrl } from "../mediaUrl";

describe("mediaUrl", () => {
  beforeEach(() => {
    (window as Global).API_ENDPOINT = "https://192.168.1.10:4000";
  });

  it("compone l'indirizzo di una variante dalla sola chiave", () => {
    expect(mediaUrl("2026/08/caffe-a1b2c3", 800)).toBe("https://192.168.1.10:4000/media/2026/08/caffe-a1b2c3/800.webp");
  });

  it("accetta il formato jpg per i browser che non fanno webp", () => {
    expect(mediaUrl("2026/08/caffe-a1b2c3", 400, "jpg")).toBe("https://192.168.1.10:4000/media/2026/08/caffe-a1b2c3/400.jpg");
  });

  it("segue API_ENDPOINT: la chiave non conosce l'ambiente", () => {
    (window as Global).API_ENDPOINT = "https://2dgusto.example";

    expect(mediaUrl("2026/08/caffe-a1b2c3", 1200)).toBe("https://2dgusto.example/media/2026/08/caffe-a1b2c3/1200.webp");
  });
});

describe("mediaSrcSet", () => {
  beforeEach(() => {
    (window as Global).API_ENDPOINT = "https://192.168.1.10:4000";
  });

  it("emette i descrittori w nell'ordine ricevuto dal server", () => {
    expect(mediaSrcSet("2026/08/x-a1b2c3", [400, 800])).toBe(
      "https://192.168.1.10:4000/media/2026/08/x-a1b2c3/400.webp 400w, https://192.168.1.10:4000/media/2026/08/x-a1b2c3/800.webp 800w"
    );
  });

  it("con una sola larghezza non aggiunge separatori", () => {
    expect(mediaSrcSet("2026/08/x-a1b2c3", [300])).toBe("https://192.168.1.10:4000/media/2026/08/x-a1b2c3/300.webp 300w");
  });
});

describe("larghezzaAnteprima", () => {
  it("prende la prima variante che copre la larghezza desiderata", () => {
    expect(larghezzaAnteprima([400, 800, 1200, 1600])).toBe(400);
    expect(larghezzaAnteprima([400, 800], 600)).toBe(800);
  });

  it("ricade sulla più grande esistente quando nessuna arriva alla desiderata", () => {
    // La pipeline non fa upscaling: chiedere 400 a una sorgente da 300 sarebbe un 404.
    expect(larghezzaAnteprima([300])).toBe(300);
  });

  it("restituisce null se non esiste alcuna variante", () => {
    expect(larghezzaAnteprima([])).toBeNull();
  });
});
