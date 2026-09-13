import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type PaymentExample = {
  firstName: string;
  location: string;
  amount: number;
};

const EXAMPLE_PAYMENTS: PaymentExample[] = [
  { firstName: "Amina", location: "Dar es Salaam", amount: 62000 },
  { firstName: "John", location: "Geita", amount: 120000 },
  { firstName: "Neema", location: "Arusha", amount: 85000 },
  { firstName: "David", location: "Mwanza", amount: 150000 },
  { firstName: "Zawadi", location: "Dodoma", amount: 97000 },
  { firstName: "Hassan", location: "Mbeya", amount: 73000 },
  { firstName: "Rehema", location: "Morogoro", amount: 110000 },
  { firstName: "Brian", location: "Tanga", amount: 68000 },
  { firstName: "Joyce", location: "Iringa", amount: 132000 },
  { firstName: "Kelvin", location: "Kigoma", amount: 91000 },
  { firstName: "Salma", location: "Zanzibar", amount: 145000 },
  { firstName: "Michael", location: "Tabora", amount: 78000 },
];

const money = new Intl.NumberFormat("en-TZ");

/**
 * Example activity notifications. These are intentionally labeled as examples
 * and do not read payment/approval data from Supabase.
 */
export function PaymentActivityToasts() {
  const indexRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let initialTimer: ReturnType<typeof setTimeout> | undefined;
    let showTimer: ReturnType<typeof setInterval> | undefined;
    const payments = [...EXAMPLE_PAYMENTS].sort(() => Math.random() - 0.5);

    const showNext = () => {
      if (!mounted) return;
      const payment = payments[indexRef.current % payments.length];
      indexRef.current += 1;

      toast.custom(
        (id) => (
          <div className="w-[min(92vw,390px)] rounded-2xl border border-primary/20 bg-card px-4 py-3 shadow-2xl ring-1 ring-black/5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-primary">
                  
                  </span>
                  <button
                    type="button"
                    onClick={() => toast.dismiss(id)}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground"
                    aria-label="Funga notification"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  <span className="font-bold text-foreground">{payment.firstName}</span> kutoka {payment.location} amepokea <span className="font-extrabold text-primary">{money.format(payment.amount)} TSh</span>.
                </p>
              </div>
            </div>
          </div>
        ),
        { duration: 3000, position: "top-center" },
      );
    };

    // Start after the page settles, then show one new example every 10 seconds.
    initialTimer = setTimeout(() => {
      showNext();
      showTimer = setInterval(showNext, 10000);
    }, 2500);

    return () => {
      mounted = false;
      if (initialTimer) clearTimeout(initialTimer);
      if (showTimer) clearInterval(showTimer);
    };
  }, []);

  return null;
}
