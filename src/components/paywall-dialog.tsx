import { Link } from "@tanstack/react-router";
import { BadgeCheck, X } from "lucide-react";

export function PaywallDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md rounded-3xl bg-card p-6 text-card-foreground shadow-card">
        <div className="flex items-start justify-between">
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-primary">
            <BadgeCheck className="size-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Funga"
            className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="mt-4 font-display text-2xl font-extrabold leading-snug">
          Ili kuweza kuendelea kuchat na kulipwa
        </h2>
        <p className="mt-3 rounded-2xl bg-brand-tint p-4 text-[15px] font-semibold leading-relaxed text-secondary-foreground">
          Jisajili kisha <span className="text-primary">Activate account</span> yako kwa
          mtaji wa <span className="text-primary">15,000 TZS</span>
        </p>

        <Link
          to="/register"
          className="brand-gradient mt-5 flex w-full items-center justify-center rounded-2xl px-6 py-4 text-lg font-extrabold text-brand-foreground shadow-brand"
        >
          Jisajili Sasa
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-2xl border border-border py-3 font-semibold text-muted-foreground"
        >
          Baadaye
        </button>
      </div>
    </div>
  );
}
