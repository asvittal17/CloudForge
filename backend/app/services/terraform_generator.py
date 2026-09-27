import json

from app.models.infrastructure import Infrastructure


# ============================================================
# Generate Terraform From Database Infrastructure
# ============================================================

def generate_terraform(infrastructure: Infrastructure) -> dict[str, str]:
    """
    Generate baseline Terraform configuration from
    a CloudForge Infrastructure database record.
    """

    cloud_provider = infrastructure.cloud_provider
    region = infrastructure.region
    environment = infrastructure.environment

    if cloud_provider.lower() != "aws":
        raise ValueError(
            "Terraform generation currently supports AWS only."
        )

    # --------------------------------------------------------
    # Main Terraform configuration
    # --------------------------------------------------------

    main_tf = f'''
terraform {{
  required_version = ">= 1.5.0"

  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }}
  }}
}}

provider "aws" {{
  region = var.aws_region
}}

resource "aws_vpc" "main" {{
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {{
    Name        = "${{var.project_name}}-vpc"
    Environment = var.environment
  }}
}}

resource "aws_internet_gateway" "main" {{
  vpc_id = aws_vpc.main.id

  tags = {{
    Name        = "${{var.project_name}}-igw"
    Environment = var.environment
  }}
}}

resource "aws_subnet" "public" {{
  vpc_id = aws_vpc.main.id

  cidr_block = "10.0.1.0/24"

  availability_zone = "${{var.aws_region}}a"

  map_public_ip_on_launch = true

  tags = {{
    Name        = "${{var.project_name}}-public-subnet"
    Environment = var.environment
  }}
}}

resource "aws_route_table" "public" {{
  vpc_id = aws_vpc.main.id

  route {{
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }}

  tags = {{
    Name        = "${{var.project_name}}-public-route-table"
    Environment = var.environment
  }}
}}

resource "aws_route_table_association" "public" {{
  subnet_id = aws_subnet.public.id

  route_table_id = aws_route_table.public.id
}}

resource "aws_security_group" "app" {{
  name        = "${{var.project_name}}-app-sg"
  description = "Security group for CloudForge application"
  vpc_id      = aws_vpc.main.id

  ingress {{
    description = "HTTP"

    from_port = 80
    to_port   = 80
    protocol  = "tcp"

    cidr_blocks = ["0.0.0.0/0"]
  }}

  ingress {{
    description = "HTTPS"

    from_port = 443
    to_port   = 443
    protocol  = "tcp"

    cidr_blocks = ["0.0.0.0/0"]
  }}

  egress {{
    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = ["0.0.0.0/0"]
  }}

  tags = {{
    Name        = "${{var.project_name}}-app-sg"
    Environment = var.environment
  }}
}}
'''

    # --------------------------------------------------------
    # Variables
    # --------------------------------------------------------

    variables_tf = f'''
variable "project_name" {{
  description = "CloudForge project name"
  type        = string
  default     = "cloudforge-project"
}}

variable "aws_region" {{
  description = "AWS deployment region"
  type        = string
  default     = "{region}"
}}

variable "environment" {{
  description = "Deployment environment"
  type        = string
  default     = "{environment}"
}}
'''

    # --------------------------------------------------------
    # Outputs
    # --------------------------------------------------------

    outputs_tf = '''
output "vpc_id" {
  description = "ID of the CloudForge VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "ID of the public subnet"
  value       = aws_subnet.public.id
}

output "security_group_id" {
  description = "ID of the application security group"
  value       = aws_security_group.app.id
}
'''

    return {
        "main.tf": main_tf,
        "variables.tf": variables_tf,
        "outputs.tf": outputs_tf,
    }


# ============================================================
# Generate Terraform From AI Architecture
# ============================================================

def generate_terraform_from_ai_plan(
    ai_plan: dict,
) -> dict[str, str]:
    """
    Generate Terraform configuration from a
    structured CloudForge AI infrastructure plan.

    AI does NOT generate Terraform directly.

    AI architecture
            ↓
    Deterministic Terraform generator
            ↓
    Terraform files
    """

    cloud_provider = ai_plan.get(
        "cloud_provider",
        "AWS",
    )

    region = ai_plan.get(
        "region",
        "ap-south-1",
    )

    environment = ai_plan.get(
        "environment",
        "development",
    )

    architecture = ai_plan.get(
        "architecture",
        {},
    )

    network = architecture.get(
        "network",
        {},
    )

    compute = architecture.get(
        "compute",
        {},
    )

    database = architecture.get(
        "database",
        {},
    )

    # ========================================================
    # Provider validation
    # ========================================================

    if cloud_provider.lower() != "aws":
        raise ValueError(
            "AI Terraform generation currently supports AWS only."
        )

    # ========================================================
    # Network validation
    # ========================================================

    vpc_enabled = bool(
        network.get("vpc", True)
    )

    public_subnets = int(
        network.get("public_subnets", 1)
    )

    private_subnets = int(
        network.get("private_subnets", 1)
    )

    if not vpc_enabled:
        raise ValueError(
            "CloudForge requires a VPC for this architecture."
        )

    if public_subnets < 1:
        raise ValueError(
            "At least one public subnet is required."
        )

    if private_subnets < 1:
        raise ValueError(
            "At least one private subnet is required."
        )

    if public_subnets > 3 or private_subnets > 3:
        raise ValueError(
            "CloudForge currently supports up to 3 public and 3 private subnets."
        )

    # ========================================================
    # Compute validation
    # ========================================================

    compute_service = str(
        compute.get("service", "EC2")
    ).upper()

    compute_count = int(
        compute.get("count", 1)
    )

    if compute_service != "EC2":
        raise ValueError(
            "AI Terraform generation currently supports EC2 compute."
        )

    if compute_count < 1:
        raise ValueError(
            "EC2 instance count must be at least 1."
        )

    # ========================================================
    # Database validation
    # ========================================================

    database_service = str(
        database.get("service", "")
    ).upper()

    database_engine = str(
        database.get("engine", "")
    ).lower()

    if database_service not in ("", "RDS"):
        raise ValueError(
            "AI Terraform generation currently supports RDS databases."
        )

    if (
        database_service == "RDS"
        and database_engine != "postgresql"
    ):
        raise ValueError(
            "Currently only PostgreSQL RDS databases are supported."
        )

    # ========================================================
    # Main Terraform
    # ========================================================

    main_tf = """
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "${var.project_name}-vpc"
    Environment = var.environment
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-igw"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count = PUBLIC_SUBNET_COUNT

  vpc_id = aws_vpc.main.id

  cidr_block = cidrsubnet(
    aws_vpc.main.cidr_block,
    8,
    count.index
  )

  availability_zone = "${var.aws_region}${element(
    ["a", "b", "c"],
    count.index
  )}"

  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project_name}-public-${count.index + 1}"
    Environment = var.environment
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  count = PRIVATE_SUBNET_COUNT

  vpc_id = aws_vpc.main.id

  cidr_block = cidrsubnet(
    aws_vpc.main.cidr_block,
    8,
    count.index + 10
  )

  availability_zone = "${var.aws_region}${element(
    ["a", "b", "c"],
    count.index
  )}"

  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-private-${count.index + 1}"
    Environment = var.environment
    Tier        = "private"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${var.project_name}-public-route-table"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public" {
  count = PUBLIC_SUBNET_COUNT

  subnet_id = aws_subnet.public[count.index].id

  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg"
  description = "Security group for CloudForge application servers"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"

    from_port = 80
    to_port   = 80
    protocol  = "tcp"

    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"

    from_port = 443
    to_port   = 443
    protocol  = "tcp"

    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-app-sg"
    Environment = var.environment
  }
}

DATABASE_SECURITY_GROUP

data "aws_ami" "ubuntu" {
  most_recent = true

  owners = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_instance" "app" {
  count = COMPUTE_COUNT

  ami = data.aws_ami.ubuntu.id

  instance_type = "t3.micro"

  subnet_id = aws_subnet.public[
    count.index % PUBLIC_SUBNET_COUNT
  ].id

  vpc_security_group_ids = [
    aws_security_group.app.id
  ]

  associate_public_ip_address = true

  tags = {
    Name        = "${var.project_name}-app-${count.index + 1}"
    Environment = var.environment
    Role        = "application"
  }
}

DATABASE_RESOURCES
"""

    # ========================================================
    # Database Security Group + RDS
    # ========================================================

    if database_service == "RDS":

        database_security_group = """
resource "aws_security_group" "database" {
  name        = "${var.project_name}-database-sg"
  description = "Security group for CloudForge PostgreSQL database"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "PostgreSQL from application servers"

    from_port = 5432
    to_port   = 5432
    protocol  = "tcp"

    security_groups = [
      aws_security_group.app.id
    ]
  }

  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-database-sg"
    Environment = var.environment
  }
}
"""

        database_resources = """
resource "aws_db_subnet_group" "database" {
  name = "${var.project_name}-database-subnet-group"

  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name        = "${var.project_name}-database-subnet-group"
    Environment = var.environment
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-postgres"

  engine = "postgres"

  engine_version = "16"

  instance_class = "db.t3.micro"

  allocated_storage = 20

  storage_type = "gp3"

  db_name = "cloudforge"

  username = "cloudforge"

  password = var.database_password

  db_subnet_group_name = aws_db_subnet_group.database.name

  vpc_security_group_ids = [
    aws_security_group.database.id
  ]

  publicly_accessible = false

  skip_final_snapshot = true

  deletion_protection = false

  tags = {
    Name        = "${var.project_name}-postgres"
    Environment = var.environment
  }
}
"""

    else:
        database_security_group = ""
        database_resources = ""

    # ========================================================
    # Replace placeholders
    # ========================================================

    main_tf = main_tf.replace(
        "PUBLIC_SUBNET_COUNT",
        str(public_subnets),
    )

    main_tf = main_tf.replace(
        "PRIVATE_SUBNET_COUNT",
        str(private_subnets),
    )

    main_tf = main_tf.replace(
        "COMPUTE_COUNT",
        str(compute_count),
    )

    main_tf = main_tf.replace(
        "DATABASE_SECURITY_GROUP",
        database_security_group,
    )

    main_tf = main_tf.replace(
        "DATABASE_RESOURCES",
        database_resources,
    )

    # ========================================================
    # Variables
    # ========================================================

    variables_tf = f"""
variable "project_name" {{
  description = "CloudForge project name"
  type        = string
  default     = "cloudforge-project"
}}

variable "aws_region" {{
  description = "AWS deployment region"
  type        = string
  default     = "{region}"
}}

variable "environment" {{
  description = "Deployment environment"
  type        = string
  default     = "{environment}"
}}
"""

    if database_service == "RDS":
        variables_tf += """
variable "database_password" {
  description = "Password for the PostgreSQL RDS database"
  type        = string
  sensitive   = true
}
"""

    # ========================================================
    # Outputs
    # ========================================================

    outputs_tf = """
output "vpc_id" {
  description = "ID of the CloudForge VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "application_instance_ids" {
  description = "IDs of the application EC2 instances"
  value       = aws_instance.app[*].id
}

output "application_public_ips" {
  description = "Public IP addresses of the application servers"
  value       = aws_instance.app[*].public_ip
}
"""

    if database_service == "RDS":
        outputs_tf += """
output "database_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "database_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.postgres.port
}
"""

    return {
        "main.tf": main_tf,
        "variables.tf": variables_tf,
        "outputs.tf": outputs_tf,
    }