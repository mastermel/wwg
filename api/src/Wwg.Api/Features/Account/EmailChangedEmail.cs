using Wwg.Api.Data.Entities;
using Wwg.Api.Infrastructure.Email;

namespace Wwg.Api.Features.Account;

/// <summary>
/// Sent to the old address when the email changes, so a takeover (someone else changing it)
/// doesn't go unnoticed: the new address is confirmed only later (decision 0023), so this is the
/// safeguard meanwhile.
/// </summary>
internal static class EmailChangedEmail
{
    public static EmailMessage Create(AppUser user, string oldEmail, string newEmail) =>
        new EmailBuilder("Wasatch Wargamers", "Your email was changed")
            .Greeting(user.FirstName)
            .Paragraph(
                "The email for your Wasatch Wargamers account was just changed. You'll sign in with the new address from now on."
            )
            .Ledger(LedgerRow.Of("New email", [newEmail]))
            .Paragraph(
                "If you didn't do this, someone else may have your password: contact a club Admin straight away."
            )
            .Build(
                oldEmail,
                $"{user.FirstName} {user.LastName}",
                "Your Wasatch Wargamers email was changed",
                "This email is about your Wasatch Wargamers account."
            );
}
