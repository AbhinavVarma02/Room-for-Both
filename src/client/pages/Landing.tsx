import { ArrowRight, Compass, Handshake, PlayCircle, Scale, Sparkles, Undo2 } from "lucide-react";
import { useLocation } from "wouter";
import { useWorkspace } from "../app/store";
import { Button, Card, StatusBadge } from "../components/ui/primitives";

const STEPS = [
  { title: "Describe your business", body: "Budget, schedule, space, team, formats you would consider, and the cultural references your customers share." },
  {
    title: "Find the cultural reason",
    body: "Qloo's taste graph ranks real venues by how strongly their audiences share that taste, compares against a category-only search, and looks at the venue's own audience too.",
  },
  { title: "Hear from the other side", body: "The venue states its own fees, days, space, and rules through a private link. Nothing about the host is guessed or inferred." },
  { title: "See where the deal can land", body: "Every arrangement is checked against both sides' terms, with the smallest change that would turn a no into a maybe." },
];

const STORY = [
  {
    eyebrow: "1 · Cultural reason, from Qloo",
    title: "Venues ranked by shared taste",
    body: "The brand's references point to bookstores whose audiences share them, and to books both audiences connect with.",
    tone: "border-guest/30 bg-guest-soft/50",
  },
  {
    eyebrow: "2 · Why the obvious deal fails",
    title: "Co-hosted event · 2 hours",
    body: "No-go: the brand is free on weekends, the venue only on weeknights.",
    tone: "border-bad/25 bg-bad-soft/50",
  },
  {
    eyebrow: "3 · What is worth discussing",
    title: "One change, re-checked",
    body: "Add one Tuesday evening on the brand's side and the same event becomes conditional, still waiting on the venue's own answers.",
    tone: "border-common/30 bg-common-soft/50",
  },
];

export function Landing() {
  const { dispatch } = useWorkspace();
  const [, navigate] = useLocation();

  const tryExample = () => {
    dispatch({ type: "load_example" });
    navigate("/workspace/guest");
  };
  const guided = () => {
    dispatch({ type: "load_example", guided: true });
    navigate("/workspace/discovery");
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
            A small brand and an independent venue want to work together, but each has its own fees, days, space, and rules. Room for Both uses Qloo's
            taste intelligence to find which venue to approach and what to build the collaboration around, then checks every arrangement against both
            sides' stated terms and shows the smallest change that would turn a no into a maybe.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={guided}>
              <PlayCircle className="size-5" aria-hidden /> See it in 90 seconds
            </Button>
            <Button size="lg" variant="secondary" onClick={tryExample}>
              Try the fictional example <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button size="lg" variant="ghost" onClick={startCustom}>
              Start your own scenario
            </Button>
          </div>
          <p className="mt-4 text-sm text-ink-faint">The example uses two invented businesses. No account or sign-up needed.</p>
        </div>

        <figure aria-label="The example journey in three steps" className="relative">
          <ol className="card space-y-3 p-5">
            {STORY.map((s, i) => (
              <li key={s.title} className={`rounded-xl border p-3.5 ${s.tone}`}>
                <p className="eyebrow">{s.eyebrow}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{s.title}</p>
                  {i === 1 && <StatusBadge status="no_go" short />}
                  {i === 2 && <StatusBadge status="conditional" short />}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
          <figcaption className="mt-3 text-center text-xs text-ink-faint">From the fictional example. Live cultural results come from Qloo when you run it.</figcaption>
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
