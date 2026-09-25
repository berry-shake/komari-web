import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Switch,
  Table,
  Tabs,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";

type Settings = {
  enabled: boolean;
  interval: number;
  notify: boolean;
  api_token_set: boolean;
  running: boolean;
};
type Node = {
  uuid: string;
  name: string;
  online: boolean;
  ipv4: string;
  ipv6: string;
};
type RecordEntry = {
  id: string;
  record_name: string;
  record_type: "A" | "AAAA";
  zone_id: string;
  source_node: string[];
  ttl: number;
  proxied: boolean;
  comment: string;
  api_token_set: boolean;
  last_ip: string;
  last_node: string;
  last_action: string;
  last_error: string;
  last_checked_at: string | null;
  last_update_at: string | null;
};
type LogEntry = {
  id: number;
  time: string;
  record_name: string;
  record_type: string;
  action: string;
  success: boolean;
  detail: string;
  ip: string;
};
type LogPage = {
  logs: LogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
type Draft = Pick<
  RecordEntry,
  | "record_name"
  | "record_type"
  | "zone_id"
  | "source_node"
  | "ttl"
  | "proxied"
  | "comment"
> & { api_token: string; clear_api_token: boolean };
const emptyDraft = (): Draft => ({
  record_name: "",
  record_type: "A",
  zone_id: "",
  source_node: [],
  ttl: 1,
  proxied: false,
  comment: "",
  api_token: "",
  clear_api_token: false,
});
const ttlOptions = [
  1, 60, 120, 300, 600, 900, 1800, 3600, 7200, 18000, 43200, 86400,
];
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/admin/ddns/${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const result = await response.json();
  if (!response.ok || result.status !== "success")
    throw new Error(result.message || `HTTP ${response.status}`);
  return result.data as T;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="medium">
        {label}
      </Text>
      {children}
    </Flex>
  );
}
export default function DDNSPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [token, setToken] = useState("");
  const [clearToken, setClearToken] = useState(false);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [logQuery, setLogQuery] = useState({
    record: "",
    page: 1,
    pageSize: 20,
  });
  const [logPage, setLogPage] = useState<LogPage>({
    logs: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
  });
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ record: RecordEntry | null } | null>(
    null,
  );
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [removing, setRemoving] = useState<RecordEntry | null>(null);
  const [clearLogsOpen, setClearLogsOpen] = useState(false);
  const time = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "—";
  const refresh = useCallback(async () => {
    const [r, n] = await Promise.all([
      request<RecordEntry[]>("records"),
      request<Node[]>("nodes"),
    ]);
    setRecords(r);
    setNodes(n);
    // Refresh and mutations show the latest entries, including after clearing.
    setLogQuery((current) => ({ ...current, page: 1 }));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLogsLoading(true);
    setLogsError("");
    const params = new URLSearchParams({
      page: String(logQuery.page),
      page_size: String(logQuery.pageSize),
    });
    if (logQuery.record) params.set("record", logQuery.record);
    request<LogPage>(`logs?${params}`, "GET", undefined, controller.signal)
      .then((result) => {
        if (!cancelled) setLogPage(result);
      })
      .catch((e) => {
        if (!cancelled)
          setLogsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [logQuery]);
  useEffect(() => {
    let cancelled = false;
    request<Settings>("settings")
      .then((value) => {
        if (!cancelled) setSettings(value);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(String(e.message)));
  }, [refresh]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const openEditor = (record: RecordEntry | null) => {
    setDraft(
      record
        ? {
            record_name: record.record_name,
            record_type: record.record_type,
            zone_id: record.zone_id,
            source_node: [...record.source_node],
            ttl: record.ttl,
            proxied: record.proxied,
            comment: record.comment,
            api_token: "",
            clear_api_token: false,
          }
        : emptyDraft(),
    );
    setEditor({ record });
    setError("");
  };
  const saveSettings = () =>
    run(async () => {
      if (!settings) return;
      await request("settings", "PUT", {
        enabled: settings.enabled,
        interval: settings.interval,
        notify: settings.notify,
        ...(token ? { api_token: token } : {}),
        clear_api_token: clearToken,
      });
      setSettings(await request<Settings>("settings"));
      setToken("");
      setClearToken(false);
      setNotice(t("ddns.saved"));
    });
  const sync = () =>
    run(async () => {
      const result = await request<{
        changed: number;
        skipped: number;
        errors: number;
      }>("sync", "POST");
      await refresh();
      if (result.errors > 0) setError(t("ddns.sync_result", result));
      else setNotice(t("ddns.sync_result", result));
    });
  const saveRecord = () =>
    run(async () => {
      if (!editor) return;
      await request(
        editor.record ? `records/${editor.record.id}` : "records",
        editor.record ? "PUT" : "POST",
        { ...draft, api_token: draft.api_token || undefined },
      );
      setEditor(null);
      await refresh();
      setNotice(t("ddns.saved"));
    });
  return (
    <Flex direction="column" gap="4" className="p-4">
      <Flex justify="between" align="start" gap="3" wrap="wrap">
        <Box>
          <Text as="div" size="6" weight="bold">
            DDNS
          </Text>
          <Text as="p" color="gray" size="2">
            {t("ddns.description")}
          </Text>
        </Box>
        <Flex gap="2">
          <Button variant="soft" disabled={busy} onClick={() => run(refresh)}>
            {t("ddns.refresh")}
          </Button>
          <Button disabled={busy || records.length === 0} onClick={sync}>
            {busy ? t("ddns.working") : t("ddns.sync_now")}
          </Button>
        </Flex>
      </Flex>
      {error && (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
      {notice && (
        <Callout.Root color="green" role="status">
          <Callout.Text>{notice}</Callout.Text>
        </Callout.Root>
      )}
      <Card>
        {settings ? (
          <Flex direction="column" gap="4">
            <Flex align="center" gap="3" wrap="wrap">
              <Text weight="bold">{t("ddns.settings")}</Text>
              <Badge color={settings.api_token_set ? "green" : "gray"}>
                {settings.api_token_set
                  ? t("ddns.token_set")
                  : t("ddns.token_unset")}
              </Badge>
            </Flex>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("ddns.token")}>
                <TextField.Root
                  type="password"
                  aria-label={t("ddns.token")}
                  autoComplete="new-password"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setClearToken(false);
                  }}
                  placeholder={
                    settings.api_token_set
                      ? t("ddns.keep_token")
                      : t("ddns.enter_token")
                  }
                />
                <Text size="1" color="gray">
                  {t("ddns.token_help")}
                </Text>
                {settings.api_token_set && (
                  <Text as="label" size="2">
                    <Flex gap="2" align="center">
                      <Checkbox
                        checked={clearToken}
                        onCheckedChange={(v) => {
                          setClearToken(v === true);
                          if (v) setToken("");
                        }}
                      />
                      {t("ddns.clear_token")}
                    </Flex>
                  </Text>
                )}
              </Field>
              <Field label={t("ddns.interval")}>
                <TextField.Root
                  type="number"
                  min={1}
                  max={1440}
                  aria-label={t("ddns.interval")}
                  value={settings.interval}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      interval: Number(e.target.value),
                    })
                  }
                />
                <Text size="1" color="gray">
                  {t("ddns.online_only")}
                </Text>
              </Field>
            </div>
            <Flex align="center" gap="4" wrap="wrap">
              <Text as="label" size="2">
                <Flex gap="2" align="center">
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(enabled) =>
                      setSettings({ ...settings, enabled })
                    }
                  />
                  {t("ddns.schedule")}
                </Flex>
              </Text>
              <Text as="label" size="2">
                <Flex gap="2" align="center">
                  <Switch
                    checked={settings.notify}
                    onCheckedChange={(notify) =>
                      setSettings({ ...settings, notify })
                    }
                  />
                  {t("ddns.notify")}
                </Flex>
              </Text>
              <Button variant="soft" disabled={busy} onClick={saveSettings}>
                {t("ddns.save_settings")}
              </Button>
            </Flex>
          </Flex>
        ) : (
          <Text>{t("ddns.loading")}</Text>
        )}
      </Card>
      <Tabs.Root defaultValue="records">
        <Flex align="center" justify="between" gap="3">
          <Tabs.List>
            <Tabs.Trigger value="records">
              {t("ddns.records")} ({records.length})
            </Tabs.Trigger>
            <Tabs.Trigger value="logs">{t("ddns.logs")}</Tabs.Trigger>
          </Tabs.List>
          <Button
            disabled={busy}
            variant="soft"
            onClick={() => openEditor(null)}
          >
            {t("ddns.add")}
          </Button>
        </Flex>
        <Tabs.Content value="records">
          <Box pt="3" overflowX="auto">
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  {[
                    "name",
                    "type",
                    "source",
                    "proxy",
                    "ttl",
                    "current_ip",
                    "last_check",
                    "actions",
                  ].map((key) => (
                    <Table.ColumnHeaderCell key={key}>
                      {t(`ddns.${key}`)}
                    </Table.ColumnHeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {records.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={8}>
                      <Text color="gray">{t("ddns.empty")}</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  records.map((record) => (
                    <Table.Row key={record.id}>
                      <Table.RowHeaderCell>
                        <Text as="div" weight="medium">
                          {record.record_name}
                        </Text>
                        {record.comment && (
                          <Text size="1" color="gray">
                            {record.comment}
                          </Text>
                        )}
                        {record.last_error && (
                          <Text
                            as="div"
                            size="1"
                            color="red"
                            style={{ maxWidth: 340, overflowWrap: "anywhere" }}
                          >
                            {record.last_error}
                          </Text>
                        )}
                      </Table.RowHeaderCell>
                      <Table.Cell>
                        <Badge variant="soft">{record.record_type}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {record.source_node.map((id) => (
                          <Text as="div" key={id} size="2">
                            {nodes.find((n) => n.uuid === id)?.name || id}
                            <Text
                              color={
                                nodes.find((n) => n.uuid === id)?.online
                                  ? "green"
                                  : "gray"
                              }
                            >
                              {" "}
                              ·{" "}
                              {nodes.find((n) => n.uuid === id)?.online
                                ? t("ddns.online")
                                : t("ddns.offline")}
                            </Text>
                          </Text>
                        ))}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={record.proxied ? "orange" : "gray"}>
                          {record.proxied
                            ? t("ddns.proxied")
                            : t("ddns.dns_only")}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {record.ttl === 1 ? t("ddns.auto") : `${record.ttl}s`}
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{record.last_ip || "—"}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="1">{time(record.last_checked_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap="2">
                          <Button
                            size="1"
                            variant="soft"
                            disabled={busy}
                            onClick={() => openEditor(record)}
                          >
                            {t("ddns.edit")}
                          </Button>
                          <Button
                            size="1"
                            variant="ghost"
                            color="red"
                            disabled={busy}
                            onClick={() => setRemoving(record)}
                          >
                            {t("ddns.remove")}
                          </Button>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>
        </Tabs.Content>
        <Tabs.Content value="logs">
          <Flex gap="3" align="center" wrap="wrap" my="3">
            <Select.Root
              value={logQuery.record || "__all__"}
              disabled={busy}
              onValueChange={(v) =>
                setLogQuery((current) => ({
                  ...current,
                  record: v === "__all__" ? "" : v,
                  page: 1,
                }))
              }
            >
              <Select.Trigger aria-label={t("ddns.filter")} />
              <Select.Content>
                <Select.Item value="__all__">
                  {t("ddns.all_records")}
                </Select.Item>
                {[...new Set(records.map((r) => r.record_name))].map((name) => (
                  <Select.Item key={name} value={name}>
                    {name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Text size="1" color="gray">
              {t("ddns.log_limit")}
            </Text>
            <Button
              size="1"
              color="red"
              variant="soft"
              disabled={
                busy || logsLoading || !!logsError || logPage.total === 0
              }
              onClick={() => setClearLogsOpen(true)}
            >
              {t("ddns.clear_logs")}
            </Button>
          </Flex>
          {logsError && (
            <Callout.Root color="red" role="alert" mb="3">
              <Callout.Text>{logsError}</Callout.Text>
            </Callout.Root>
          )}
          <Box overflowX="auto">
            <Table.Root variant="surface" aria-busy={logsLoading}>
              <Table.Header>
                <Table.Row>
                  {["time", "name", "action", "detail"].map((key) => (
                    <Table.ColumnHeaderCell key={key}>
                      {t(`ddns.${key}`)}
                    </Table.ColumnHeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {logsLoading || logsError || logPage.logs.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={4}>
                      {logsLoading
                        ? t("ddns.loading")
                        : logsError
                          ? t("ddns.logs_load_failed")
                          : t("ddns.no_logs")}
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  logPage.logs.map((log) => (
                    <Table.Row key={log.id}>
                      <Table.Cell>
                        <Text size="1">{time(log.time)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        {log.record_name || "—"} {log.record_type}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          color={
                            log.success
                              ? log.action === "skip"
                                ? "gray"
                                : "green"
                              : "red"
                          }
                        >
                          {t(`ddns.action_${log.action}`, {
                            defaultValue: log.action,
                          })}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell style={{ overflowWrap: "anywhere" }}>
                        {log.detail}
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>
          <Flex justify="between" align="center" gap="3" wrap="wrap" mt="3">
            <Flex align="center" gap="3" wrap="wrap">
              <Select.Root
                value={String(logQuery.pageSize)}
                disabled={busy}
                onValueChange={(value) =>
                  setLogQuery((current) => ({
                    ...current,
                    pageSize: Number(value),
                    page: 1,
                  }))
                }
              >
                <Select.Trigger aria-label={t("ddns.page_size")} />
                <Select.Content>
                  {[20, 50, 100].map((count) => (
                    <Select.Item key={count} value={String(count)}>
                      {t("ddns.rows_per_page", { count })}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              <Text size="2" color="gray" role="status" aria-live="polite">
                {logsLoading
                  ? t("ddns.loading")
                  : logsError
                    ? "—"
                    : t("ddns.page_info", {
                        total: logPage.total,
                        page: logPage.page,
                        pages: logPage.total_pages,
                      })}
              </Text>
            </Flex>
            <Flex gap="2">
              <Button
                size="1"
                variant="soft"
                disabled={
                  busy || logsLoading || !!logsError || logPage.page <= 1
                }
                onClick={() =>
                  setLogQuery((current) => ({ ...current, page: 1 }))
                }
              >
                {t("ddns.first_page")}
              </Button>
              <Button
                size="1"
                variant="soft"
                disabled={
                  busy || logsLoading || !!logsError || logPage.page <= 1
                }
                onClick={() =>
                  setLogQuery((current) => ({
                    ...current,
                    page: logPage.page - 1,
                  }))
                }
              >
                {t("ddns.previous_page")}
              </Button>
              <Button
                size="1"
                variant="soft"
                disabled={
                  busy ||
                  logsLoading ||
                  !!logsError ||
                  logPage.page >= logPage.total_pages
                }
                onClick={() =>
                  setLogQuery((current) => ({
                    ...current,
                    page: logPage.page + 1,
                  }))
                }
              >
                {t("ddns.next_page")}
              </Button>
              <Button
                size="1"
                variant="soft"
                disabled={
                  busy ||
                  logsLoading ||
                  !!logsError ||
                  logPage.page >= logPage.total_pages
                }
                onClick={() =>
                  setLogQuery((current) => ({
                    ...current,
                    page: logPage.total_pages,
                  }))
                }
              >
                {t("ddns.last_page")}
              </Button>
            </Flex>
          </Flex>
        </Tabs.Content>
      </Tabs.Root>
      <Dialog.Root
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setEditor(null);
        }}
      >
        <Dialog.Content maxWidth="720px">
          <Dialog.Title>
            {editor?.record ? t("ddns.edit") : t("ddns.add")}
          </Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {t("ddns.record_help")}
          </Dialog.Description>
          <Flex direction="column" gap="4">
            {error && (
              <Callout.Root color="red" role="alert">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("ddns.name")}>
                <TextField.Root
                  aria-label={t("ddns.name")}
                  value={draft.record_name}
                  onChange={(e) =>
                    setDraft({ ...draft, record_name: e.target.value })
                  }
                  placeholder="home.example.com"
                />
              </Field>
              <Field label={t("ddns.type")}>
                <Select.Root
                  value={draft.record_type}
                  onValueChange={(v) =>
                    setDraft({ ...draft, record_type: v as "A" | "AAAA" })
                  }
                >
                  <Select.Trigger aria-label={t("ddns.type")} />
                  <Select.Content>
                    <Select.Item value="A">A · IPv4</Select.Item>
                    <Select.Item value="AAAA">AAAA · IPv6</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field>
            </div>
            <Field label={t("ddns.source")}>
              <Box
                style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  border: "1px solid var(--gray-6)",
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <Flex direction="column" gap="2">
                  {nodes.map((node) => (
                    <Text as="label" size="2" key={node.uuid}>
                      <Flex gap="2" align="center">
                        <Checkbox
                          checked={draft.source_node.includes(node.uuid)}
                          onCheckedChange={(checked) =>
                            setDraft({
                              ...draft,
                              source_node: checked
                                ? [...draft.source_node, node.uuid]
                                : draft.source_node.filter(
                                    (id) => id !== node.uuid,
                                  ),
                            })
                          }
                        />
                        {node.name}
                        <Badge color={node.online ? "green" : "gray"}>
                          {node.online ? t("ddns.online") : t("ddns.offline")}
                        </Badge>
                      </Flex>
                    </Text>
                  ))}
                </Flex>
              </Box>
              <Text size="1" color="gray">
                {t("ddns.source_help")}
              </Text>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("ddns.ttl")}>
                <Select.Root
                  value={String(draft.ttl)}
                  disabled={draft.proxied}
                  onValueChange={(v) => setDraft({ ...draft, ttl: Number(v) })}
                >
                  <Select.Trigger aria-label={t("ddns.ttl")} />
                  <Select.Content>
                    {[...new Set([...ttlOptions, draft.ttl])].map((ttl) => (
                      <Select.Item key={ttl} value={String(ttl)}>
                        {ttl === 1 ? t("ddns.auto") : `${ttl}s`}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>
              <Field label={t("ddns.proxy")}>
                <Text as="label" size="2">
                  <Flex gap="2" align="center">
                    <Switch
                      checked={draft.proxied}
                      onCheckedChange={(proxied) =>
                        setDraft({
                          ...draft,
                          proxied,
                          ttl: proxied ? 1 : draft.ttl,
                        })
                      }
                    />
                    {t("ddns.proxied")}
                  </Flex>
                </Text>
                <Text size="1" color="gray">
                  {t("ddns.proxy_help")}
                </Text>
              </Field>
            </div>
            <Field label={t("ddns.zone")}>
              <TextField.Root
                aria-label={t("ddns.zone")}
                value={draft.zone_id}
                onChange={(e) =>
                  setDraft({ ...draft, zone_id: e.target.value })
                }
                placeholder={t("ddns.zone_help")}
              />
            </Field>
            <Field label={t("ddns.record_token")}>
              <TextField.Root
                type="password"
                autoComplete="new-password"
                aria-label={t("ddns.record_token")}
                value={draft.api_token}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    api_token: e.target.value,
                    clear_api_token: false,
                  })
                }
                placeholder={
                  editor?.record?.api_token_set
                    ? t("ddns.keep_token")
                    : t("ddns.global_token")
                }
              />
              {editor?.record?.api_token_set && (
                <Text as="label" size="2">
                  <Flex gap="2">
                    <Checkbox
                      checked={draft.clear_api_token}
                      onCheckedChange={(v) =>
                        setDraft({
                          ...draft,
                          clear_api_token: v === true,
                          api_token: v ? "" : draft.api_token,
                        })
                      }
                    />
                    {t("ddns.use_global_token")}
                  </Flex>
                </Text>
              )}
            </Field>
            <Field label={t("ddns.comment")}>
              <TextArea
                aria-label={t("ddns.comment")}
                value={draft.comment}
                onChange={(e) =>
                  setDraft({ ...draft, comment: e.target.value })
                }
              />
            </Field>
            <Flex justify="end" gap="3">
              <Button
                variant="soft"
                color="gray"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                {t("ddns.cancel")}
              </Button>
              <Button
                disabled={
                  busy ||
                  !draft.record_name.trim() ||
                  draft.source_node.length === 0
                }
                onClick={saveRecord}
              >
                {t("ddns.save")}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoving(null);
        }}
      >
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>{t("ddns.remove")}</Dialog.Title>
          <Dialog.Description>
            {t("ddns.remove_help", { name: removing?.record_name })}
          </Dialog.Description>
          <Flex justify="end" gap="3" mt="4">
            <Button
              variant="soft"
              color="gray"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              {t("ddns.cancel")}
            </Button>
            <Button
              color="red"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (removing)
                    await request(`records/${removing.id}`, "DELETE");
                  setRemoving(null);
                  await refresh();
                })
              }
            >
              {t("ddns.remove")}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root open={clearLogsOpen} onOpenChange={setClearLogsOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>{t("ddns.clear_logs")}</Dialog.Title>
          <Dialog.Description>{t("ddns.clear_logs_help")}</Dialog.Description>
          <Flex justify="end" gap="3" mt="4">
            <Button
              variant="soft"
              color="gray"
              disabled={busy}
              onClick={() => setClearLogsOpen(false)}
            >
              {t("ddns.cancel")}
            </Button>
            <Button
              color="red"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await request("logs", "DELETE");
                  setClearLogsOpen(false);
                  await refresh();
                })
              }
            >
              {t("ddns.clear_logs")}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}
