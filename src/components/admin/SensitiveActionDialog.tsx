import { useState } from "react";
import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { useAccount } from "@/contexts/AccountContext";
import { SensitiveActionError } from "@/lib/sensitiveAction";

interface Props {
  title: string;
  onConfirm: (code: string) => Promise<void>;
  onClose: () => void;
}

// Mount only while an action is pending so codes/errors never survive reopening.
export default function SensitiveActionDialog({ title, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const { account } = useAccount();
  const [requiresOTP, setRequiresOTP] = useState(Boolean(account?.["2fa_enabled"]));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{t(requiresOTP ? "security.otp_required" : "security.confirm_action")}</Dialog.Description>
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await onConfirm(code);
            setCode("");
            onClose();
          } catch (err) {
            if (err instanceof SensitiveActionError && err.status === 401) setRequiresOTP(true);
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}>
          <Flex direction="column" gap="3" mt="4">
            {requiresOTP && <TextField.Root
              aria-label={t("account.2fa_otp_input_prompt")}
              autoFocus inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" maxLength={6} required
              placeholder="000000" value={code} disabled={busy}
              onChange={(event) => setCode(event.target.value)}
            />}
            {error && <Text color="red" role="alert">{error}</Text>}
            <Flex gap="3" justify="end">
              <Button variant="soft" type="button" disabled={busy} onClick={onClose}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={busy}>{t(busy ? "security.processing" : "common.confirm")}</Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
