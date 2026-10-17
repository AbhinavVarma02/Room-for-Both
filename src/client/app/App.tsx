import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, useLocation } from "wouter";
import { Suspense, lazy, useEffect, useRef } from "react";
import { Header, Footer } from "../components/Chrome";
import { Skeleton } from "../components/ui/primitives";
import { Landing } from "../pages/Landing";
import { NotFound } from "../pages/NotFound";
import { WorkspaceProvider } from "./store";

// The landing page renders immediately; heavier tools load on first visit to their route.
const Workspace = lazy(() => import("./Workspace").then((m) => ({ default: m.Workspace })));
const Methodology = lazy(() => import("../pages/Methodology").then((m) => ({ default: m.Methodology })));
const Respond = lazy(() => import("../features/respond/Respond").then((m) => ({ default: m.Respond })));

function PageLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 } },
});

function ScrollAndFocus() {
  const [location] = useLocation();
  const firstRender = useRef(true);
  useEffect(() => {
    // On the first load the browser's own focus order applies (skip link first). After in-app
    // navigation, move focus to the new page heading so assistive tech users land in context.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [location]);
  return null;
}

/** Collapsed sections open for printing and close again afterwards, so a printed page is never missing detail. */
function PrintExpandsSections() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [...document.querySelectorAll<HTMLDetailsElement>("details:not([open])")];
      for (const d of opened) d.open = true;
    };
    const after = () => {
      for (const d of opened) d.open = false;
      opened = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>
        <a href="#main" className="sr-only z-50 rounded-md bg-common px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        <div className="flex min-h-dvh flex-col">
          <Header />
          <main id="main" className="flex-1">
            <ScrollAndFocus />
            <PrintExpandsSections />
            <Suspense fallback={<PageLoading />}>
              <Switch>
                <Route path="/" component={Landing} />
                <Route path="/methodology" component={Methodology} />
                <Route path="/respond" component={Respond} />
                <Route path="/workspace/:step?" component={Workspace} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </main>
          <Footer />
        </div>
      </WorkspaceProvider>
    </QueryClientProvider>
  );
}
