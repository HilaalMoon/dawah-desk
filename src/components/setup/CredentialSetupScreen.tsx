import { useState } from "react";
import { backendApi } from "@/services/backendApi";

const REQUIRED_FIELDS = ["type", "project_id", "private_key", "client_email"] as const;

const validateJson = (text: string): string | null => {
  if (!text.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "This doesn't look like a valid credential file. Make sure you have pasted the entire contents.";
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return "This doesn't look like a valid credential file.";
  }

  const missing = REQUIRED_FIELDS.filter(
    (field) => !(field in (parsed as Record<string, unknown>)),
  );
  if (missing.length > 0) {
    return "This credential file appears to be incomplete. Please check that you copied the full contents.";
  }

  return null;
};

type Props = {
  onComplete: () => void;
  mode?: "setup" | "update";
};

export const CredentialSetupScreen = ({ onComplete, mode = "setup" }: Props) => {
  const [jsonText, setJsonText] = useState("");
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validationError = touched ? validateJson(jsonText) : null;
  const isValid = jsonText.trim().length > 0 && validateJson(jsonText) === null;

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      await backendApi.submitCredentials("");
    } catch {
      // Skip failure is non-fatal — proceed anyway.
    }
    onComplete();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!isValid) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await backendApi.submitCredentials(jsonText);
      onComplete();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "update" ? "Update your Da’wah Desk credentials" : "Welcome to Da’wah Desk"}
        </h1>
        <p className="mt-2 text-slate-600">
          Before you begin, you need to enter the credential file provided by your system
          administrator.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="credential-json" className="text-sm font-medium text-slate-700">
              Paste the contents of the credential file you received
            </label>
            <textarea
              id="credential-json"
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setSubmitError(null);
              }}
              onBlur={() => setTouched(true)}
              rows={8}
              className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
              placeholder='{ "type": "service_account", ... }'
              disabled={isSubmitting}
            />
            {validationError ? (
              <p className="text-sm text-red-600">{validationError}</p>
            ) : (
              <p className="text-sm text-slate-500">
                The file you received contains text starting with{" "}
                <span className="font-mono font-medium">{"{"}</span> and ending with{" "}
                <span className="font-mono font-medium">{"}"}</span>. Paste the entire contents
                including both curly brackets.
              </p>
            )}
          </div>

          {submitError ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
          ) : null}

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="mt-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {isSubmitting ? "Saving…" : mode === "update" ? "Save and return to Settings" : "Save and open Da’wah Desk"}
          </button>

          {mode === "setup" ? (
            <>
              <p className="text-center text-xs text-slate-400">
                Without credentials, AI features will not be available. You can add them later in Settings using the Update Credentials button.
              </p>
              <button
                type="button"
                onClick={() => void handleSkip()}
                disabled={isSkipping}
                className="self-center text-sm text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                {isSkipping ? "Skipping…" : "Skip for now"}
              </button>
            </>
          ) : null}
          {mode === "update" ? (
            <button
              type="button"
              onClick={onComplete}
              className="self-center text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel and return to Settings
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
};
