import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="honeycomb-bg flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-3 text-muted-foreground">Page not found</p>
        <div className="mt-6">
          <Link to="/" className="myo-btn">Go home</Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#191c26" },
      { title: "MyoTime — Interval Timer for Workouts" },
      { name: "description", content: "MyoTime is a mobile-first interval timer for exercise workouts. Build custom workouts and let voice and beep cues guide your transitions." },
      { property: "og:title", content: "MyoTime — Interval Timer for Workouts" },
      { property: "og:description", content: "MyoTime is a mobile-first interval timer for exercise workouts. Build custom workouts and let voice and beep cues guide your transitions." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "MyoTime — Interval Timer for Workouts" },
      { name: "twitter:description", content: "MyoTime is a mobile-first interval timer for exercise workouts. Build custom workouts and let voice and beep cues guide your transitions." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/63a21178-ef63-4a57-a3f9-2352184f70cc/id-preview-3bea3a9e--98160f9d-0f05-4596-82e7-f6a0d6ba9d7a.lovable.app-1777332839989.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/63a21178-ef63-4a57-a3f9-2352184f70cc/id-preview-3bea3a9e--98160f9d-0f05-4596-82e7-f6a0d6ba9d7a.lovable.app-1777332839989.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:ital,wght@0,800;1,800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: () => <Outlet />,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
