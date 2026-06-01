"use client";

import { PrimaryButton } from "@/components/ui/form-controls";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <h2 className="text-2xl font-semibold text-red-700">Something went wrong</h2>
      <p className="max-w-md text-sm text-red-600">The dashboard section could not load right now. Please try again.</p>
      <PrimaryButton type="button" onClick={() => reset()}>
        Retry
      </PrimaryButton>
    </div>
  );
}
