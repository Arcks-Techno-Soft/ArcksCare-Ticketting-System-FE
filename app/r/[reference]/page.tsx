import { ClientRedirect } from "./client-redirect";

/**
 * Smart redirect for WhatsApp notification links.
 *
 * On Android: fires an Android intent URL — if the SK-POS Support app is
 * installed, the OS opens it directly to the ticket; otherwise Android
 * automatically falls back to the web URL.
 *
 * On anything else: replaces straight to the web admin ticket page.
 */
export default async function NotificationRedirectPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const cleaned = decodeURIComponent(reference).toUpperCase();
  return <ClientRedirect reference={cleaned} />;
}
