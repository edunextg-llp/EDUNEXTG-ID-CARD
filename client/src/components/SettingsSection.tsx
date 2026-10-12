import React, { useState } from "react";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sun,
  Moon,
  Laptop,
  Check,
  Palette,
  Scale,
  ShieldCheck,
  ExternalLink,
  Building,
} from "lucide-react";
import type { ApiAuthUser } from "@/lib/api";
import {
  schoolServiceAgreementData,
  dataProcessingAgreementData,
} from "@/legal-docs";

interface SettingsSectionProps {
  user?: ApiAuthUser;
  portal?: "admin" | "school" | "partner" | "marketing";
}

export default function SettingsSection({ user, portal = "admin" }: SettingsSectionProps) {
  const { preference, theme, setPreference } = useTheme();
  const isAdmin = portal === "admin" || user?.role === "SUPER_ADMIN";

  const themeOptions: Array<{
    id: ThemePreference;
    label: string;
    description: string;
    icon: typeof Sun;
    previewBg: string;
    previewInner: string;
    previewBorder: string;
  }> = [
    {
      id: "light",
      label: "Light",
      description: "Clean, crisp appearance for bright environments",
      icon: Sun,
      previewBg: "bg-[#f7f6f2]",
      previewInner: "bg-[#fffefa] border-[#dfe7e2]",
      previewBorder: "border-[#0f7f79]",
    },
    {
      id: "dark",
      label: "Dark",
      description: "Sleek, low-glare appearance comfortable for low light",
      icon: Moon,
      previewBg: "bg-[#102728]",
      previewInner: "bg-[#173534] border-[#294344]",
      previewBorder: "border-[#40c8bb]",
    },
    {
      id: "system",
      label: "System",
      description: "Automatically adjusts according to your system display settings",
      icon: Laptop,
      previewBg: "bg-gradient-to-r from-[#f7f6f2] 50% to-[#102728] 50%",
      previewInner: "bg-gradient-to-r from-[#fffefa] 50% to-[#173534] 50% border-[#dfe7e2] dark:border-[#294344]",
      previewBorder: "border-primary",
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Customize interface preferences and manage institutional compliance documents.
        </p>
      </div>

      {/* ════════════ SECTION 1: APPEARANCE ════════════ */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-card-foreground">
                  Appearance
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Choose how the application interface is styled on this device.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Interface Theme
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {themeOptions.map((opt) => {
                  const isSelected = preference === opt.id;
                  const IconComponent = opt.icon;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPreference(opt.id)}
                      className={`group relative flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-accent/40 shadow-sm"
                          : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                      }`}
                    >
                      {/* Visual Preview Swatch */}
                      <div className={`w-full h-20 rounded-xl mb-3.5 p-2 overflow-hidden border ${opt.previewBg}`}>
                        <div className={`w-full h-full rounded-lg border shadow-xs p-1.5 flex flex-col justify-between ${opt.previewInner}`}>
                          <div className="flex items-center justify-between">
                            <div className="h-2 w-8 rounded-full bg-primary/40" />
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          </div>
                          <div className="space-y-1">
                            <div className="h-1.5 w-12 rounded-full bg-foreground/20" />
                            <div className="h-1.5 w-16 rounded-full bg-foreground/15" />
                          </div>
                        </div>
                      </div>

                      {/* Option Label and Icon */}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <IconComponent
                            className={`h-4 w-4 ${
                              isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                            }`}
                          />
                          <span className="text-sm font-bold text-card-foreground">
                            {opt.label}
                          </span>
                        </div>

                        {/* Selected Checkmark Indicator */}
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                            <Check className="h-3 w-3 stroke-[2.5]" />
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Status Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
              <div>
                Active display mode:{" "}
                <span className="font-semibold text-foreground capitalize">
                  {theme}
                </span>
                {preference === "system" && (
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    (matched from device system preference)
                  </span>
                )}
              </div>
              <div className="text-[11px]">
                Theme preference is stored locally on this browser.
              </div>
            </div>
          </CardContent>
        </Card>

      {/* ════════════ SECTION 2: LEGAL & COMPLIANCE (ADMIN PANEL) ════════════ */}
      {isAdmin && (
        <div className="space-y-6">
          <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold text-card-foreground">
                      Legal &amp; Compliance
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Institutional agreement templates and data processing frameworks for school onboarding under Indian law.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                    India DPDP Act 2023 Compliant
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Legal Agreement Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box 1: MSA */}
                <div className="relative p-5 rounded-2xl border border-border bg-card hover:border-emerald-500/60 hover:bg-muted/30 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                          <Building className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-card-foreground">
                            School Service Agreement (MSA)
                          </h3>
                          <span className="text-[11px] text-muted-foreground">
                            Master Services Agreement
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                      Governs software portal access, template design workflows, PVC card manufacturing, turnaround SLAs, warranty, and commercial terms with educational institutions.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted-foreground">
                      {schoolServiceAgreementData.placeholders.length} placeholders pending
                    </span>
                    <a
                      href="/legal/school-service-agreement"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                    >
                      View Agreement
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Box 2: DPA */}
                <div className="relative p-5 rounded-2xl border border-border bg-card hover:border-emerald-500/60 hover:bg-muted/30 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-card-foreground">
                            Data Processing Agreement (DPA)
                          </h3>
                          <span className="text-[11px] text-muted-foreground">
                            Data Fiduciary &amp; Processor Terms
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                      DPDP Act 2023 schedule for handling student minor records, staff data, photographs, security safeguards, incident notifications, and post-order purging.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted-foreground">
                      {dataProcessingAgreementData.placeholders.length} placeholders pending
                    </span>
                    <a
                      href="/legal/data-processing-agreement"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                    >
                      View Agreement
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
