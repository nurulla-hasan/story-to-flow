"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Cpu,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Zap,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_MODEL } from "@/lib/constants";
import { useSelectedModel } from "@/lib/model-storage";
import { useProductionSettings } from "@/lib/settings-storage";
import { SettingsCard } from "@/components/studio/settings-card";
import type { ModelOption, ModelsApiResponse } from "@/app/api/models/route";

export default function SettingsPage() {
  const {
    selectedModel,
    setSelectedModel,
    isDefaultModel,
    isLoaded: isStorageLoaded,
  } = useSelectedModel();

  const {
    settings: prodSettings,
    updateSetting,
    resetDefaults: resetProdDefaults,
    isDefault: isProdDefault,
  } = useProductionSettings();

  const [models, setModels] = useState<ModelOption[]>([
    {
      id: DEFAULT_MODEL,
      name: "Gemini 3.8 Flash (High)",
      ownedBy: "antigravity",
      description: "Default Model",
    },
  ]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  const [modelSource, setModelSource] = useState<"gateway" | "fallback">(
    "fallback",
  );
  const [savedNotice, setSavedNotice] = useState(false);

  // Initial load on mount
  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch("/api/models");
        if (!res.ok) {
          throw new Error(`Failed to fetch models: HTTP ${res.status}`);
        }

        const data: ModelsApiResponse = await res.json();
        if (ignore) return;

        if (Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models);
          setModelSource(data.source);
          if (data.warning) {
            setModelWarning(data.warning);
          }
        } else {
          setModelWarning(
            "No models returned by gateway. Using default fallback.",
          );
          setModelSource("fallback");
        }
      } catch (err) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : String(err);
        setModelWarning(
          `Gateway connection warning: ${msg}. Using configured default fallback.`,
        );
        setModelSource("fallback");
      } finally {
        if (!ignore) {
          setIsLoadingModels(false);
        }
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, []);

  // Manual refresh handler triggered by user action
  const handleRefresh = async () => {
    setIsLoadingModels(true);
    setModelWarning(null);

    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        throw new Error(`Failed to fetch models: HTTP ${res.status}`);
      }

      const data: ModelsApiResponse = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setModels(data.models);
        setModelSource(data.source);
        if (data.warning) {
          setModelWarning(data.warning);
        }
      } else {
        setModelWarning(
          "No models returned by gateway. Using default fallback.",
        );
        setModelSource("fallback");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setModelWarning(
        `Gateway connection warning: ${msg}. Using configured default fallback.`,
      );
      setModelSource("fallback");
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleModelChange = (newModelId: string | null) => {
    if (!newModelId) return;
    setSelectedModel(newModelId);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleResetToDefault = () => {
    handleModelChange(DEFAULT_MODEL);
  };

  const currentModelMeta = models.find((m) => m.id === selectedModel);

  return (
    <div className="space-y-6">
      {/* Header Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Settings
            </h1>
            <Badge variant="outline">Studio Configuration</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your AI language models, generation defaults, and gateway
            connectivity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoadingModels}
            className="gap-1.5"
            title="Refresh model list from server"
          >
            <RefreshCw
              className={`size-3.5 ${isLoadingModels ? "animate-spin" : ""}`}
            />
            <span>Refresh Models</span>
          </Button>

          <Link href="/studio">
            <Button className="gap-1.5">
              <Sparkles className="size-3.5" />
              <span>Go to Studio</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Full-Width 2-Column Responsive Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: AI Model Selection & Gateway Architecture (7 cols on lg screens) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. AI Model Selection Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="size-5 text-primary" />
                  <CardTitle>AI Inference Model</CardTitle>
                </div>
                {isDefaultModel ? (
                  <Badge variant="secondary">Using Default</Badge>
                ) : (
                  <Badge variant="default">Custom Model Active</Badge>
                )}
              </div>
              <CardDescription>
                Select the primary LLM used to analyze stories and assemble full
                production packages.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-5">
                {/* Warning / Fallback Notice */}
                {modelWarning && (
                  <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-foreground">
                    <AlertCircle className="size-4 shrink-0 text-warning mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">Model Discovery Notice</p>
                      <p className="leading-relaxed">{modelWarning}</p>
                    </div>
                  </div>
                )}

                {/* Model Selector Dropdown */}
                <Field>
                  <FieldLabel>
                    <span>Active Generation Model</span>
                  </FieldLabel>

                  <div className="space-y-2">
                    <Select
                      value={selectedModel}
                      onValueChange={handleModelChange}
                      disabled={isLoadingModels || !isStorageLoaded}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an AI model" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <span className="font-medium">{model.name}</span>
                            <span className="text-muted-foreground ml-2 text-2xs font-mono">
                              ({model.id})
                            </span>
                            {model.id === DEFAULT_MODEL && (
                              <span className="ml-2 text-2xs text-primary font-semibold">
                                • Default
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <FieldDescription>
                      Default:{" "}
                      <code className="font-mono text-2xs bg-muted px-1 py-0.5 rounded">
                        {DEFAULT_MODEL}
                      </code>
                      . Your choice is automatically saved in browser storage
                      and applied to all story generation requests.
                    </FieldDescription>
                  </div>
                </Field>

                {/* Current Model Detail Card */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Selected Model Specifications
                    </span>
                    {savedNotice && (
                      <span className="flex items-center gap-1 text-xs text-success font-medium animate-in fade-in duration-200">
                        <CheckCircle2 className="size-3.5" />
                        Saved in browser
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-muted/50 p-2.5">
                      <span className="text-muted-foreground block text-2xs font-medium">
                        Model ID
                      </span>
                      <span
                        className="font-mono font-semibold text-foreground truncate block mt-0.5"
                        title={selectedModel}
                        suppressHydrationWarning
                      >
                        {selectedModel}
                      </span>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-2.5">
                      <span className="text-muted-foreground block text-2xs font-medium">
                        Provider / Family
                      </span>
                      <span className="font-semibold text-foreground capitalize block mt-0.5">
                        {currentModelMeta?.ownedBy ||
                          (selectedModel.includes("/")
                            ? selectedModel.split("/")[0]
                            : "Standard")}
                      </span>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-2.5">
                      <span className="text-muted-foreground block text-2xs font-medium">
                        Model Source
                      </span>
                      <span className="font-semibold text-foreground capitalize block mt-0.5">
                        {modelSource === "gateway"
                          ? "Discovered via Gateway"
                          : "Configured Default"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Model Reset & Action Bar */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    onClick={handleResetToDefault}
                    disabled={isDefaultModel}
                    className="gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Reset to Default Model</span>
                  </Button>

                  <span className="text-2xs text-muted-foreground">
                    {models.length} model{models.length !== 1 ? "s" : ""}{" "}
                    available
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Gateway Architecture & Security Info (Req 3) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-success" />
                <CardTitle>Gateway &amp; Security</CardTitle>
              </div>
              <CardDescription>
                Server-side OpenAI-compatible gateway integration architecture.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <p>
                  Model discovery and chat completions communicate with your
                  configured OpenAI-compatible gateway via secure server-side
                  API routes (
                  <code className="font-mono text-2xs bg-muted px-1 py-0.5 rounded">
                    /api/models
                  </code>{" "}
                  and{" "}
                  <code className="font-mono text-2xs bg-muted px-1 py-0.5 rounded">
                    /api/story/process
                  </code>
                  ).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center gap-2 rounded-lg border border-border/80 p-2.5 bg-card">
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                    <span>
                      API credentials never exposed to client browsers
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/80 p-2.5 bg-card">
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                    <span>
                      Fallback model preservation during gateway outage
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Active Snapshot, Defaults & Workflow (5 cols on lg screens) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 3. Active Model Snapshot & Quick Studio Launch */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-primary" />
                  <CardTitle>Active Engine</CardTitle>
                </div>
                <Badge variant={isDefaultModel ? "secondary" : "default"}>
                  {isDefaultModel ? "Default" : "Custom"}
                </Badge>
              </div>
              <CardDescription>
                This model will be dispatched on your next Story Studio run.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <span className="text-2xs text-muted-foreground uppercase font-semibold tracking-wider">
                    Active Model Identifier
                  </span>
                  <p
                    className="font-mono font-bold text-sm text-foreground break-all"
                    suppressHydrationWarning
                  >
                    {selectedModel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentModelMeta?.name || selectedModel}
                  </p>
                </div>

                <Link href="/studio" className="block">
                  <Button className="w-full gap-2">
                    <span>Launch Story Studio</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 4. Interactive Studio Production Settings Card */}
          <SettingsCard
            visualStyle={prodSettings.visualStyle}
            onVisualStyleChange={(val) => updateSetting("visualStyle", val)}
            aspectRatio={prodSettings.aspectRatio}
            onAspectRatioChange={(val) => updateSetting("aspectRatio", val)}
            duration={prodSettings.duration}
            onDurationChange={(val) => updateSetting("duration", val)}
            staticFramePacing={prodSettings.staticFramePacing}
            onStaticFramePacingChange={(val) =>
              updateSetting("staticFramePacing", val)
            }
            activeModel={selectedModel}
            onResetDefaults={resetProdDefaults}
            isDefault={isProdDefault}
          />
        </div>
      </div>
    </div>
  );
}
