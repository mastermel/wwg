import { List, Text } from "@mantine/core";
import { useListHexDetails } from "@/api/generated/endpoints/maps/maps";
import { Section } from "@/components/Section";
import { describeDetail } from "@/features/maps/hex-detail";
import { HexLink } from "@/features/maps/HexLink";

const live = { query: { meta: { persist: false } } } as const;

/**
 * The hexes' actual terrain the viewer may see (decision 0016): what the Umpire's dice found and
 * showed their army, or everyone. Nothing when there's none.
 */
export function HexDetailsList({ campaignId }: { campaignId: string }) {
  const details = useListHexDetails(campaignId, live);
  if (!details.data?.length) return null;

  return (
    <Section title="Hex details" description="What's actually in these hexes, for a battle.">
      <List listStyleType="none" spacing="sm" p={0}>
        {details.data.map((detail) => (
          <List.Item key={`${String(detail.q)},${String(detail.r)}`}>
            <Text size="sm" fw={500}>
              <HexLink hex={detail} />
            </Text>
            <Text size="sm">{describeDetail(detail)}</Text>
          </List.Item>
        ))}
      </List>
    </Section>
  );
}
