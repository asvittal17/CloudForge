const API_BASE_URL = "http://localhost:8000"


// ========================================
// Authentication API
// ========================================

export async function login(
  email: string,
  password: string
) {
  const response = await fetch(
    `${API_BASE_URL}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail || "Login failed"
    )
  }

  return data
}


// ========================================
// Projects API
// ========================================

export async function getProjects() {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/projects/`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to fetch projects"
    )
  }

  return data
}


export async function createProject(
  name: string,
  description: string
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/projects/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        description,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to create project"
    )
  }

  return data
}


// ========================================
// Infrastructure API
// ========================================

export async function getInfrastructure(
  projectId: number
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/infrastructure/${projectId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to fetch infrastructure"
    )
  }

  return data
}


export async function createInfrastructure(
  projectId: number,
  cloudProvider: string,
  region: string,
  environment: string,
  architecture: string
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/infrastructure/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        cloud_provider: cloudProvider,
        region,
        environment,
        architecture,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to create infrastructure"
    )
  }

  return data
}


// ========================================
// Update Infrastructure API
// ========================================

export async function updateInfrastructure(
  projectId: number,
  cloudProvider: string,
  region: string,
  environment: string,
  architecture: string
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/infrastructure/${projectId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        cloud_provider: cloudProvider,
        region,
        environment,
        architecture,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to update infrastructure"
    )
  }

  return data
}


// ========================================
// Terraform API
// ========================================

export async function generateTerraform(
  projectId: number
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/terraform/${projectId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to generate Terraform"
    )
  }

  return data
}


// ========================================
// Terraform Validation API
// ========================================

export async function validateTerraform(
  projectId: number
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/terraform/${projectId}/validate`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to validate Terraform"
    )
  }

  return data
}


// ========================================
// Terraform Plan API
// ========================================

export async function planTerraform(
  projectId: number
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/terraform/${projectId}/plan`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to generate Terraform plan"
    )
  }

  return data
}


// ========================================
// Stage Terraform API
// ========================================

export async function stageTerraform(
  projectId: number,
  terraform: {
    main_tf: string
    variables_tf: string
    outputs_tf: string
  }
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/terraform/${projectId}/stage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(terraform),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to stage Terraform"
    )
  }

  return data
}


// ========================================
// Staged Terraform Plan API
// ========================================

export async function planStagedTerraform(
  projectId: number,
  artifactId: number
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/terraform/${projectId}/artifacts/${artifactId}/plan`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to generate staged Terraform plan"
    )
  }

  return data
}


// ========================================
// AI Terraform Generation API
// ========================================

export async function generateAITerraform(
  aiPlan: {
    cloud_provider: string
    region: string
    environment: string
    architecture: Record<string, unknown>
  }
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/ai/terraform`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(aiPlan),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to generate Terraform from AI architecture"
    )
  }

  return data
}
// ========================================
// Terraform Approval API
// ========================================

export async function approveTerraform(
  projectId: number,
  artifactId: number
) {
  const token = localStorage.getItem(
    "access_token"
  )

  const response = await fetch(
    `${API_BASE_URL}/terraform/${projectId}/artifacts/${artifactId}/approve`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
      "Failed to approve Terraform"
    )
  }

  return data
}
export async function applyTerraform(
  projectId: number,
  artifactId: number,
  databasePassword?: string
) {
  const token = localStorage.getItem("access_token")

  const url = new URL(
    `${API_BASE_URL}/terraform/${projectId}/artifacts/${artifactId}/apply`
  )

  if (databasePassword) {
    url.searchParams.set("database_password", databasePassword)
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail || "Failed to deploy Terraform infrastructure"
    )
  }

  return data
}