import { ArrowRight, Compass, Handshake, Scale, Sparkles, Undo2 } from "lucide-react";
import { useLocation } from "wouter";
import { useWorkspace } from "../app/store";
import { Button, Card, StatusBadge } from "../components/ui/primitives";

const STEPS = [
  { title: "Describe your business", body: "Budget, schedule, space, team, formats you would consider, and the cultural references your customers share." },
  { title: "Discover a cultural bridge", body: "Qloo's taste data suggests venues and themes your audience already connects with, with every signal traceable to its source." },
  { title: "Hear from the other side", body: "The host states their own fees, days, space, and rules. Nothing about the host is guessed or inferred." },
  { title: "See where the deal can land", body: "Every arrangement is checked against both sides' terms, with the smallest change that would turn a no into a maybe." },
];

export function Landing() {
  const { dispatch } = useWorkspace();
  const [, navigate] = useLocation();

  const tryExample = () => {
    dispatch({ type: "load_example" });
    navigate("/workspace/guest");
  };
  const startCustom = () => {
    dispatch({ type: "start_custom" });
    navigate("/workspace/guest");
  };

  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <p className="eyebrow">Partnership decisions for independent businesses</p>
          <h1 className="mt-4 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Find common ground.
            <br />
            <span className="text-common">Build a better deal.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Room for Both helps a brand and a venue work out a collaboration that works for both of them: grounded in real cultural signals, checked
            against each side's actual terms, and honest about what is still unknown.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={tryExample}>
              Try the fictional example <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button size="lg" variant="secondary" onClick={startCustom}>
              Start your own scenario
            </Button>
          </div>
          <p className="mt-4 text-sm text-ink-faint">The example uses two invented businesses. No account or sign-up needed.</p>
        </div>

        <figure aria-label="Illustration of an Agreement Frontier" className="relative">
          <div className="card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Agreement Frontier · illustration</p>
              <span className="text-xs text-ink-faint">9 options checked</span>
            </div>
            {[
              { label: "Curated shelf placement · 4 weeks", status: "conditional" as const, note: "Waiting on one host answer: exclusivity" },
              { label: "Co-hosted event · 2 hours", status: "no_go" as const, note: "No shared day. Smallest fix: one weekday evening" },
              { label: "Co-hosted event · 3 hours", status: "no_go" as const, note: "$250 over budget, and needs 3 host staff hours" },
            ].map((o) => (
              <div key={o.label} className="rounded-xl border border-line bg-paper/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{o.label}</p>
                  <StatusBadge status={o.status} short />
                </div>
                <p className="mt-1 text-sm text-ink-soft">{o.note}</p>
              </div>
            ))}
          </div>
          <figcaption className="mt-3 text-center text-xs text-ink-faint">Values from the fictional example scenario.</figcaption>
        </figure>
      </section>

      <section aria-labelledby="how" className="border-y border-line bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="how" className="text-2xl font-semibold sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-xl border border-line bg-paper p-5">
                <span className="font-display text-3xl font-semibold text-common/30">{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="features" className="sr-only">
          What you get
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <Scale className="size-6 text-common" aria-hidden />
            <h3 className="mt-3 text-xl font-semibold">Agreement Frontier</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Not a compatibility score. Every pop-up, shelf, and event option is shown as feasible, conditional, or no-go, with each check, assumption,
              and unknown spelled out.
            </p>
          </Card>
          <Card>
            <Undo2 className="size-6 text-host" aria-hidden />
            <h3 className="mt-3 text-xl font-semibold">Decision Reversal</h3>
            <p className="mt-2 text-sm text-ink-soft">
              See exactly why an option is blocked and the smallest negotiable change that would unblock it. Move a slider and watch decisions flip
              instantly.
            </p>
          </Card>
          <Card>
            <Compass className="size-6 text-guest" aria-hidden />
            <h3 className="mt-3 text-xl font-semibold">Cultural Bridge</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Qloo's taste intelligence points to venues and themes your audience already connects with, labelled with where every signal came from.
            </p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="honest" className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="card grid gap-8 p-6 sm:p-8 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Handshake className="size-6 text-common" aria-hidden />
            <h2 id="honest" className="mt-3 text-2xl font-semibold">
              Built to be trusted by both sides
            </h2>
            <p className="mt-3 text-ink-soft">
              A good partnership starts with a fair picture. Room for Both separates what each party said, what Qloo observed, what a rule derived, and
              what nobody knows yet.
            </p>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              "No revenue, foot-traffic, or demand forecasts.",
              "No invented venue facts. Missing host terms stay unknown.",
              "Cultural affinity is never treated as permission or proof of sales.",
              "Nothing is sent to any business on your behalf.",
              "Decisions are deterministic: the same inputs give the same answer.",
              "Every brief is a draft for people to review and agree on.",
            ].map((item) => (
              <li key={item} className="flex gap-2.5 rounded-lg bg-sunken/60 p-3">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-common" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
