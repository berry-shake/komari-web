import { useRef, useState } from "react";
import { IconButton } from "@radix-ui/themes";
import { CalendarPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNodeDetails, type NodeDetail } from "@/contexts/NodeDetailsContext";
import { computeRenewalDate, formatRenewalExpiry, isRenewalDue } from "@/utils/renewal";

export function RenewalButton({ node }: { node: NodeDetail }) {
  const { t, i18n } = useTranslation();
  const { refresh } = useNodeDetails();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  // Do not reuse the old expiry while the refreshed list is still loading.
  const [submittedExpiry, setSubmittedExpiry] = useState<string | null>(null);
  const nextExpiry = computeRenewalDate(new Date(node.expired_at), node.billing_cycle);
  const timestamp = nextExpiry ? formatRenewalExpiry(nextExpiry, node.expired_at) : null;

  if (!isRenewalDue(node.expired_at) || submittedExpiry === node.expired_at) {
    return null;
  }

  const renew = async () => {
    if (inFlight.current || !nextExpiry || !timestamp) return;
    // The eligibility window may have elapsed since the last render.
    if (!isRenewalDue(node.expired_at)) {
      refresh();
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/client/${node.uuid}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expired_at: timestamp }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setSubmittedExpiry(node.expired_at);
      refresh();
      toast.success(t("admin.nodeTable.renewSuccess", {
        name: node.name,
        date: nextExpiry.toLocaleString(i18n.resolvedLanguage),
      }));
    } catch (error) {
      toast.error(t("admin.nodeTable.renewFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <IconButton
      variant="ghost"
      title={t(timestamp ? "admin.nodeTable.renew" : "admin.nodeTable.renewUnavailable")}
      aria-label={t("admin.nodeTable.renew")}
      loading={pending}
      disabled={pending || !timestamp}
      onClick={renew}
    >
      <CalendarPlus size="18" />
    </IconButton>
  );
}
