import {
  SettingCardLabel,
  SettingCardSelect,
  SettingCard,
  SettingCardSwitch,
} from "@/components/admin/SettingCard";
import { updateSettings, updateSettingsWithToast, useSettings } from "@/lib/api";
import { Badge, Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import Loading from "@/components/loading";
import React from "react";
import { renderProviderInputs } from "@/utils/renderProviders";
import { toast } from "sonner";
import SensitiveActionDialog from "@/components/admin/SensitiveActionDialog";
import { generateAPIKey, sensitiveRequest } from "@/lib/sensitiveAction";

export default function SignOnSettings() {
  const { t } = useTranslation();
  const { settings, loading, error } = useSettings();
  const [providerDefs, setProviderDefs] = React.useState<any>({});
  const [providerList, setProviderList] = React.useState<string[]>([]);
  const [currentProvider, setCurrentProvider] = React.useState<string>("");
  const [providerValues, setProviderValues] = React.useState<any>({});
  const [providerLoading, setProviderLoading] = React.useState(false);
  const [providerError, setProviderError] = React.useState("");


  // 拉取所有 provider 及字段定义
  React.useEffect(() => {
    if (loading) return;
    setProviderLoading(true);
    fetch("/api/admin/settings/oidc")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" && data.data) {
          setProviderDefs(data.data);
          const providers = Object.keys(data.data);
          setProviderList(providers);
          const initialProvider =
            settings.o_auth_provider && providers.includes(settings.o_auth_provider)
              ? settings.o_auth_provider
              : "";
          setCurrentProvider(initialProvider);
        } else {
          setProviderError(data.message || t("settings.sso.provider_fetch_failed"));
        }
      })
      .catch(() => setProviderError(t("settings.sso.provider_fetch_failed")))
      .finally(() => setProviderLoading(false));
  }, [loading, settings.o_auth_provider, t]);

  // 拉取当前 provider 的设置
  React.useEffect(() => {
    if (!currentProvider) return;
    setProviderLoading(true);
    fetch(`/api/admin/settings/oidc?provider=${currentProvider}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" && data.data) {
          try {
            setProviderValues(JSON.parse(data.data.addition || "{}"));
          } catch {
            setProviderValues({});
          }
        } else {
          setProviderError(data.message || t("settings.sso.provider_settings_fetch_failed"));
        }
      })
      .catch(() => setProviderError(t("settings.sso.provider_settings_fetch_failed")))
      .finally(() => setProviderLoading(false));
  }, [currentProvider, t]);

  // 处理保存
  const handleOidcSave = async (values: any) => {
    setProviderLoading(true);
    setProviderError("");
    const body = {
      name: currentProvider,
      addition: JSON.stringify(values),
    };
    try {
      const res = await fetch("/api/admin/settings/oidc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.status !== "success") {
        setProviderError(data.message || t("settings.sso.provider_save_failed"));
      } else {
        setProviderValues(values);
      }
    } catch {
      setProviderError(t("settings.sso.provider_save_failed"));
    }
    setProviderLoading(false);
  };

  // 渲染 provider 的输入项已抽象到 utils/renderProviders.tsx 中

  if (loading || (!providerLoading && providerList.length === 0 && !providerError)) {
    return <Loading />;
  }
  if (error) {
    return <Text color="red">{error}</Text>;
  }
  if (providerError) {
    return <Text color="red">{providerError}</Text>;
  }

  return (
    <>
      <SettingCardLabel>{t("settings.sign_on.title")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("settings.sign_on.disable_password")}
        defaultChecked={settings.disable_password_login}
        onChange={async (checked) => {
          await updateSettingsWithToast({ disable_password_login: checked }, t);
        }}
      />
      <SettingCardLabel>{t("settings.sso.title")}</SettingCardLabel>
      <SettingCardSwitch
        title={t("settings.sso.enable")}
        defaultChecked={settings.o_auth_enabled}
        description={t("settings.sso.enable_description")}
        onChange={async (checked) => {
          await updateSettingsWithToast({ o_auth_enabled: checked }, t);
        }}
      />
      <SettingCardSelect
        title={String(t("settings.sso.provider"))}
        description={String(t("settings.sso.provider_description"))}
        options={providerList.map((p) => ({ value: p, label: p }))}
        value={currentProvider}
        OnSave={async (val: string) => {
          if (val === currentProvider) return;
          await updateSettingsWithToast({ o_auth_provider: val }, t);
          setCurrentProvider(val);
        }}
      />
      {providerLoading ? <Loading /> : renderProviderInputs({
        currentProvider,
        providerDefs,
        providerValues,
        translationPrefix: "settings.sso." + currentProvider,
        title: t("settings.sso.provider_fields"),
        description: t("settings.sso.provider_fields_description"),
        footer: t("settings.sso.callback_url_tips", { url: `${window.location.origin}/api/oauth_callback` }),
        setProviderValues,
        handleSave: handleOidcSave,
        t,
      })}
      <SettingCardLabel>API</SettingCardLabel>
      <ApiCard />
    </>
  );
}

const ApiCard = () => {
  const { settings, loading, refetch } = useSettings();
  const { t } = useTranslation();
  const [apiValues, setApiValues] = React.useState("");
  const [action, setAction] = React.useState<"save" | "clear" | "reveal" | null>(null);
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);
  const configured = Boolean(settings.api_key_configured);

  React.useEffect(() => {
    if (revealedKey === null) return;
    const timer = window.setTimeout(() => setRevealedKey(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [revealedKey]);

  return (
    <SettingCard title={t("settings.api.title")} description={t("security.api_key_hint")}>
      <Flex direction="column" gap="3" className="w-full" mt="3">
        <div><Badge color={configured ? "green" : "gray"}>{t(configured ? "security.key_configured" : "security.key_empty")}</Badge></div>
        <TextField.Root type="password" autoComplete="new-password"
          aria-label={t("settings.api.title")} placeholder={t("security.new_api_key")}
          value={apiValues} onChange={(event) => setApiValues(event.target.value)} />
        <Flex gap="2" wrap="wrap">
          <Button variant="soft" disabled={loading} onClick={() => setApiValues(generateAPIKey())}>{t("common.generate")}</Button>
          <Button disabled={loading || !apiValues} onClick={() => {
            if (apiValues.length < 12) { toast.error(t("settings.api.key_length_error")); return; }
            setAction("save");
          }}>{t("common.save")}</Button>
          <Button variant="soft" disabled={loading || !configured} onClick={() => setAction("reveal")}>{t("security.reveal_key")}</Button>
          <Button variant="soft" color="red" disabled={loading || !configured} onClick={() => setAction("clear")}>{t("security.clear_key")}</Button>
        </Flex>
      </Flex>
      {action && <SensitiveActionDialog
        title={t(action === "reveal" ? "security.reveal_key" : action === "clear" ? "security.clear_key" : "security.save_key")}
        onClose={() => setAction(null)}
        onConfirm={async (code) => {
          if (action === "reveal") {
            const response = await sensitiveRequest("/api/admin/settings/api-key/reveal", { method: "POST" }, code);
            const data = await response.json();
            setRevealedKey(data.data.api_key);
          } else {
            await updateSettings({ api_key: action === "clear" ? "" : apiValues }, code);
            setApiValues("");
            setRevealedKey(null);
            await refetch();
            toast.success(t("settings.settings_saved"));
          }
        }}
      />}
      <Dialog.Root open={revealedKey !== null} onOpenChange={(open) => { if (!open) setRevealedKey(null); }}>
        <Dialog.Content maxWidth="560px">
          <Dialog.Title>{t("security.reveal_key")}</Dialog.Title>
          <Dialog.Description>{t("security.key_visible_hint")}</Dialog.Description>
          <TextField.Root mt="4" aria-label={t("settings.api.title")} value={revealedKey ?? ""} readOnly />
          <Flex justify="end" mt="4"><Dialog.Close><Button>{t("common.close")}</Button></Dialog.Close></Flex>
        </Dialog.Content>
      </Dialog.Root>
    </SettingCard>
  );
};
