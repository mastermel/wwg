import { Badge } from "@mantine/core";

/**
 * Marks its army's Commander in Chief (decision 0032) beside the unit's name in a list. The
 * abbreviation is spelt out for those who hover or listen.
 */
export function CommanderInChiefBadge() {
  return (
    <Badge
      component="abbr"
      title="Commander in Chief"
      size="xs"
      variant="outline"
      color="dark"
      style={{ flexShrink: 0, textDecoration: "none" }}
    >
      C-in-C
    </Badge>
  );
}
