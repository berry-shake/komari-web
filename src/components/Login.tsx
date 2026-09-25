import * as React from "react";
import {
  Dialog,
  Flex,
  Text,
  TextField,
  Button,
  IconButton,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { TablerSettings } from "./Icones/Tabler";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";

type LoginDialogProps = {
  trigger?: React.ReactNode | string;
  autoOpen?: boolean;
  showSettings?: boolean;
  info?: string | React.ReactNode;
  onLoginSuccess?: () => void;
  embedded?: boolean;
};

const LoginDialogContent = ({
  trigger,
  autoOpen = false,
  showSettings = true,
  info,
  onLoginSuccess,
  embedded = false,
}: LoginDialogProps) => {
  const { account, loading, error, refresh } = useAccount();
  const [t] = useTranslation();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [twoFac, setTwoFac] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [require2FA, setRequire2FA] = React.useState(false);
  const [open, setOpen] = React.useState(autoOpen || false);
  const { publicInfo } = usePublicInfo();
  // 是否启用密码登录
  const passwordLoginEnabled = !publicInfo?.disable_password_login;
  const oauthEnabled = !!publicInfo?.oauth_enable;
  const onlyOAuthLogin = oauthEnabled && !passwordLoginEnabled; // 只有 OAuth
  // Validate inputs (仅在启用密码登录时需要)
  const isFormValid =
    passwordLoginEnabled && username.trim() !== "" && password.trim() !== "";
  //console.log(autoOpen, open);
  React.useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);
  // Handle login
  const handleLogin = async () => {
    if (!isFormValid) {
      setErrorMsg("Username and password are required");
      return;
    }

    setErrorMsg("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          ...(twoFac && !account?.["2fa_enabled"]
            ? { "2fa_code": twoFac }
            : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 200) {
        if (embedded) {
          // Reconnect shared RPC sockets with the new session while keeping the current route.
          window.location.reload();
          return;
        }
        await refresh();
        if (typeof onLoginSuccess === "function") {
          onLoginSuccess();
          return;
        }
        window.open("/admin", "_self");
      } else {
        if (data.message === "2FA code is required") {
          setRequire2FA(true);
          return;
        }
        setErrorMsg(data.message || "Login failed");
      }
    } catch (err) {
      setErrorMsg("Network error");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading && isFormValid) {
      e.preventDefault(); // Prevent form submission issues
      handleLogin();
    }
  };

  if (loading && !account) {
    return <Button disabled>{t("loading")}</Button>;
  }
  if (error || !account) {
    return (
      <Button disabled color="red">
        Error
      </Button>
    );
  }
  if (account.logged_in) {
    if (!showSettings) {
      return null;
    }
    return (
      <a href="/admin" target="_blank">
        <IconButton>
          <TablerSettings></TablerSettings>
        </IconButton>
      </a>
    );
  }

  // 仅 OAuth 登录 且 不自动打开时：点击触发器直接跳转，不展示对话框
  if (onlyOAuthLogin && !autoOpen && !embedded) {
    const redirect = () => {
      window.location.href = "/api/oauth";
    };
    if (trigger) {
      // 如果提供了自定义触发器，包装一层点击
      if (typeof trigger === "string") {
        return <Button onClick={redirect}>{trigger}</Button>;
      }
      return (
        <span
          onClick={redirect}
          style={{ cursor: "pointer", display: "inline-flex" }}
        >
          {trigger}
        </span>
      );
    }
    // 默认按钮
    return <Button onClick={redirect}>{t("login.title")}</Button>;
  }
  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault(); // Prevent native form submission
        if (isFormValid && !isLoading) {
          handleLogin();
        }
      }}
    >
      <Flex direction="column" gap="3">
        {!passwordLoginEnabled && !oauthEnabled && (
          <Text role="alert" size="2" color="red">
            {t("login.no_methods")}
          </Text>
        )}
        {passwordLoginEnabled && (
          <>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                {t("login.username")}
              </Text>
              <TextField.Root
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="admin"
                disabled={isLoading}
                autoComplete="username"
                autoFocus
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                {t("login.password")}
              </Text>
              <TextField.Root
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
                type="password"
                placeholder={t("login.password_placeholder")}
                disabled={isLoading}
              />
            </label>
            <label hidden={!require2FA}>
              <Text as="div" size="2" mb="1" weight="bold">
                {t("login.two_factor")}
              </Text>
              <TextField.Root
                value={twoFac}
                onChange={(e) => setTwoFac(e.target.value)}
                onKeyDown={handleKeyDown}
                type="text"
                autoComplete="one-time-code"
                placeholder="000000"
                disabled={isLoading}
              />
            </label>
            {errorMsg && (
              <Text as="div" role="alert" size="2" color="red">
                {errorMsg}
              </Text>
            )}
            <Button
              type="submit"
              disabled={isLoading || !isFormValid}
              style={{ opacity: isLoading || !isFormValid ? 0.6 : 1 }}
            >
              {isLoading ? "Logging in..." : t("login.title")}
            </Button>
          </>
        )}
        {/* OAuth 登录按钮：即使关闭密码登录也展示 */}
        {publicInfo?.oauth_enable && (
          <Button
            onClick={() => {
              window.location.href = "/api/oauth";
            }}
            variant={passwordLoginEnabled ? "soft" : "solid"}
            disabled={isLoading}
            type="button"
          >
            {t("login.login_with", {
              provider:
                publicInfo?.oauth_provider === "generic"
                  ? "OAuth"
                  : publicInfo?.oauth_provider
                    ? publicInfo.oauth_provider.charAt(0).toUpperCase() +
                      publicInfo.oauth_provider.slice(1)
                    : "",
            })}
          </Button>
        )}
      </Flex>
    </form>
  );
  if (embedded) return form;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        {trigger ? trigger : <Button>{t("login.title")}</Button>}
      </Dialog.Trigger>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>{t("login.title")}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {t("login.desc")}
        </Dialog.Description>
        {info && (
          <Text as="p" size="2" mb="4">
            {info}
          </Text>
        )}
        {form}
      </Dialog.Content>
    </Dialog.Root>
  );
};

// Embedded login shares the admin layout's account state and preserves deep links.
export const LoginForm = () => (
  <LoginDialogContent embedded showSettings={false} />
);

const LoginDialog = (props: LoginDialogProps) => (
  <AccountProvider>
    <LoginDialogContent {...props} />
  </AccountProvider>
);
export default LoginDialog;
