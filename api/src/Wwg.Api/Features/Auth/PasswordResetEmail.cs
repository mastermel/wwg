using Wwg.Api.Data.Entities;
using Wwg.Api.Infrastructure.Email;

namespace Wwg.Api.Features.Auth;

internal static class PasswordResetEmail
{
    public static EmailMessage Create(AppUser user, Uri resetLink) =>
        new EmailBuilder("Wasatch Wargamers", "Reset your password")
            .Greeting(user.FirstName)
            .Paragraph(
                "Someone asked to reset the password for your Wasatch Wargamers account. If it was you, choose a new password here."
            )
            .Button("Reset my password", resetLink)
            .Aside(
                "The link works for 2 hours. If it wasn't you, you can ignore this email; your password hasn't changed."
            )
            .Build(
                user.Email ?? "",
                $"{user.FirstName} {user.LastName}",
                "Reset your Wasatch Wargamers password",
                "This email is about your Wasatch Wargamers account."
            );
}
