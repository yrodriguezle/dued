import { Route, Routes } from "react-router-dom"
import Layout from "../components/layout/Layout"
import HomePage from "../components/pages/HomePage"

function ProtectedRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
      </Route>
    </Routes>
  )
}

export default ProtectedRoutes