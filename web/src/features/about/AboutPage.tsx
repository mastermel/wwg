import { Box, ColorSwatch, Group, Loader, SimpleGrid, Text } from "@mantine/core";
import { useGetHealth } from "@/api/generated/endpoints/health/health";
import type { HealthStatus } from "@/api/generated/model";
import { Page } from "@/components/Page";
import { Section } from "@/components/Section";
import { ApiError } from "@/lib/api-fetch";

const statusColors: Record<HealthStatus, string> = {
  Healthy: "green",
  Degraded: "yellow",
  Unhealthy: "red",
};

export function AboutPage() {
  return (
    <Page title="About" summary="The Wasatch Wargamers campaign app.">
      <Box maw={720}>
        <Section title="This version" description="Useful when reporting a problem.">
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="lg">
            <div>
              <Text size="sm" c="dimmed">
                Version
              </Text>
              <ApiVersion />
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Server status
              </Text>
              <ApiHealth />
            </div>
          </SimpleGrid>
        </Section>
      </Box>
    </Page>
  );
}

/**
 * The status in words, with a coloured dot beside it: the word carries the meaning (and the
 * contrast), the dot is extra. White on Mantine's green falls short of AA.
 */
function Status({ label, color }: { label: string; color: string }) {
  return (
    <Group gap={8} wrap="nowrap">
      <ColorSwatch color={`var(--mantine-color-${color}-6)`} size={10} withShadow={false} />
      <Text fw={500}>{label}</Text>
    </Group>
  );
}

// Live status: never saved for offline use.
const useHealth = () => useGetHealth({ query: { meta: { persist: false } } });

/** The health response's body, which an unhealthy API sends with a 503 (arriving as an error). */
function healthBody(health: ReturnType<typeof useHealth>) {
  if (health.isSuccess) {
    return health.data;
  }
  return health.error instanceof ApiError ? health.error.body : undefined;
}

/** The version the API reports: the image tag, which covers the front-end too (one image). */
function ApiVersion() {
  const health = useHealth();

  if (health.isPending && health.fetchStatus === "fetching") {
    return <Loader size="xs" role="status" aria-label="Checking the version" />;
  }

  const version = healthBody(health)?.version;
  return version ? <Text fw={500}>{version}</Text> : <Text c="dimmed">Unknown</Text>;
}

function ApiHealth() {
  const health = useHealth();

  if (health.fetchStatus === "paused") {
    return <Status label="Offline" color="gray" />;
  }

  if (health.isPending) {
    return <Loader size="xs" role="status" aria-label="Checking the server" />;
  }

  const status: HealthStatus | undefined = healthBody(health)?.status;

  if (!status) {
    return <Status label="Unreachable" color="gray" />;
  }

  return <Status label={status} color={statusColors[status]} />;
}
