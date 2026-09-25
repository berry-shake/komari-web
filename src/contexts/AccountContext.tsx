import React from "react";

type Account = {
  logged_in: boolean;
  sso_id: string;
  sso_type: string;
  username: string;
  uuid: string;
  "2fa_enabled": boolean;
};

interface AccountContextType {
  account: Account | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const AccountContext = React.createContext<AccountContextType | undefined>(
  undefined,
);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [account, setAccount] = React.useState<Account | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const request = React.useRef<AbortController | null>(null);

  const refresh = React.useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/me", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Failed to fetch account data");
      const data: Account = await response.json();
      if (typeof data?.logged_in !== "boolean")
        throw new Error("Invalid account response");
      if (!controller.signal.aborted) setAccount(data);
    } catch (err) {
      if (!controller.signal.aborted) {
        setAccount(null);
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to fetch account data"),
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);

  return (
    <AccountContext.Provider value={{ account, loading, error, refresh }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = React.useContext(AccountContext);
  if (!context)
    throw new Error("useAccount must be used within an AccountProvider");
  return context;
};
