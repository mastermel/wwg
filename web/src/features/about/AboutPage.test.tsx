import { screen } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server, serveHealth } from "@/test/server";
import { expectNoAxeViolations, renderApp } from "@/test/render";

describe("About page", () => {
  it("shows the server as healthy when the API is", async () => {
    server.use(serveHealth("Healthy"));

    await renderApp("/about");

    expect(await screen.findByText("Healthy")).toBeInTheDocument();
  });

  it("shows the version the API reports", async () => {
    server.use(serveHealth("Healthy", "v20261123.171118"));

    await renderApp("/about");

    expect(await screen.findByText("v20261123.171118")).toBeInTheDocument();
  });

  it("shows the version an unhealthy API reports", async () => {
    server.use(
      http.get("*/health", () =>
        HttpResponse.json({ status: "Unhealthy", version: "v20261123.171118" }, { status: 503 }),
      ),
    );

    await renderApp("/about");

    expect(await screen.findByText("v20261123.171118")).toBeInTheDocument();
  });

  it("shows the server as unhealthy when the API answers 503", async () => {
    server.use(
      http.get("*/health", () =>
        HttpResponse.json({ status: "Unhealthy", version: "dev" }, { status: 503 }),
      ),
    );

    await renderApp("/about");

    expect(await screen.findByText("Unhealthy")).toBeInTheDocument();
  });

  it("shows the server as unreachable when the request fails", async () => {
    server.use(http.get("*/health", () => HttpResponse.error()));

    await renderApp("/about");

    expect(await screen.findByText("Unreachable")).toBeInTheDocument();
  });

  it("shows the server as offline, without calling it, while the device is offline", async () => {
    onlineManager.setOnline(false);

    await renderApp("/about");

    expect(await screen.findByText("Offline")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("has no detectable accessibility problems", async () => {
    server.use(serveHealth("Healthy"));
    const { container } = await renderApp("/about");
    await screen.findByText("Healthy");

    await expectNoAxeViolations(container);
  });
});
