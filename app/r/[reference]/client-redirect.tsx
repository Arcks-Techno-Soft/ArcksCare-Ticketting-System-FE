"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BrandMark } from "@/components/brand-mark";

const ANDROID_PACKAGE = "com.arckstechnosoft.skposcare";

export function ClientRedirect({ reference }: { reference: string }) {
  const webUrl = `/admin/tickets/${encodeURIComponent(reference)}`;

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isAndroid = /Android/i.test(ua);

    if (isAndroid) {
      // Android intent: launches the app if installed (deep link to the same
      // /tickets/:ref route inside the app), otherwise Android opens the
      // browser_fallback_url for us.
      const fallback = encodeURIComponent(`${window.location.origin}${webUrl}`);
      const intentUrl =
        `intent://tickets/${encodeURIComponent(reference)}` +
        `#Intent;scheme=skposcare;package=${ANDROID_PACKAGE};` +
        `S.browser_fallback_url=${fallback};end`;
      window.location.href = intentUrl;
    } else {
      window.location.replace(webUrl);
    }

    // Failsafe — if the intent silently does nothing for any reason, go to web.
    const failsafe = window.setTimeout(() => {
      window.location.replace(webUrl);
    }, 2500);
    return () => window.clearTimeout(failsafe);
  }, [reference, webUrl]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-sm text-center">
        <BrandMark className="mx-auto h-10 w-10" />
        <p className="mt-6 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
          Opening ticket
        </p>
        <h1 className="mt-2 font-mono text-2xl font-medium text-ink">
          {reference}
        </h1>
        <p className="mt-4 text-[14px] text-ink-muted">
          If nothing happens in a couple of seconds —
        </p>
        <Link
          href={webUrl}
          className="mt-3 inline-block text-[14px] font-medium text-ink underline underline-offset-4 hover:no-underline"
        >
          Open in the browser
        </Link>
      </div>
    </main>
  );
}
