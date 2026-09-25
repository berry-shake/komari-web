import { useEffect, useState } from "react";
import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { sensitiveRequest } from "@/lib/sensitiveAction";

export default function TwoFactorSetup({ replacing = false, onComplete }: {
  replacing?: boolean;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = t(replacing ? "security.replace_2fa" : "account.enable_2fa");
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <Dialog.Trigger><Button variant={replacing ? "soft" : "solid"}>{title}</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{t(replacing ? "security.replace_2fa_hint" : "account.2fa_qr_code_hint")}</Dialog.Description>
        {open && <EnrollmentForm replacing={replacing} busy={busy} setBusy={setBusy} onComplete={() => {
          setOpen(false);
          toast.success(t("common.updated_successfully"));
          onComplete();
        }} />}
      </Dialog.Content>
    </Dialog.Root>
  );
}

function EnrollmentForm({ replacing, busy, setBusy, onComplete }: {
  replacing: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const [oldCode, setOldCode] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQR] = useState("");
  const [error, setError] = useState("");
  useEffect(() => () => { if (qr) URL.revokeObjectURL(qr); }, [qr]);

  return <form onSubmit={async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!qr) {
        const response = await sensitiveRequest("/api/admin/2fa/generate", { method: "POST" }, oldCode);
        setQR(URL.createObjectURL(await response.blob()));
        setOldCode("");
      } else {
        await sensitiveRequest("/api/admin/2fa/enable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        setCode("");
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }}>
    <Flex direction="column" gap="3" mt="4">
      {!qr && replacing && <>
        <Text as="label" htmlFor="previous-factor-code">{t("security.current_otp")}</Text>
        <TextField.Root id="previous-factor-code" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} required autoFocus placeholder="000000"
          value={oldCode} disabled={busy} onChange={(event) => setOldCode(event.target.value)} />
      </>}
      {qr && <>
        <img src={qr} alt={t("account.2fa_qr_code_hint")} width={250} height={250} className="self-center" />
        <Text as="label" htmlFor="new-factor-code">{t("security.new_otp")}</Text>
        <TextField.Root id="new-factor-code" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} required autoFocus placeholder="000000"
          value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} />
        <Text size="2" color="gray">{t("security.enrollment_expiry")}</Text>
      </>}
      {error && <Text role="alert" color="red">{error}</Text>}
      <Flex gap="3" justify="end">
        {qr && <Button type="button" variant="soft" disabled={busy} onClick={() => {
          setQR(""); setCode(""); setOldCode(""); setError("");
        }}>{t("security.restart_enrollment")}</Button>}
        <Button type="submit" disabled={busy}>{t(busy ? "security.processing" : qr ? "common.confirm" : "security.generate_qr")}</Button>
      </Flex>
    </Flex>
  </form>;
}
