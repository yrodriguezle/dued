import { Outlet } from "react-router";
import useBootstrap from "../authentication/useBootstrap";
import HeaderBar from "./headerBar/HeaderBar";

function Layout() {
  useBootstrap();

  return (
    <div>
      <HeaderBar />
      <div>Layout</div>
      <Outlet />
    </div>
  );
}

export default Layout;
