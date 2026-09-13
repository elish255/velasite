import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// These are explicitly demo examples. Do not present invented payments as real transactions.
const DEMO_PAYMENTS = [
  { name: "Amina", location: "Dar es Salaam", amount: 62000 },
  { name: "John", location: "Geita", amount: 120000 },
  { name: "Neema", location: "Arusha", amount: 85000 },
  { name: "David", location: "Mwanza", amount: 150000 },
  { name: "Rehema", location: "Dodoma", amount: 70000 },
  { name: "Peter", location: "Mbeya", amount: 95000 },
  { name: "Zawadi", location: "Morogoro", amount: 110000 },
  { name: "Brian", location: "Tanga", amount: 135000 },
  { name: "Halima", location: "Zanzibar", amount: 78000 },
  { name: "Michael", location: "Kigoma", amount: 105000 },
  { name: "Esther", location: "Iringa", amount: 90000 },
  { name: "Samuel", location: "Tabora", amount: 125000 },
];

const money = new Intl.NumberFormat("en-TZ");

export function PaymentActivityToasts() {
  const indexRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;

    const showNext = () => {
      const payment = DEMO_PAYMENTS[indexRef.current % DEMO_PAYMENTS.length];
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
                  <p className="text-sm font-extrabold text-foreground">Malipo · Mfano</p>
                  <button
                    type="button"
                    onClick={() => toast.dismiss(id)}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground"
                    aria-label="Funga notification"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  <span className="font-bold text-foreground">{payment.name}</span> kutoka {payment.location} amepokea <span className="font-extrabold text-primary">{money.format(payment.amount)} TSh</span>.
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  Demo activity notification
                </p>
              </div>
            </div>
          </div>
        ),
        { duration: 3000, position: "top-center" },
      );
    };

    timer = setTimeout(() => {
      showNext();
      interval = setInterval(showNext, 5500);
    }, 2200);

    return () => {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}
