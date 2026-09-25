import { Outlet } from "react-router-dom";
import { Button, Dialog } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AdminPanelBar from "./AdminPanelBar";
import { updateSettingsWithToast, useSettings } from "@/lib/api";
import { Eula } from "@/utils/field";
import { normalizeLanguage } from "@/utils/language";

const AuthenticatedAdmin = () => {
  const { settings, loading, error } = useSettings();
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const language = i18n.resolvedLanguage || i18n.language;

  useEffect(() => {
    setOpen(
      !loading &&
        !error &&
        settings.eula_accepted === false &&
        normalizeLanguage(language).startsWith("zh"),
    );
  }, [loading, error, settings, language]);

  return (
    <>
      <Dialog.Root open={open}>
        <Dialog.Content>
          <Dialog.Title>法律声明与合规指引</Dialog.Title>
          <div className="flex flex-col gap-2">
            <div className="max-h-[70vh] overflow-y-auto space-y-4">
              <pre className="text-wrap">{Eula}</pre>
            </div>
            <div className="flex flex-row gap-2 justify-end items-center">
              <Button variant="soft" color="red" onClick={() => window.close()}>
                不接受
              </Button>
              <Button
                variant="solid"
                onClick={() => {
                  void updateSettingsWithToast(
                    { eula_accepted: true },
                    (key) => key,
                  )
                    .then(() => setOpen(false))
                    .catch(() => {});
                }}
              >
                我已详细阅读并接受
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <AdminPanelBar content={<Outlet />} />
    </>
  );
};

export default AuthenticatedAdmin;
