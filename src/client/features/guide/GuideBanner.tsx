import { ArrowRight, Compass, X } from "lucide-react";
import { useLocation } from "wouter";
import { evaluateScenario } from "@shared/domain";
import { linkedSelection } from "@shared/domain/brief";
import { closestToWorking, featuredOption } from "@shared/domain/headline";
import { useWorkspace } from "../../app/store";
import { type StepId, stepHref } from "../../app/Workspace";
import { Button } from "../../components/ui/primitives";
import { useSelectVenue } from "../discovery/selectVenue";

/**
 * The guided demonstration: one sentence and one action per step, over the same screens and data as
 * the full workflow. It never changes a result; it only decides what to show next.
 */
export function GuideBanner({ step }: { step: StepId }) {
  const { state, dispatch } = useWorkspace();
  const [, navigate] = useLocation();
  const selectVenue = useSelectVenue();
  if (!state.guided) return null;

  const run = state.research;
  const top = run?.candidates[0];
  const linked = state.host ? linkedSelection(state.host, state.selection) : null;
  const evaluation = state.guest && state.host ? evaluateScenario({ guest: state.guest, host: state.host }) : null;
  const go = (s: StepId, query = "") => navigate(`${stepHref(s)}${query}`);

  let index = 1;
  let text: string;
  let action: { label: string; run: () => void } | null = null;
  switch (step) {
    case "guest":
      text = "This fictional skincare brand names three cultural references its customers love. You can skip its form: the example is already filled in.";
      action = { label: "Start the cultural research", run: () => go("discovery") };
      break;
    case "discovery":
      index = 2;
      if (!run) {
        text = "Qloo matches the brand's references and ranks real venues in its area by how strongly their audiences share that taste.";
      } else if (top) {
        text = `Qloo ranked these venues by affinity to the brand's references, and the comparison below shows what the taste signal changed. The guide picks #1, ${top.venue.name}; you can choose any other venue below instead.${run.mode === "live" ? " Qloo does not say whether a venue is independent or part of a chain, so check before reaching out." : ""}`;
        action = {
          label: `Choose ${top.venue.name}`,
          run: () => {
            if (selectVenue(run, top.venue.id, { hypothetical: true })) go("host");
          },
        };
      } else {
        text = "This search found no venues, so the guide continues with the fictional example host.";
        action = { label: "Continue", run: () => go("host") };
      }
      break;
    case "host":
      index = 3;
      text = linked
        ? `Nobody has ${linked.candidate.venue.name}'s terms yet, so the guide explores with hypothetical terms, labelled on every screen. Look at where the two sides' cultural evidence meets.`
        : "The host states its own terms. In this example they are fictional and labelled as such.";
      action = {
        label: "See which arrangements work",
        run: () => {
          if (linked && state.host?.source !== "hypothetical_scenario") dispatch({ type: "use_hypothetical_terms" });
          go("frontier");
        },
      };
      break;
    case "frontier": {
      index = 4;
      const featured = evaluation ? featuredOption(evaluation) : null;
      const closest = evaluation ? closestToWorking(evaluation) : null;
      text = featured
        ? `Nine arrangements are checked against both sides' terms. The obvious first proposal, ${featured.label}, is ${featured.status === "no_go" ? "blocked" : featured.status}; the card below says exactly why.`
        : "Nine arrangements are checked against both sides' terms.";
      const target = featured?.status === "no_go" && evaluation?.reversals.some((r) => r.optionId === featured.id && r.minimalChange?.verified) ? featured : closest?.option;
      action = { label: "Find the smallest change", run: () => go("reversal", target ? `?option=${encodeURIComponent(target.id)}` : "") };
      break;
    }
    case "reversal":
      index = 5;
      text = "Apply the highlighted change and watch the status re-check with the same rules. Every value here stays hypothetical.";
      action = { label: "Build the decision brief", run: () => go("brief") };
      break;
    case "brief":
      index = 6;
      text = "The brief ties it together: the venue and why it was suggested, the arrangement, the activation idea, and what is still unverified.";
      action = { label: "Finish the guide", run: () => dispatch({ type: "end_guide" }) };
      break;
  }

  return (
    <aside className="no-print mt-5 rounded-xl border border-common/30 bg-surface p-4 shadow-sm" aria-label="Guided example">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex min-w-0 flex-1 items-start gap-2.5 text-sm">
          <Compass className="mt-0.5 size-5 shrink-0 text-common" aria-hidden />
          <span>
            <span className="font-semibold">Guided example · {index} of 6.</span> {text}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {action && (
            <Button size="sm" onClick={action.run}>
              {action.label} <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "end_guide" })} aria-label="Exit the guided example">
            <X className="size-4" aria-hidden /> Exit guide
          </Button>
        </div>
      </div>
    </aside>
  );
}
