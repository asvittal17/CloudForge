/* eslint-disable @typescript-eslint/no-explicit-any */
export const API_BASE_URL = "http://localhost:8000"


// ========================================
// Shared request helper
// ========================================

export class ApiError extends Error {
  status: number
  requestId: string | null

  constructor(message: string, status: number, requestId: string | null) {
    super(message)
    this.status = status
    this.requestId = requestId
  }
}

export function getToken(): string | null {
  return localStorage.getItem("access_token")
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token)
}

export function clearToken() {
  localStorage.removeItem("access_token")
}

async function request<T = any>(
  path: string,
  options: {
    method?: string
    body?: unknown
    auth?: boolean
  } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options

  const headers: Record<string, string> = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  }

  if (auth) {
    const token = getToken()
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    window.dispatchEvent(
      new CustomEvent("cloudforge:api-error", {
        detail: { message: `Cannot reach the CloudForge API on port 8000 [${method} ${path}]`, status: 0 },
      }),
    )
    throw new ApiError(
      "Cannot reach the CloudForge API. Check that the backend is running on port 8000.",
      0,
      null,
    )
  }

  let data: Record<string, unknown>
  try {
    data = await response.json()
  } catch {
    data = {}
  }

  if (!response.ok) {
    const detail = data.detail
    const message =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object"
          ? JSON.stringify(detail)
          : `Request failed with HTTP ${response.status}`

    // Report server-side failures and network problems to monitoring.
    // Regular 4xx validation errors are normal API usage, not incidents.
    if (response.status >= 500 || response.status === 0) {
      window.dispatchEvent(
        new CustomEvent("cloudforge:api-error", {
          detail: { message: `${message} [${method} ${path}]`, status: response.status },
        }),
      )
    }

    throw new ApiError(message, response.status, (data.request_id as string) ?? null)
  }

  return data as T
}


// ========================================
// Authentication API
// ========================================

export interface Me {
  id: number
  name: string
  email: string
  role: "user" | "admin"
}

export async function login(email: string, password: string) {
  const data = await request<{ access_token: string; token_type: string }>(
    "/auth/login",
    { method: "POST", body: { email, password }, auth: false },
  )
  setToken(data.access_token)
  return data
}

export async function register(name: string, email: string, password: string) {
  return request<{ id: number; name: string; email: string; message: string }>(
    "/auth/register",
    { method: "POST", body: { name, email, password }, auth: false },
  )
}

export function getMe() {
  return request<Me>("/auth/me")
}

export function logout() {
  clearToken()
}


// ========================================
// Health API
// ========================================

export interface HealthSnapshot {
  status: "healthy" | "degraded" | "unhealthy" | "unknown"
  api: { status: string; message: string }
  database: { status: string; message: string; latency_ms: number | null }
  ollama: {
    status: string
    message: string
    latency_ms: number | null
    model_available?: boolean
  }
  checked_at: string
}

export function getHealth() {
  return request<HealthSnapshot>("/health", { auth: false })
}


// ========================================
// Projects API
// ========================================

export interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
}

export function getProjects() {
  return request<Project[]>("/projects/")
}

export function createProject(name: string, description: string) {
  return request<Project>("/projects/", { method: "POST", body: { name, description } })
}

export function getProject(projectId: number) {
  return request<Project>(`/projects/${projectId}`)
}

export function deleteProject(projectId: number) {
  return request(`/projects/${projectId}`, { method: "DELETE" })
}

export interface ProjectsSummary {
  projects: number
  infrastructure: number
  artifacts: number
  artifacts_staged: number
  artifacts_plan_ready: number
  artifacts_approved: number
  artifacts_deployed: number
  recent_activity: Array<{
    kind: string
    label: string
    status?: string
    project_id: number
    created_at: string
  }>
  generated_at: string
}

export function getProjectsSummary() {
  return request<ProjectsSummary>("/projects/summary")
}


// ========================================
// Infrastructure API
// ========================================

export function getInfrastructure(projectId: number) {
  return request(`/infrastructure/${projectId}`)
}

export function createInfrastructure(
  projectId: number,
  cloudProvider: string,
  region: string,
  environment: string,
  architecture: string,
) {
  return request("/infrastructure/", {
    method: "POST",
    body: {
      project_id: projectId,
      cloud_provider: cloudProvider,
      region,
      environment,
      architecture,
    },
  })
}

export function updateInfrastructure(
  projectId: number,
  cloudProvider: string,
  region: string,
  environment: string,
  architecture: string,
) {
  return request(`/infrastructure/${projectId}`, {
    method: "PUT",
    body: { cloud_provider: cloudProvider, region, environment, architecture },
  })
}


// ========================================
// Terraform API
// ========================================

export function generateTerraform(projectId: number) {
  return request(`/terraform/${projectId}`)
}

export function validateTerraform(projectId: number) {
  return request(`/terraform/${projectId}/validate`)
}

export function planTerraform(projectId: number) {
  return request(`/terraform/${projectId}/plan`)
}

export function stageTerraform(
  projectId: number,
  terraform: { main_tf: string; variables_tf: string; outputs_tf: string },
) {
  return request(`/terraform/${projectId}/stage`, {
    method: "POST",
    body: terraform,
  })
}

export function planStagedTerraform(projectId: number, artifactId: number) {
  return request(`/terraform/${projectId}/artifacts/${artifactId}/plan`, {
    method: "POST",
  })
}

export function approveTerraform(projectId: number, artifactId: number) {
  return request(`/terraform/${projectId}/artifacts/${artifactId}/approve`, {
    method: "POST",
  })
}

export function applyTerraform(
  projectId: number,
  artifactId: number,
  databasePassword?: string,
) {
  let path = `/terraform/${projectId}/artifacts/${artifactId}/apply`
  if (databasePassword) {
    path += `?database_password=${encodeURIComponent(databasePassword)}`
  }
  return request(path, { method: "POST" })
}

export function getArtifact(projectId: number, artifactId: number) {
  return request(`/terraform/${projectId}/artifacts/${artifactId}`)
}

export function getLatestArtifact(projectId: number) {
  return request(`/terraform/${projectId}/artifacts/latest`)
}


// ========================================
// Terraform Security Scanner API
// ========================================

export interface TerraformSecurityFinding {
  check_id: string
  check_name: string
  severity: string
  recommendation_priority?: string
  remediation_title?: string
  why_it_matters?: string
  remediation_context?: string
  resource: string
  file_path: string
  file_line_range?: number[]
  guideline?: string
  recommendation?: string
}

export interface TerraformSecurityScanResponse {
  project_id: number
  project_name: string
  artifact_id: number
  artifact_status: string
  success: boolean
  passed: boolean
  summary: { passed: number; failed: number; skipped: number; total: number }
  findings: TerraformSecurityFinding[]
}

export function scanTerraformSecurity(
  projectId: number,
  artifactId: number,
): Promise<TerraformSecurityScanResponse> {
  return request<TerraformSecurityScanResponse>(
    `/terraform/${projectId}/artifacts/${artifactId}/security-scan`,
    { method: "POST" },
  )
}


// ========================================
// AI API
// ========================================

export function generateAIInfrastructure(userRequest: string) {
  return request("/ai/infrastructure", {
    method: "POST",
    body: { user_request: userRequest },
  })
}

export function generateAITerraform(
  aiPlan: {
    cloud_provider: string
    region: string
    environment: string
    architecture: Record<string, unknown>
  },
) {
  return request("/ai/terraform", { method: "POST", body: aiPlan })
}


// ========================================
// Admin Console API (server-verified admin role required)
// ========================================

export interface AdminStats {
  users_total: number
  users_active: number
  admins_total: number
  projects_total: number
  infrastructure_total: number
  artifacts_total: number
  artifacts_deployed: number
  errors_open: number
}

export interface AdminUserRow {
  id: number
  name: string
  email: string
  role: "user" | "admin"
  is_active: boolean
  created_at: string
  project_count: number
  artifact_count: number
}

export function getAdminStats() {
  return request<AdminStats>("/admin/stats")
}

export interface AdminUsersQuery {
  search?: string
  role?: string
  is_active?: boolean | undefined
  sort_by?: string
  order?: "asc" | "desc"
  page?: number
  page_size?: number
}

export function getAdminUsers(query: AdminUsersQuery = {}) {
  const params = new URLSearchParams()
  if (query.search) params.set("search", query.search)
  if (query.role) params.set("role", query.role)
  if (query.is_active !== undefined) params.set("is_active", String(query.is_active))
  if (query.sort_by) params.set("sort_by", query.sort_by)
  if (query.order) params.set("order", query.order)
  params.set("page", String(query.page ?? 1))
  params.set("page_size", String(query.page_size ?? 20))
  return request<{
    total: number
    page: number
    page_size: number
    items: AdminUserRow[]
  }>(`/admin/users?${params.toString()}`)
}

export function updateUserRole(userId: number, role: "user" | "admin") {
  return request(`/admin/users/${userId}/role`, { method: "PATCH", body: { role } })
}

export function updateUserStatus(userId: number, isActive: boolean) {
  return request(`/admin/users/${userId}/status`, { method: "PATCH", body: { is_active: isActive } })
}


// ========================================
// Monitoring API
// ========================================

export interface MonitoringSummary {
  health: HealthSnapshot
  users_total: number
  users_active: number
  projects_total: number
  infrastructure_total: number
  artifacts_total: number
  artifacts_deployed: number
  errors_24h: {
    total: number
    critical: number
    error: number
    warning: number
    info: number
    open: number
  }
}

export function getMonitoringSummary() {
  return request<MonitoringSummary>("/monitoring/summary")
}

export interface ErrorEventRow {
  id: number
  created_at: string
  last_seen_at: string
  source: string
  severity: string
  category: string
  route: string | null
  http_method: string | null
  http_status: number | null
  request_id: string | null
  user_id: number | null
  message: string
  occurrences: number
  resolution_status: string
}

export interface ErrorEventsQuery {
  source?: string
  severity?: string
  resolution_status?: string
  hours?: number
  search?: string
  page?: number
  page_size?: number
}

export function getErrorEvents(query: ErrorEventsQuery = {}) {
  const params = new URLSearchParams()
  if (query.source) params.set("source", query.source)
  if (query.severity) params.set("severity", query.severity)
  if (query.resolution_status) params.set("resolution_status", query.resolution_status)
  params.set("hours", String(query.hours ?? 168))
  if (query.search) params.set("search", query.search)
  params.set("page", String(query.page ?? 1))
  params.set("page_size", String(query.page_size ?? 25))
  return request<{
    total: number
    page: number
    page_size: number
    items: ErrorEventRow[]
  }>(`/monitoring/errors?${params.toString()}`)
}

export function getErrorEventDetail(id: number) {
  return request<ErrorEventRow & { stack_trace: string | null }>(
    `/monitoring/errors/${id}`,
  )
}

export function updateErrorResolution(
  id: number,
  resolutionStatus: "open" | "acknowledged" | "resolved",
) {
  return request(`/monitoring/errors/${id}`, {
    method: "PATCH",
    body: { resolution_status: resolutionStatus },
  })
}


/* ========================================
   Frontend error reporting (monitoring ingest)
======================================== */

export function reportFrontendError(payload: {
  message: string
  category: string
  severity: string
  route?: string
  stack?: string
  request_id?: string
}) {
  // Fire-and-forget: reporting failures must never break the app.
  fetch(`${API_BASE_URL}/monitoring/frontend-errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}
