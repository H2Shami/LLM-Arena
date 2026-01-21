"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Zap } from "lucide-react";

const AVAILABLE_MODELS = [
  { provider: "openai", model: "gpt-4o-2024-11-20", name: "GPT-4o", enabled: true },
  { provider: "anthropic", model: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", enabled: true },
  { provider: "google", model: "gemini-2-0-flash-001", name: "Gemini 2.0 Flash", enabled: true },
  { provider: "xai", model: "grok-4-0709", name: "Grok 4", enabled: true },
  { provider: "meta", model: "Meta-Llama-3.1-70B-Instruct", name: "Llama 3.1 70B", enabled: true },
  { provider: "deepseek", model: "deepseek-v3.1", name: "DeepSeek V3.1", enabled: true },
];

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (selectedModels.length === 0) {
      setError("Please select at least one model");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          models: selectedModels.map((modelKey) => {
            const [provider, model] = modelKey.split(":");
            return { provider, model };
          }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create session");
      }

      const data = await response.json();
      router.push(`/arena/${data.sessionId}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-12 h-12 text-purple-600" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              LLM Vibe Coding Arena
            </h1>
            <Sparkles className="w-12 h-12 text-blue-600" />
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Watch multiple LLMs compete to build the best Next.js website from your prompt.
            Compare their code, speed, and creativity side-by-side.
          </p>
        </div>

        {/* Form */}
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Prompt Input */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <label htmlFor="prompt" className="block text-lg font-semibold text-gray-900 mb-3">
                What should the LLMs build?
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., Build a modern landing page for a coffee shop with a menu section, location map, and contact form. Use warm colors and make it mobile-responsive."
                className="w-full h-40 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 placeholder:text-gray-400"
                disabled={isSubmitting}
              />
              <p className="mt-2 text-sm text-gray-500">
                Be specific! Include details about design, features, and functionality.
              </p>
            </div>

            {/* Model Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Select Models to Compete
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AVAILABLE_MODELS.map((modelConfig) => {
                  const modelKey = `${modelConfig.provider}:${modelConfig.model}`;
                  const isSelected = selectedModels.includes(modelKey);

                  return (
                    <button
                      key={modelKey}
                      type="button"
                      onClick={() => toggleModel(modelKey)}
                      disabled={!modelConfig.enabled || isSubmitting}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all text-left
                        ${
                          isSelected
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }
                        ${!modelConfig.enabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{modelConfig.name}</h3>
                          <p className="text-sm text-gray-500 capitalize">
                            {modelConfig.provider}
                          </p>
                        </div>
                        <div
                          className={`
                            w-5 h-5 rounded-full border-2 flex items-center justify-center
                            ${
                              isSelected
                                ? "border-purple-500 bg-purple-500"
                                : "border-gray-300"
                            }
                          `}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Select {selectedModels.length === 0 ? "at least one" : selectedModels.length} model
                {selectedModels.length !== 1 ? "s" : ""} to compete
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-8 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Arena...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Start the Competition
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Info Section */}
        <div className="max-w-4xl mx-auto mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Live Competition</h3>
            <p className="text-sm text-gray-600">
              Watch models build in real-time with live previews and streaming logs
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Side-by-Side</h3>
            <p className="text-sm text-gray-600">
              Compare code quality, design choices, and execution speed instantly
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Production Ready</h3>
            <p className="text-sm text-gray-600">
              All generated sites are built and served as production Next.js apps
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
