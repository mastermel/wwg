using System.Net.Http.Json;
using Wwg.Api.Data.Entities;
using Wwg.Api.Features.Armies;
using Wwg.Api.Features.Turns;
using Wwg.Api.IntegrationTests.Support;

namespace Wwg.Api.IntegrationTests.Features;

/// <summary>The new turn's email (step 52c, decision 0023); each kind of news is tested with its feature.</summary>
public sealed class TurnStartedEmailTests : ApiTest
{
    [Fact]
    public async Task StartCampaign_EmailsEachCommander_WithTheTurnsDayAndTimeOfDay()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.SetCalendarAsync(scenario, TurnPart.Afternoon, new DateOnly(1815, 6, 16));

        await TurnSteps.StartedAsync(scenario);

        var email = await Emails.WaitForEmailToAsync("commander@example.com", "has started");
        Assert.Equal(
            "The Peninsular War: turn 1 has started (16 June 1815, Afternoon)",
            email.Subject
        );
        Assert.Contains(
            "The Peninsular War has begun: turn 1 (16 June 1815, Afternoon) is open. Give First Corps its first orders.",
            email.TextBody,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public async Task StartNextTurn_WithNothingNew_SaysSo()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        await TurnSteps.StartedAsync(scenario);

        await TurnSteps.PlayAsync(scenario, "hold");

        var email = await Emails.WaitForEmailToAsync("commander@example.com", "turn 2 has started");
        Assert.Equal("The Peninsular War: turn 2 has started (Afternoon)", email.Subject);
        Assert.Contains(
            "Nothing new since the last turn.",
            email.TextBody,
            StringComparison.Ordinal
        );
        Assert.Contains(
            $"/campaigns/{scenario.CampaignId}/map",
            email.TextBody,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public async Task StartNextTurn_TurnedOff_EmailsTheCommanderNothing()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        using var muted = await scenario
            .As(Role.Commander)
            .PutAsJsonAsync(
                new Uri("/api/me/email-settings", UriKind.Relative),
                new Wwg.Api.Features.Account.UpdateEmailSettingsRequest([EmailKind.TurnStarted]),
                TestContext.Current.CancellationToken
            );
        muted.EnsureSuccessStatusCode();

        await TurnSteps.StartedAsync(scenario);
        await TurnSteps.PlayAsync(scenario, "hold");

        // The Umpire's own, of the submitting, went after the first turn's would have.
        await Emails.WaitForEmailToAsync("umpire@example.com", "submitted turn 1");
        Assert.DoesNotContain(Emails.Sent, e =>
            e.Subject.Contains("has started", StringComparison.Ordinal)
        );
    }

    [Fact]
    public async Task StartCampaign_ACommanderOfTwoArmies_GetsOneEmailForBoth()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var second = await SecondCorpsAsync(scenario);

        await TurnSteps.StartedAsync(scenario);

        // The Umpire's own, of the submitting, goes after the first turn's.
        using var submitted = await TurnSteps.ActAsync(
            scenario,
            await OpenTurnAsync(scenario, second),
            "submit",
            Role.Commander
        );
        submitted.EnsureSuccessStatusCode();
        await Emails.WaitForEmailToAsync("umpire@example.com", "submitted turn 1");
        var email = Assert.Single(Emails.Sent, e =>
            string.Equals(e.ToAddress, "commander@example.com", StringComparison.Ordinal)
            && e.Subject.Contains("turn 1 has started", StringComparison.Ordinal)
        );
        Assert.Contains(
            "Give First Corps and Second Corps their first orders.",
            email.TextBody,
            StringComparison.Ordinal
        );
    }

    [Fact]
    public async Task StartNextTurn_ACommanderOfTwoArmies_HasEachArmysNewsUnderItsName()
    {
        using var scenario = await CreateCampaignScenarioAsync();
        var second = await SecondCorpsAsync(scenario);
        await TurnSteps.StartedAsync(scenario);
        var open = await OpenTurnAsync(scenario, second);
        using var submitted = await TurnSteps.ActAsync(scenario, open, "submit", Role.Commander);
        submitted.EnsureSuccessStatusCode();
        using var approved = await TurnSteps.ActAsync(scenario, open, "approve", Role.Umpire);
        approved.EnsureSuccessStatusCode();

        await TurnSteps.PlayAsync(scenario, "hold");

        var email = await Emails.WaitForEmailToAsync("commander@example.com", "turn 2 has started");
        Assert.Contains(
            "Give First Corps and Second Corps their orders.",
            email.TextBody,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "First Corps: new since the last turn",
            email.TextBody,
            StringComparison.Ordinal
        );
        Assert.Contains(
            "Second Corps: new since the last turn",
            email.TextBody,
            StringComparison.Ordinal
        );
    }

    /// <summary>The army's turn in the open campaign turn; its id.</summary>
    private static async Task<Guid> OpenTurnAsync(CampaignScenario scenario, Guid army)
    {
        var turns = await scenario
            .As(Role.Umpire)
            .GetAsAsync<List<ArmyTurnDetails>>($"/api/armies/{army}/turns");
        return turns!.Single(t => t.Open).Id; // An army of a started campaign has turns.
    }

    /// <summary>A second army of the scenario's side, for its commander; its id.</summary>
    private static async Task<Guid> SecondCorpsAsync(CampaignScenario scenario)
    {
        using var created = await scenario
            .As(Role.Umpire)
            .PostAsJsonAsync(
                new Uri($"/api/campaigns/{scenario.CampaignId}/armies", UriKind.Relative),
                new CreateArmyRequest("Second Corps", scenario.CommanderMemberId, scenario.SideId),
                TestContext.Current.CancellationToken
            );
        created.EnsureSuccessStatusCode();
        return (await created.Content.ReadAsAsync<ArmyResponse>())!.Id; // Created: it has a body.
    }
}
