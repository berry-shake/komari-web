import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { LoginForm } from "@/components/Login";

// Do not mount the shell, its settings requests, or nested routes before authentication.
const AuthenticatedAdmin = lazy(
  () => import("@/components/admin/AuthenticatedAdmin"),
);

const AdminLoading = () => {
  const { t } = useTranslation();
  return (
    <main
      className="min-h-screen flex items-center justify-center bg-accent-1"
      role="status"
      aria-label={t("loading")}
    >
      <Spinner size="3" />
    </main>
  );
};

const AdminAccess = () => {
  const { account, loading, error, refresh } = useAccount();
  const {
    publicInfo,
    error: publicError,
    refresh: refreshPublicInfo,
  } = usePublicInfo();
  const { t } = useTranslation();

  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    const timer = window.setInterval(recheck, 60_000);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (account?.logged_in && !error) {
    return (
      <Suspense fallback={<AdminLoading />}>
        <AuthenticatedAdmin />
      </Suspense>
    );
  }

  const failed = !!error || !!publicError;
  const checking = !failed && ((loading && !account) || !publicInfo);
  if (checking) return <AdminLoading />;

  return (
    <main className="min-h-screen flex items-center justify-center bg-accent-1 p-6">
      <Card size="4" className="w-full max-w-[420px]">
        <Flex direction="column" gap="5">
          <Flex direction="column" gap="2">
            <Text size="2" color="gray" weight="medium">
              Komari
            </Text>
            <Heading as="h1" size="6">
              {t("login.admin_title")}
            </Heading>
            <Text size="2" color="gray">
              {t("login.admin_description")}
            </Text>
          </Flex>
          {failed ? (
            <Flex direction="column" gap="3">
              <Text role="alert" size="2" color="red">
                {t("login.session_error")}
              </Text>
              <Button
                onClick={() => {
                  void refresh();
                  refreshPublicInfo();
                }}
              >
                {t("common.retry")}
              </Button>
            </Flex>
          ) : (
            <LoginForm />
          )}
          <Link
            className="text-sm text-[var(--gray-11)] hover:underline self-center"
            to="/"
          >
            {t("login.back_home")}
          </Link>
        </Flex>
      </Card>
    </main>
  );
};

const AdminLayout = () => (
  <AccountProvider>
    <AdminAccess />
  </AccountProvider>
);
export default AdminLayout;
