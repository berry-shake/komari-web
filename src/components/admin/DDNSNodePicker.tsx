import { useState } from "react";
import { Badge, Box, Button, Checkbox, Flex, SegmentedControl, Text, TextField } from "@radix-ui/themes";
import { Cross2Icon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";

export type DDNSNode = {
  uuid: string;
  name: string;
  online: boolean;
  ipv4: string;
  ipv6: string;
};

export function DDNSNodePicker({ nodes, value, onChange, disabled = false }: {
  nodes: DDNSNode[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const query = search.trim().toLowerCase();
  const selected = new Set(value);
  const onlineCount = nodes.filter(node => node.online).length;
  const visible = nodes.filter(node => {
    if (filter === "online" && !node.online) return false;
    if (filter === "selected" && !selected.has(node.uuid)) return false;
    return [node.name, node.ipv4, node.ipv6].some(text => text?.toLowerCase().includes(query));
  });

  const remove = (id: string) => onChange(value.filter(existing => existing !== id));

  return (
    <Flex direction="column" gap="2">
      <Flex gap="2" wrap="wrap" align="center">
        <TextField.Root
          type="search"
          aria-label={t("ddns.node_search")}
          placeholder={t("ddns.node_search")}
          value={search}
          disabled={disabled}
          onChange={event => setSearch(event.target.value)}
          style={{ flex: "1 1 180px", minWidth: 0 }}
        />
        <SegmentedControl.Root value={filter} onValueChange={setFilter} size="1" disabled={disabled} aria-label={t("ddns.node_filter")}>
          <SegmentedControl.Item value="all">{t("ddns.nodes_all")} {nodes.length}</SegmentedControl.Item>
          <SegmentedControl.Item value="online">{t("ddns.online")} {onlineCount}</SegmentedControl.Item>
          <SegmentedControl.Item value="selected">{t("ddns.nodes_selected")} {value.length}</SegmentedControl.Item>
        </SegmentedControl.Root>
      </Flex>
      {value.length > 0 && (
        <Flex gap="2" wrap="wrap" align="center" aria-label={t("ddns.source_order")}>
          <Text size="1" color="gray">{t("ddns.source_order")}</Text>
          {value.map((id, index) => {
            const name = nodes.find(node => node.uuid === id)?.name || id;
            return (
              <Button
                key={id}
                type="button"
                size="1"
                variant="soft"
                disabled={disabled}
                title={t("ddns.remove_source", { name })}
                aria-label={t("ddns.remove_source", { name })}
                onClick={() => remove(id)}
                style={{ maxWidth: "100%" }}
              >
                <span className="shrink-0">{index + 1}.</span>
                <span className="truncate">{name}</span>
                <Cross2Icon className="shrink-0" />
              </Button>
            );
          })}
        </Flex>
      )}
      <Box style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--gray-6)", borderRadius: 6, padding: 4 }}>
        {visible.length === 0 ? (
          <Text as="div" size="2" color="gray" className="p-3">{t("ddns.nodes_no_results")}</Text>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {visible.map(node => (
              <Text as="label" size="2" key={node.uuid} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--gray-a3)]">
                <Checkbox
                  checked={selected.has(node.uuid)}
                  disabled={disabled}
                  aria-label={node.name}
                  onCheckedChange={checked => checked
                    ? onChange(selected.has(node.uuid) ? value : [...value, node.uuid])
                    : remove(node.uuid)}
                />
                <span className="min-w-0 flex-1 truncate" title={[node.name, node.ipv4, node.ipv6].filter(Boolean).join("\n")}>{node.name}</span>
                <Badge color={node.online ? "green" : "gray"} className="shrink-0">
                  {node.online ? t("ddns.online") : t("ddns.offline")}
                </Badge>
              </Text>
            ))}
          </div>
        )}
      </Box>
    </Flex>
  );
}
