import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom"

import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import ProjectDetails from "./pages/ProjectDetails"
import Terraform from "./pages/Terraform"
import AIInfrastructure from "./pages/AIInfrastructure"


function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* Authentication */}

        <Route
          path="/login"
          element={<Login />}
        />


        {/* Dashboard */}

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />


        {/* Project Details */}

        <Route
          path="/projects/:projectId"
          element={<ProjectDetails />}
        />


        {/* Terraform Generator */}

        <Route
          path="/projects/:projectId/terraform"
          element={<Terraform />}
        />


        {/* Default */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        <Route
  path="/projects/:projectId/ai"
  element={<AIInfrastructure />}
/>

      </Routes>

    </BrowserRouter>
  )
}


export default App