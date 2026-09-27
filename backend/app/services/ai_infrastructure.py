import json
import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


def generate_infrastructure_plan(
    user_request: str,
) -> dict:
    """
    Convert a natural-language infrastructure request
    into a structured CloudForge infrastructure plan.

    The AI only creates the architecture plan.
    It does NOT generate or execute Terraform directly.
    """

    prompt = f"""
You are CloudForge AI, an infrastructure planning assistant.

Convert the user's cloud infrastructure request into
a structured JSON infrastructure plan.

User request:
{user_request}

Return ONLY valid JSON.

Use exactly this structure:

{{
  "cloud_provider": "AWS",
  "region": "ap-south-1",
  "environment": "development",
  "architecture": {{
    "network": {{
      "vpc": true,
      "public_subnets": 1,
      "private_subnets": 1
    }},
    "compute": {{
      "service": "EC2",
      "count": 1
    }},
    "database": {{
      "service": "RDS",
      "engine": "postgresql"
    }}
  }}
}}

Rules:

1. cloud_provider must be AWS unless the user explicitly requests another provider.
2. region must be a valid AWS region.
3. environment must be one of:
   development, staging, production.
4. Do not invent services that the user did not request unless they are required by the architecture.
5. Do not include explanations outside the JSON.
6. Return valid JSON only.

"""


    response = requests.post(
        OLLAMA_URL,
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        },
        timeout=120,
    )


    response.raise_for_status()


    result = response.json()


    raw_response = result.get(
        "response",
        ""
    )


    try:

        infrastructure_plan = json.loads(
            raw_response
        )

    except json.JSONDecodeError as error:

        raise ValueError(
            "Ollama returned invalid JSON"
        ) from error


    return infrastructure_plan