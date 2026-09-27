import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom"

import { ThemeProvider } from "./context/ThemeContext"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import ProjectDetails from "./pages/ProjectDetails"
import Terraform from "./pages/Terraform"
import AIInfrastructure from "./pages/AIInfrastructure"

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Authentication */}
          <Route path="/login" element={<Login />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Project Details */}
          <Route path="/projects/:projectId" element={<ProjectDetails />} />

          {/* Terraform Generator */}
          <Route
            path="/projects/:projectId/terraform"
            element={<Terraform />}
          />

          {/* AI Infrastructure */}
          <Route
            path="/projects/:projectId/ai"
            element={<AIInfrastructure />}
          />

          {/* Default */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App