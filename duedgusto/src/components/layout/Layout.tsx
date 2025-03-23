import { Outlet } from "react-router";
import useBootstrap from "../authentication/useBootstrap";

function Layout() {
  useBootstrap();
  return (
    <div>
      <div>Layout</div>
      <Outlet />
    </div>
  );
}

export default Layout;
