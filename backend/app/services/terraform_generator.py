import json
import re

from app.models.infrastructure import Infrastructure


def _safe_hcl_string(value: object, field_name: str) -> str:
    """Validate a value used inside a Terraform quoted string."""
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field_name} cannot be empty.")
    if "\n" in text or "\r" in text:
        raise ValueError(f"{field_name} cannot contain newlines.")
    # JSON string escaping is compatible with quoted Terraform string values.
    return json.dumps(text)


def _validate_region(region: object) -> str:
    value = str(region or "").strip()
    if not re.fullmatch(r"[a-z]{2}(?:-gov)?-[a-z]+-\d", value):
        raise ValueError("Invalid AWS region format.")
    return value


def _validate_environment(environment: object) -> str:
    value = str(environment or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,32}", value):
        raise ValueError(
            "Environment must contain only letters, numbers, underscores, "
            "or hyphens (maximum 32 characters)."
        )
    return value


def _validate_project_name(name: object) -> str:
    value = str(name or "cloudforge-project").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value):
        raise ValueError(
            "Project name must contain only letters, numbers, underscores, "
            "or hyphens (maximum 64 characters)."
        )
    return value


# ============================================================
# Generate Terraform From Database Infrastructure
# ============================================================

def generate_terraform(infrastructure: Infrastructure) -> dict[str, str]:
    """Generate baseline AWS Terraform from a database infrastructure record."""
    cloud_provider = str(infrastructure.cloud_provider or "").strip().lower()
    region = _validate_region(infrastructure.region)
    environment = _validate_environment(infrastructure.environment)

    if cloud_provider != "aws":
        raise ValueError("Terraform generation currently supports AWS only.")

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

resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  # Intentionally no ingress or egress rules.
}

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/cloudforge/${var.project_name}/vpc-flow-logs"
  retention_in_days = 30

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs"
    Environment = var.environment
  }
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.project_name}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${var.project_name}-vpc-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "${aws_cloudwatch_log_group.vpc_flow_logs.arn}:*"
    }]
  })
}

resource "aws_flow_log" "vpc" {
  vpc_id               = aws_vpc.main.id
  traffic_type         = "ALL"
  log_destination      = aws_cloudwatch_log_group.vpc_flow_logs.arn
  iam_role_arn         = aws_iam_role.vpc_flow_logs.arn
  log_destination_type = "cloud-watch-logs"

  depends_on = [aws_iam_role_policy.vpc_flow_logs]

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs"
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
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-public-subnet"
    Environment = var.environment
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.10.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-private-subnet"
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
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-private-route-table"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private.id
}


"""
    variables_tf = f"""
variable "project_name" {{
  description = "CloudForge project name"
  type        = string
  default     = "cloudforge-project"
}}

variable "aws_region" {{
  description = "AWS deployment region"
  type        = string
  default     = {json.dumps(region)}
}}

variable "environment" {{
  description = "Deployment environment"
  type        = string
  default     = {json.dumps(environment)}
}}

variable "allowed_http_cidrs" {{
  description = "CIDR ranges allowed to access HTTP; restrict these to trusted sources."
  type        = list(string)
  default     = []
}}

variable "allowed_https_cidrs" {{
  description = "CIDR ranges allowed to access HTTPS; restrict these to trusted sources."
  type        = list(string)
  default     = []
}}
"""
    outputs_tf = """
output "vpc_id" {
  description = "ID of the CloudForge VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "ID of the public subnet"
  value       = aws_subnet.public.id
}

output "private_subnet_id" {
  description = "ID of the private subnet"
  value       = aws_subnet.private.id
}

"""
    return {
        "main.tf": main_tf,
        "variables.tf": variables_tf,
        "outputs.tf": outputs_tf,
    }


# ============================================================
# Generate Terraform From AI Architecture
# ============================================================

def generate_terraform_from_ai_plan(ai_plan: dict) -> dict[str, str]:
    """
    Generate Terraform from a structured CloudForge AI plan.
    The AI supplies architecture choices; this function generates HCL.
    """
    if not isinstance(ai_plan, dict):
        raise ValueError("AI infrastructure plan must be an object.")

    cloud_provider = str(ai_plan.get("cloud_provider", "AWS")).strip().lower()
    region = _validate_region(ai_plan.get("region", "ap-south-1"))
    environment = _validate_environment(ai_plan.get("environment", "development"))
    architecture = ai_plan.get("architecture") or {}

    if not isinstance(architecture, dict):
        raise ValueError("AI plan architecture must be an object.")
    if cloud_provider != "aws":
        raise ValueError("AI Terraform generation currently supports AWS only.")

    network = architecture.get("network") or {}
    compute = architecture.get("compute") or {}
    database = architecture.get("database") or {}

    if not all(isinstance(section, dict) for section in (network, compute, database)):
        raise ValueError("Network, compute, and database settings must be objects.")

    if not bool(network.get("vpc", True)):
        raise ValueError("CloudForge requires a VPC for this architecture.")

    public_subnets = _bounded_int(network.get("public_subnets", 1), "public_subnets", 1, 3)
    private_subnets = _bounded_int(network.get("private_subnets", 1), "private_subnets", 1, 3)

    compute_service = str(compute.get("service", "EC2")).upper()
    if compute_service != "EC2":
        raise ValueError("AI Terraform generation currently supports EC2 compute.")
    compute_count = _bounded_int(compute.get("count", 1), "compute.count", 1, 3)

    database_service = str(database.get("service", "")).upper()
    database_engine = str(database.get("engine", "")).lower()
    if database_service not in ("", "RDS"):
        raise ValueError("AI Terraform generation currently supports RDS databases.")
    if database_service == "RDS" and database_engine not in ("postgresql", "postgres"):
        raise ValueError("Currently only PostgreSQL RDS databases are supported.")

    # Keep the existing architecture scope while using private subnets for compute.
    # Public subnets host routing; EC2 is not assigned a public IP by default.
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

resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  # Intentionally no ingress or egress rules.
}

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/cloudforge/${var.project_name}/vpc-flow-logs"
  retention_in_days = 30

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs"
    Environment = var.environment
  }
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.project_name}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${var.project_name}-vpc-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "${aws_cloudwatch_log_group.vpc_flow_logs.arn}:*"
    }]
  })
}

resource "aws_flow_log" "vpc" {
  vpc_id               = aws_vpc.main.id
  traffic_type         = "ALL"
  log_destination      = aws_cloudwatch_log_group.vpc_flow_logs.arn
  iam_role_arn         = aws_iam_role.vpc_flow_logs.arn
  log_destination_type = "cloud-watch-logs"

  depends_on = [aws_iam_role_policy.vpc_flow_logs]

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs"
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
  count                   = PUBLIC_SUBNET_COUNT
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = "${var.aws_region}${element(["a", "b", "c"], count.index)}"
  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-public-${count.index + 1}"
    Environment = var.environment
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  count                   = PRIVATE_SUBNET_COUNT
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone       = "${var.aws_region}${element(["a", "b", "c"], count.index)}"
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
  count          = PUBLIC_SUBNET_COUNT
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name        = "${var.project_name}-private-route-table"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private" {
  count          = PRIVATE_SUBNET_COUNT
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg"
  description = "Security group for CloudForge application servers"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "HTTPS outbound for application updates and APIs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS over UDP"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS over TCP"
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-app-sg"
    Environment = var.environment
  }
}

resource "aws_vpc_security_group_ingress_rule" "app_http" {
  count             = length(var.allowed_http_cidrs)
  security_group_id = aws_security_group.app.id
  description       = "HTTP from explicitly approved CIDR ${var.allowed_http_cidrs[count.index]}"
  cidr_ipv4         = var.allowed_http_cidrs[count.index]
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "app_https" {
  count             = length(var.allowed_https_cidrs)
  security_group_id = aws_security_group.app.id
  description       = "HTTPS from explicitly approved CIDR ${var.allowed_https_cidrs[count.index]}"
  cidr_ipv4         = var.allowed_https_cidrs[count.index]
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}


data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
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
  count                       = COMPUTE_COUNT
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.private[count.index % PRIVATE_SUBNET_COUNT].id
  vpc_security_group_ids      = [aws_security_group.app.id]
  associate_public_ip_address = false

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
  }

  tags = {
    Name        = "${var.project_name}-app-${count.index + 1}"
    Environment = var.environment
    Role        = "application"
  }
}

DATABASE_SECURITY_GROUP
DATABASE_RESOURCES
"""

    database_security_group = ""
    database_resources = ""
    if database_service == "RDS":
        database_security_group = """
resource "aws_security_group" "database" {
  name        = "${var.project_name}-database-sg"
  description = "Security group for CloudForge PostgreSQL database"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL only from application security group"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name        = "${var.project_name}-database-sg"
    Environment = var.environment
  }
}
"""
        database_resources = """
resource "aws_db_subnet_group" "database" {
  name       = "${var.project_name}-database-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  tags = {
    Name        = "${var.project_name}-database-subnet-group"
    Environment = var.environment
  }
}

resource "aws_db_instance" "postgres" {
  identifier                  = "${var.project_name}-postgres"
  engine                      = "postgres"
  engine_version              = "16"
  instance_class              = var.database_instance_class
  allocated_storage           = 20
  storage_type                = "gp3"
  db_name                     = "cloudforge"
  username                    = var.database_username
  password                    = var.database_password
  db_subnet_group_name        = aws_db_subnet_group.database.name
  vpc_security_group_ids      = [aws_security_group.database.id]
  publicly_accessible         = false
  storage_encrypted           = true
  backup_retention_period     = 7
  deletion_protection         = true
  skip_final_snapshot         = false
  final_snapshot_identifier   = "${var.project_name}-postgres-final"
  auto_minor_version_upgrade  = true

  tags = {
    Name        = "${var.project_name}-postgres"
    Environment = var.environment
  }
}
"""

    main_tf = (
        main_tf.replace("PUBLIC_SUBNET_COUNT", str(public_subnets))
        .replace("PRIVATE_SUBNET_COUNT", str(private_subnets))
        .replace("COMPUTE_COUNT", str(compute_count))
        .replace("DATABASE_SECURITY_GROUP", database_security_group)
        .replace("DATABASE_RESOURCES", database_resources)
    )

    variables_tf = f"""
variable "project_name" {{
  description = "CloudForge project name"
  type        = string
  default     = "cloudforge-project"
}}

variable "aws_region" {{
  description = "AWS region"
  type        = string
  default     = {json.dumps(region)}
}}

variable "environment" {{
  description = "Deployment environment"
  type        = string
  default     = {json.dumps(environment)}
}}

variable "instance_type" {{
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}}

variable "allowed_http_cidrs" {{
  description = "CIDR ranges allowed to access HTTP. Empty by default."
  type        = list(string)
  default     = []
}}

variable "allowed_https_cidrs" {{
  description = "CIDR ranges allowed to access HTTPS. Set to trusted CIDRs for your deployment."
  type        = list(string)
  default     = []
}}
"""
    if database_service == "RDS":
        variables_tf += """
variable "database_username" {
  description = "Username for PostgreSQL RDS"
  type        = string
  default     = "cloudforge"
}

variable "database_password" {
  description = "Password for PostgreSQL RDS; supply securely at plan/apply time."
  type        = string
  sensitive   = true
}

variable "database_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}
"""

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

output "application_private_ips" {
  description = "Private IP addresses of the application servers"
  value       = aws_instance.app[*].private_ip
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


def _bounded_int(value: object, field_name: str, minimum: int, maximum: int) -> int:
    """Parse and bound integer configuration values."""
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be an integer.") from None
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"{field_name} must be between {minimum} and {maximum}.")
    return parsed
