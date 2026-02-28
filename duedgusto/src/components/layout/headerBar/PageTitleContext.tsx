import { createContext } from "react";

const PageTitleContext = createContext<{
  title: string;
  setTitle: (t: string) => void;
}>({ title: "", setTitle: () => {} });

export default PageTitleContext;
