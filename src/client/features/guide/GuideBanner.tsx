import { ArrowRight, Compass, X } from "lucide-react";
import { useLocation } from "wouter";
import { evaluateScenario } from "@shared/domain";
import { linkedSelection } from "@shared/domain/brief";
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
  let action: { label: string; run: () => void; secondary?: boolean } | null = null;
  switch (step) {
    case "guest":
      text = "A fictional skincare brand with three cultural references its customers love. The form is already filled in.";
      action = { label: "Start the cultural research", run: () => go("discovery") };
      break;
    case "discovery":
      index = 2;
      if (!run) {
        text = "Qloo matches the brand's references and ranks venues in its area by how strongly their audiences share that taste.";
      } else if (top) {
        text = `Qloo ranked these venues by shared taste with the brand. The guide picks #1, ${top.venue.name}; you can choose another below.${run.mode === "live" ? " Qloo does not say whether a venue is independent, so check before reaching out." : ""}`;
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
        ? `Nobody has ${linked.candidate.venue.name}'s terms yet, so the guide uses hypothetical terms, labelled on every screen.`
        : "The host states its own terms. In this example they are fictional and labelled as such.";
      action = {
        label: "See which arrangements work",
        run: () => {
          if (linked && state.host?.source !== "hypothetical_scenario") dispatch({ type: "use_hypothetical_terms" });
          go("frontier");
        },
      };
      break;
    case "frontier":
      index = 4;
      // The page's own "Explore the change" is this step's single action, so the guide only points to it.
      text = evaluation?.counts.feasible
        ? "Every arrangement is checked against both sides' terms. The panel below shows the one ready to discuss."
        : "Every arrangement is checked against both sides' terms. Below: the one closest to agreement and the change that would unblock it.";
      break;
    case "reversal":
      index = 5;
      text = "Apply the suggested change and watch the status re-check with the same rules. Every value here stays hypothetical.";
      action = { label: "Build the decision brief", run: () => go("brief"), secondary: true };
      break;
    case "brief":
      index = 6;
      text = "The brief ties it together: the venue, the arrangement, the idea, and what is still unverified.";
      action = { label: "Finish the guide", run: () => dispatch({ type: "end_guide" }), secondary: true };
      break;
  }

  return (
    <aside
      className="no-print mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-common/25 bg-surface px-3.5 py-2.5 text-sm"
      aria-label="Guided example"
    >
      <p className="flex min-w-0 flex-1 basis-72 items-start gap-2">
        <Compass className="mt-0.5 size-4 shrink-0 text-common" aria-hidden />
        <span>
          <span className="font-semibold">Guide {index}/6</span> <span className="text-ink-soft">{text}</span>
        </span>
      </p>
      <div className="flex items-center gap-1">
        {action && (
          <Button size="sm" variant={action.secondary ? "secondary" : "primary"} onClick={action.run}>
            {action.label} <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "end_guide" })} aria-label="Exit the guided example">
          <X className="size-4" aria-hidden /> Exit
        </Button>
      </div>
    </aside>
  );
}
