import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  generateTerraform,
  validateTerraform,
  planTerraform,
  scanTerraformSecurity,
} from "../services/api";
import type { TerraformSecurityScanResponse } from "../services/api";
import { Navbar } from "../components/Navbar";
import { CodeViewer } from "../components/CodeViewer";
import { WorkflowStepper } from "../components/WorkflowStepper";
import type { WorkflowStepId } from "../components/WorkflowStepper";
import {
  IconArrowLeft,
  IconFileCode,
  IconCheckCircle,
  IconAlertCircle,
  IconAlertTriangle,
  IconPlay,
  IconShield,
  IconChevronDown,
  IconExternalLink,
  IconCheck,
  IconServer,
  IconTerminal,
  IconRefresh,
  IconCopy,
} from "../components/Icons";

interface TerraformResponse {
  project_id: number;
  project_name: string;
  cloud_provider: string;
  region: string;
  environment: string;
  files: {
    "main.tf": string;
    "variables.tf": string;
    "outputs.tf": string;
  };
}

interface ValidationResponse {
  project_id: number;
  project_name: string;
  valid: boolean;
  formatted: boolean;
  format_output: string;
  format_error: string;
  validation_output: string;
  validation_error: string;
}

interface PlanResponse {
  project_id: number;
  project_name: string;
  success: boolean;
  plan_output: string;
  plan_error: string;
}

type TerraformFile = "main.tf" | "variables.tf" | "outputs.tf";

function severityColor(severity: string) {
  const s = severity?.toUpperCase() || "";
  if (s === "HIGH") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (s === "MEDIUM")
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (s === "LOW") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return "bg-slate-500/15 text-slate-400 border-slate-500/30";
}

function severityDot(severity: string) {
  const s = severity?.toUpperCase() || "";
  if (s === "HIGH") return "bg-red-500";
  if (s === "MEDIUM") return "bg-amber-500";
  if (s === "LOW") return "bg-blue-500";
  return "bg-slate-500";
}

function FindingCard({
  finding,
  expanded,
  onToggle,
}: {
  finding: TerraformSecurityScanResponse["findings"][number];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#1c222b] bg-[#0d1017] shadow-lg shadow-black/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`shrink-0 w-2 h-2 rounded-full ${severityDot(finding.severity)}`}
          />
          <div className="min-w-0">
            <span className="font-mono text-[11px] font-bold text-teal-400">
              {finding.check_id}
            </span>
            <p className="text-sm font-medium text-white truncate">
              {finding.check_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase ${severityColor(finding.severity)}`}
          >
            {finding.severity || "UNKNOWN"}
          </span>
          <IconChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#1c222b] pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-white/[0.03] border border-[#1c222b] p-2.5">
              <span className="text-slate-500 uppercase text-[9px] font-semibold tracking-wider">
                Resource
              </span>
              <p className="mt-0.5 text-slate-300 font-mono truncate">
                {finding.resource || "—"}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-[#1c222b] p-2.5">
              <span className="text-slate-500 uppercase text-[9px] font-semibold tracking-wider">
                File
              </span>
              <p className="mt-0.5 text-slate-300 font-mono truncate">
                {finding.file_path || "—"}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-[#1c222b] p-2.5 col-span-2 sm:col-span-1">
              <span className="text-slate-500 uppercase text-[9px] font-semibold tracking-wider">
                Lines
              </span>
              <p className="mt-0.5 text-slate-300 font-mono">
                {finding.file_line_range?.length
                  ? finding.file_line_range.join("–")
                  : "—"}
              </p>
            </div>
          </div>

          {finding.why_it_matters && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <IconAlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                  Why it matters
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {finding.why_it_matters}
              </p>
            </div>
          )}

          {finding.recommendation && (
            <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <IconCheck className="h-3.5 w-3.5 text-teal-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                  Recommendation
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {finding.recommendation}
              </p>
            </div>
          )}

          {finding.remediation_context && (
            <div className="rounded-lg border border-[#1c222b] bg-white/[0.02] p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Remediation Context
              </span>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {finding.remediation_context}
              </p>
            </div>
          )}

          {finding.guideline && (
            <a
              href={finding.guideline}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400 hover:text-teal-300 transition"
            >
              <IconExternalLink className="h-3.5 w-3.5" />
              View Checkov Guideline
            </a>
          )}

          {finding.recommendation_priority && (
            <p className="text-[10px] text-slate-600">
              CloudForge Priority:{" "}
              <span className="font-semibold text-slate-400">
                {finding.recommendation_priority}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Terraform() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [terraform, setTerraform] = useState<TerraformResponse | null>(null);
  const [activeFile, setActiveFile] = useState<TerraformFile>("main.tf");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [validating, setValidating] = useState(false);

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [planning, setPlanning] = useState(false);

  const [artifactId, setArtifactId] = useState("");
  const [securityScanning, setSecurityScanning] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [securityScan, setSecurityScan] =
    useState<TerraformSecurityScanResponse | null>(null);

  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(
    new Set(),
  );

  async function handleGenerateTerraform() {
    if (!projectId) {
      setError("Project ID is missing");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setValidation(null);
      setPlan(null);

      const data = await generateTerraform(Number(projectId));
      setTerraform(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to generate Terraform");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleValidateTerraform() {
    if (!projectId) {
      setError("Project ID is missing");
      return;
    }

    try {
      setValidating(true);
      setError("");

      const data = await validateTerraform(Number(projectId));
      setValidation(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to validate Terraform");
      }
    } finally {
      setValidating(false);
    }
  }

  async function handlePlanTerraform() {
    if (!projectId) {
      setError("Project ID is missing");
      return;
    }

    try {
      setPlanning(true);
      setError("");
      setPlan(null);

      const data = await planTerraform(Number(projectId));
      setPlan(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to generate Terraform plan");
      }
    } finally {
      setPlanning(false);
    }
  }

  async function handleSecurityScan() {
    if (
      !projectId ||
      !Number.isInteger(Number(projectId)) ||
      Number(projectId) <= 0
    ) {
      setSecurityError("A valid project ID is required.");
      return;
    }

    const parsedArtifactId = Number(artifactId);
    if (
      !artifactId.trim() ||
      !Number.isInteger(parsedArtifactId) ||
      parsedArtifactId <= 0
    ) {
      setSecurityError("Enter a valid positive Artifact ID.");
      return;
    }

    try {
      setSecurityScanning(true);
      setSecurityError("");
      setSecurityScan(null);
      setExpandedFindings(new Set());

      const result = await scanTerraformSecurity(
        Number(projectId),
        parsedArtifactId,
      );
      setSecurityScan(result);
    } catch (err) {
      setSecurityError(
        err instanceof Error ? err.message : "Security scan failed.",
      );
    } finally {
      setSecurityScanning(false);
    }
  }

  function toggleFinding(index: number) {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const currentStep: WorkflowStepId = plan
    ? "approve"
    : validation
      ? "plan"
      : terraform
        ? "validate"
        : "generate";

  const completedSteps: WorkflowStepId[] = [];
  if (terraform) completedSteps.push("generate");
  if (validation?.valid) completedSteps.push("validate");
  if (plan?.success) completedSteps.push("plan");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0a0d12] dark:text-slate-100">
      <Navbar
        breadcrumbs={[
          { label: "Console", href: "/dashboard" },
          { label: "Projects", href: `/projects/${projectId}` },
          { label: "Terraform IaC" },
        ]}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}`)}
          className="mb-6 flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-[#768597] dark:hover:text-slate-200"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Project Workspace</span>
        </button>

        <div className="mb-8">
          <WorkflowStepper
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        <div className="rounded-2xl border border-[#1c222b] bg-[#0d1017] p-6 sm:p-8 shadow-xl shadow-black/20 mb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 ring-1 ring-teal-500/30">
                <IconServer className="h-6 w-6 text-teal-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
                    Infrastructure as Code
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="font-mono text-xs text-slate-500">
                    {projectId ? `Project #${projectId}` : "No Project"}
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Terraform Generator
                </h1>
                <p className="mt-1 max-w-xl text-sm text-slate-400">
                  Generate, format, validate, and plan Terraform configuration
                  files from your CloudForge architecture specification.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {terraform && (
                <button
                  type="button"
                  onClick={handleGenerateTerraform}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2.5 text-xs font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <IconRefresh className="h-4 w-4" />
                  )}
                  <span>Regenerate</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleGenerateTerraform}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-400 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <IconFileCode className="h-4 w-4" />
                    <span>
                      {terraform
                        ? "Regenerate Terraform"
                        : "Generate Terraform"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 shadow-lg shadow-red-500/5">
            <IconAlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {terraform && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Project", value: terraform.project_name, mono: false },
              {
                label: "Provider",
                value: terraform.cloud_provider,
                mono: false,
                accent: true,
              },
              { label: "Region", value: terraform.region, mono: true },
              {
                label: "Environment",
                value: terraform.environment,
                mono: false,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#1c222b] bg-[#0d1017] p-4 shadow-lg shadow-black/10"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {item.label}
                </span>
                <p
                  className={`mt-1 font-semibold truncate ${item.mono ? "font-mono text-sm" : "text-sm"} ${item.accent ? "text-teal-400" : "text-white"}`}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {!terraform && !loading && (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#1c222b] bg-[#0d1017] p-10 text-center shadow-xl shadow-black/20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 ring-1 ring-teal-500/30">
              <IconFileCode className="h-8 w-8 text-teal-400" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">
              Terraform files not generated yet
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              Synthesize deterministic HCL configuration code from the
              infrastructure specifications saved in this project.
            </p>
            <button
              type="button"
              onClick={handleGenerateTerraform}
              className="mt-6 flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-400"
            >
              <IconFileCode className="h-4 w-4" />
              <span>Generate Terraform</span>
            </button>
          </div>
        )}

        {terraform && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#1c222b] bg-[#0d1017] shadow-xl shadow-black/20 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c222b]">
                <div className="flex items-center gap-2.5">
                  <IconTerminal className="h-4 w-4 text-teal-400" />
                  <span className="text-sm font-semibold text-white">
                    Terraform Source Code
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  {terraform.cloud_provider} • {terraform.region}
                </span>
              </div>
              <div className="p-4">
                <CodeViewer
                  files={terraform.files}
                  activeFile={activeFile}
                  onSelectFile={(f) => setActiveFile(f as TerraformFile)}
                  maxHeight="480px"
                  title={`${terraform.project_name} / terraform`}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#1c222b] bg-[#0d1017] p-6 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 ring-1 ring-teal-500/30">
                    <IconShield className="h-5 w-5 text-teal-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                      Quality Gate
                    </span>
                    <h2 className="mt-0.5 text-lg font-semibold text-white">
                      Validate & Plan Configuration
                    </h2>
                    <p className="mt-1 text-xs text-slate-400 max-w-lg">
                      Execute syntax formatting, semantic validation, and
                      dry-run change calculation without applying changes to
                      AWS.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleValidateTerraform}
                    disabled={validating}
                    className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2.5 text-xs font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
                  >
                    {validating ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <IconCheckCircle className="h-3.5 w-3.5" />
                        <span>Validate Terraform</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePlanTerraform}
                    disabled={planning}
                    className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-400 disabled:opacity-50"
                  >
                    {planning ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Generating Plan...</span>
                      </>
                    ) : (
                      <>
                        <IconPlay className="h-3 w-3" />
                        <span>Preview Execution Plan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-6 border-t border-[#171e27] pt-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30">
                    <IconShield className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Security Gate
                    </span>
                    <h3 className="mt-0.5 text-lg font-semibold text-white">
                      Infrastructure Security Scan
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 max-w-lg">
                      Scan a stored Terraform artifact with Checkov. This is a
                      read-only security check and does not deploy resources.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-5">
                  <div className="flex-1">
                    <label
                      htmlFor="artifact-id"
                      className="block text-xs font-medium text-slate-400 mb-1.5"
                    >
                      Artifact ID
                    </label>
                    <input
                      id="artifact-id"
                      type="number"
                      min="1"
                      step="1"
                      value={artifactId}
                      onChange={(event) => setArtifactId(event.target.value)}
                      placeholder="Enter artifact ID (e.g. 7)"
                      className="block w-full max-w-xs rounded-lg border border-[#29313d] bg-[#0a0d12] px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSecurityScan}
                    disabled={securityScanning}
                    className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {securityScanning ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <IconShield className="h-4 w-4" />
                        <span>Run Security Scan</span>
                      </>
                    )}
                  </button>
                </div>

                {securityError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
                  >
                    {securityError}
                  </div>
                )}

                {securityScan && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                            Passed
                          </span>
                          <IconCheckCircle className="h-4 w-4 text-emerald-400" />
                        </div>
                        <p className="mt-2 text-3xl font-bold text-emerald-400">
                          {securityScan.summary.passed}
                        </p>
                      </div>
                      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                            Failed
                          </span>
                          <IconAlertCircle className="h-4 w-4 text-red-400" />
                        </div>
                        <p className="mt-2 text-3xl font-bold text-red-400">
                          {securityScan.summary.failed}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Skipped
                          </span>
                          <span className="h-4 w-4 rounded-full border-2 border-slate-500" />
                        </div>
                        <p className="mt-2 text-3xl font-bold text-slate-400">
                          {securityScan.summary.skipped}
                        </p>
                      </div>
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                            Total
                          </span>
                          <IconShield className="h-4 w-4 text-blue-400" />
                        </div>
                        <p className="mt-2 text-3xl font-bold text-blue-400">
                          {securityScan.summary.total}
                        </p>
                      </div>
                    </div>

                    <div
                      role="status"
                      className={`rounded-xl border p-4 flex items-start gap-3 ${
                        securityScan.passed
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-amber-500/30 bg-amber-500/10"
                      }`}
                    >
                      {securityScan.passed ? (
                        <IconCheckCircle className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                      ) : (
                        <IconAlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                      )}
                      <div>
                        <p
                          className={`text-sm font-semibold ${securityScan.passed ? "text-emerald-400" : "text-amber-400"}`}
                        >
                          {securityScan.passed ? "Scan Passed" : "Scan Failed"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {securityScan.passed
                            ? "All applicable security checks passed for this artifact."
                            : "Security findings detected. Review the recommendations before deployment."}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Artifact #{securityScan.artifact_id} · Status:{" "}
                          {securityScan.artifact_status}
                        </p>
                      </div>
                    </div>

                    {securityScan.findings.length === 0 ? (
                      <div className="rounded-xl border border-[#1c222b] bg-[#0a0d12] p-6 text-center">
                        <IconCheckCircle className="h-8 w-8 text-emerald-400 mx-auto" />
                        <p className="mt-2 text-sm text-slate-400">
                          No findings were returned by the scanner.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Findings ({securityScan.findings.length})
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                expandedFindings.size ===
                                securityScan.findings.length
                              ) {
                                setExpandedFindings(new Set());
                              } else {
                                setExpandedFindings(
                                  new Set(
                                    securityScan.findings.map((_, i) => i),
                                  ),
                                );
                              }
                            }}
                            className="text-[11px] font-medium text-teal-400 hover:text-teal-300 transition"
                          >
                            {expandedFindings.size ===
                            securityScan.findings.length
                              ? "Collapse All"
                              : "Expand All"}
                          </button>
                        </div>

                        {securityScan.findings.map((finding, index) => (
                          <FindingCard
                            key={`${finding.check_id}-${finding.resource}-${finding.file_path}-${index}`}
                            finding={finding}
                            expanded={expandedFindings.has(index)}
                            onToggle={() => toggleFinding(index)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {validation && (
                <div className="mt-6 border-t border-[#171e27] pt-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div
                      className={`rounded-xl border p-5 ${
                        validation.valid
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-red-500/30 bg-red-500/5"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${validation.valid ? "bg-emerald-500/15" : "bg-red-500/15"}`}
                          >
                            {validation.valid ? (
                              <IconCheckCircle className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <IconAlertCircle className="h-5 w-5 text-red-400" />
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Validation Check
                            </span>
                            <p
                              className={`mt-0.5 font-semibold ${validation.valid ? "text-emerald-400" : "text-red-400"}`}
                            >
                              {validation.valid
                                ? "Configuration is valid"
                                : "Configuration is invalid"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold ${
                            validation.valid
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {validation.valid ? "PASSED" : "FAILED"}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl border p-5 ${
                        validation.formatted
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-amber-500/30 bg-amber-500/5"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${validation.formatted ? "bg-emerald-500/15" : "bg-amber-500/15"}`}
                          >
                            {validation.formatted ? (
                              <IconCheckCircle className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <IconAlertTriangle className="h-5 w-5 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Format Check
                            </span>
                            <p
                              className={`mt-0.5 font-semibold ${validation.formatted ? "text-emerald-400" : "text-amber-400"}`}
                            >
                              {validation.formatted
                                ? "Canonical HCL formatting"
                                : "Formatting required"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold ${
                            validation.formatted
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {validation.formatted ? "CANONICAL" : "FORMAT NEEDED"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(validation.validation_output ||
                    validation.validation_error) && (
                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Validation Output Log
                      </p>
                      <pre className="max-h-[300px] overflow-auto rounded-xl border border-[#1c222b] bg-[#06080b] p-4 font-mono text-xs leading-relaxed text-slate-300">
                        {validation.validation_output ||
                          validation.validation_error}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {plan && (
                <div className="mt-6 border-t border-[#171e27] pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${plan.success ? "bg-emerald-500/15" : "bg-red-500/15"}`}
                      >
                        {plan.success ? (
                          <IconCheckCircle className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <IconAlertCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                          Dry Run Result
                        </span>
                        <h3 className="text-lg font-semibold text-white">
                          Terraform Execution Plan
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 font-mono text-[10px] font-bold ${
                        plan.success
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border border-red-500/30 bg-red-500/10 text-red-400"
                      }`}
                    >
                      {plan.success ? "PLAN SUCCESSFUL" : "PLAN FAILED"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#1c222b] bg-[#06080b] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1c222b] bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <span className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono ml-2">
                          terraform plan
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const text = plan.success
                            ? plan.plan_output
                            : plan.plan_error || "Plan execution failed.";
                          navigator.clipboard?.writeText(text);
                        }}
                        className="text-slate-500 hover:text-slate-300 transition"
                        title="Copy to clipboard"
                      >
                        <IconCopy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <pre className="max-h-[500px] overflow-auto p-5 font-mono text-xs leading-relaxed text-slate-300">
                      {plan.success
                        ? plan.plan_output
                        : plan.plan_error || "Plan execution failed."}
                    </pre>
                  </div>

                  {plan.success && (
                    <div className="mt-4 rounded-xl border border-[#1c222b] bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <IconAlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-300">
                          Dry-Run Verification Notice
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Terraform determined resource changes without modifying
                        any cloud infrastructure. Resources marked with{" "}
                        <span className="font-mono font-bold text-emerald-400">
                          +
                        </span>{" "}
                        would be provisioned when an approved Terraform apply is
                        executed.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Terraform;
