using System.Text;
using System.Text.Encodings.Web;

namespace Wwg.Api.Infrastructure.Email;

/// <summary>
/// One line of a <see cref="LedgerRow"/>: "1st Division: hold" (<paramref name="Lead"/> and
/// <paramref name="Text"/>), or an ally's report with what it brings (<paramref name="Aside"/>)
/// and its message (<paramref name="Quote"/>).
/// </summary>
internal sealed record LedgerEntry(
    string Text,
    string? Lead = null,
    string? Aside = null,
    string? Quote = null
);

/// <summary>A labelled row of an email's ledger. A row with no entries is left out.</summary>
internal sealed record LedgerRow(string Label, IReadOnlyList<LedgerEntry> Entries)
{
    public static LedgerRow Of(string label, IEnumerable<string> items) =>
        new(label, [.. items.Select(i => new LedgerEntry(i))]);
}

/// <summary>
/// Builds every email in the "despatch" design (decision 0049): a white page headed by the app's
/// icon, the sender line, a serif title and an italic subtitle over a double rule; then the body's
/// blocks; then a footer. Each block writes the HTML and the plain-text alternative together, so
/// the two always say the same. Mail clients only take tables and inline styles, hence the markup.
/// </summary>
internal sealed class EmailBuilder(string eyebrow, string title, string? subtitle = null)
{
    /// <summary>The Content-ID the icon is attached under (<see cref="MailKitEmailService"/>).</summary>
    public const string IconContentId = "app-icon@wasatch-wargamers";

    private const string Serif = "Georgia,'Times New Roman',Times,serif";
    private const string Sans =
        "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
    private const string Navy = "#1c3f7a";
    private const string Ink = "#1b1e25";

    // 6.0:1 on white.
    private const string Dim = "#5b6576";
    private const string Rule = "#e3e5ea";
    private const string Label =
        $"font-family:{Sans};font-size:11px;line-height:1.4;letter-spacing:1.5px;text-transform:uppercase;color:{Dim};font-weight:600;";

    private static readonly Lazy<byte[]> IconBytes = new(LoadIcon);

    private readonly StringBuilder _html = new();
    private readonly StringBuilder _text = new();
    private string? _preheader;

    /// <summary>The app's icon as a PNG: mail clients don't show SVG.</summary>
    public static byte[] Icon => IconBytes.Value;

    /// <summary>"Hi Ada,".</summary>
    public EmailBuilder Greeting(string firstName)
    {
        _html
            .Append("<p style=\"margin:0 0 16px;\">Hi ")
            .Append(Encode(firstName))
            .Append(",</p>\n");
        _text.Append("Hi ").Append(firstName).Append(",\n\n");
        return this;
    }

    /// <summary>A paragraph. The first one is also the preview the inbox shows after the subject.</summary>
    public EmailBuilder Paragraph(string text)
    {
        _preheader ??= text;
        _html.Append("<p style=\"margin:0 0 16px;\">").Append(Lines(text)).Append("</p>\n");
        _text.Append(text).Append("\n\n");
        return this;
    }

    /// <summary>A smaller, quieter paragraph: how long a link works, what to do if it wasn't you.</summary>
    public EmailBuilder Aside(string text)
    {
        _html
            .Append($"<p style=\"margin:0 0 16px;font-size:14px;line-height:1.5;color:{Dim};\">")
            .Append(Lines(text))
            .Append("</p>\n");
        _text.Append(text).Append("\n\n");
        return this;
    }

    /// <summary>A heading over the blocks after it (an army's news, when there are several).</summary>
    public EmailBuilder Heading(string text)
    {
        _html
            .Append(
                $"<h2 style=\"margin:26px 0 12px;font-family:{Serif};font-size:19px;line-height:1.3;font-weight:normal;font-variant:small-caps;letter-spacing:0.5px;color:{Navy};\">"
            )
            .Append(Encode(text))
            .Append("</h2>\n");
        _text.Append(text).Append("\n\n");
        return this;
    }

    /// <summary>Someone's words, quoted under a label: the Umpire's note.</summary>
    public EmailBuilder Letter(string label, string quote)
    {
        _html
            .Append(
                $"<div style=\"margin:0 0 20px;padding:0 4px;\"><div style=\"{Label}margin-bottom:6px;\">"
            )
            .Append(Encode(label))
            .Append("</div><div style=\"font-style:italic;\">&ldquo;")
            .Append(Lines(quote))
            .Append("&rdquo;</div></div>\n");
        _text.Append(label).Append('\n').Append(Quoted(quote, "> ")).Append('\n');
        return this;
    }

    /// <summary>A ledger: each row a label and its entries. Empty rows are left out.</summary>
    public EmailBuilder Ledger(params IEnumerable<LedgerRow> rows)
    {
        var shown = rows.Where(r => r.Entries.Count > 0).ToList();
        if (shown.Count == 0)
        {
            return this;
        }

        _html.Append(
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 20px;border-collapse:collapse;\">\n"
        );
        foreach (var row in shown)
        {
            _html
                .Append(
                    $"<tr><th align=\"left\" valign=\"top\" width=\"120\" style=\"width:120px;padding:11px 12px 11px 0;border-top:1px solid {Rule};{Label}\">"
                )
                .Append(Encode(row.Label))
                .Append(
                    $"</th><td valign=\"top\" style=\"padding:8px 0;border-top:1px solid {Rule};font-size:15px;line-height:1.5;\">"
                );
            _text.Append(row.Label).Append('\n');
            foreach (var entry in row.Entries)
            {
                AppendEntry(entry);
            }

            _html.Append("</td></tr>\n");
            _text.Append('\n');
        }

        _html.Append("</table>\n");
        return this;
    }

    /// <summary>The call to action: a button in the HTML, the link on its own in the text.</summary>
    public EmailBuilder Button(string text, Uri link)
    {
        _html
            .Append(
                $"<table role=\"presentation\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:8px auto 24px;\"><tr><td style=\"border:2px solid {Navy};\"><a href=\""
            )
            .Append(Encode(link.ToString()))
            .Append(
                $"\" style=\"display:inline-block;padding:11px 24px;font-family:{Sans};font-size:15px;font-weight:600;letter-spacing:0.5px;color:{Navy};text-decoration:none;\">"
            )
            .Append(Encode(text))
            .Append("</a></td></tr></table>\n");
        _text.Append(text).Append(": ").Append(link).Append("\n\n");
        return this;
    }

    /// <summary>
    /// The finished email. The footer says why it was sent (<paramref name="why"/>) and, for an
    /// email its recipient can turn off, links to where (<paramref name="settings"/>).
    /// </summary>
    public EmailMessage Build(
        string toAddress,
        string toName,
        string subject,
        string why,
        Uri? settings = null
    )
    {
        var footer = new StringBuilder(Encode(why));
        var text = new StringBuilder(_text.ToString()).Append("--\n").Append(why).Append('\n');
        if (settings is not null)
        {
            footer
                .Append($" <a href=\"")
                .Append(Encode(settings.ToString()))
                .Append($"\" style=\"color:{Navy};\">Change which emails you get</a>");
            text.Append("Change which emails you get: ").Append(settings).Append('\n');
        }

        return new EmailMessage(
            toAddress,
            toName,
            subject,
            Page(subject, footer.ToString()),
            text.ToString()
        );
    }

    private void AppendEntry(LedgerEntry entry)
    {
        _html.Append("<div style=\"margin:2px 0 6px;\">");
        _text.Append("- ");
        if (entry.Lead is { } lead)
        {
            _html.Append("<strong>").Append(Encode(lead)).Append(":</strong> ");
            _text.Append(lead).Append(": ");
        }

        _html.Append(Encode(entry.Text));
        _text.Append(entry.Text);
        if (entry.Aside is { } aside)
        {
            _html
                .Append($" <span style=\"font-size:13px;color:{Dim};\">(")
                .Append(Encode(aside))
                .Append(")</span>");
            _text.Append(" (").Append(aside).Append(')');
        }

        _text.Append('\n');
        if (entry.Quote is { } quote)
        {
            _html
                .Append("<div style=\"font-style:italic;margin-top:2px;\">&ldquo;")
                .Append(Lines(quote))
                .Append("&rdquo;</div>");
            _text.Append(Quoted(quote, "  > "));
        }

        _html.Append("</div>");
    }

    private string Page(string subject, string footer)
    {
        var preheader = _preheader is null
            ? ""
            : $"<div style=\"display:none;max-height:0;overflow:hidden;mso-hide:all;\">{Encode(_preheader)}</div>\n";
        var under = subtitle is null
            ? ""
            : $"<div style=\"margin-top:4px;font-family:{Serif};font-size:16px;font-style:italic;color:#4a5260;\">{Encode(subtitle)}</div>\n";
        return $"""
            <!doctype html>
            <html lang="en">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="color-scheme" content="light">
            <meta name="supported-color-schemes" content="light">
            <title>{Encode(subject)}</title>
            </head>
            <body style="margin:0;padding:0;background:#ffffff;">
            {preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 12px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid {Rule};border-top:6px solid {Navy};">
            <tr><td align="center" style="padding:28px 24px 16px;">
            <img src="cid:{IconContentId}" width="52" height="52" alt="" style="display:block;margin:0 auto;border:0;width:52px;height:52px;border-radius:50%;">
            <div style="{Label}letter-spacing:2px;margin-top:12px;">{Encode(eyebrow)}</div>
            <h1 style="margin:6px 0 0;font-family:{Serif};font-size:26px;line-height:1.25;font-weight:normal;color:{Navy};">{Encode(
                title
            )}</h1>
            {under}</td></tr>
            <tr><td style="padding:0 24px;"><div style="border-top:3px double #b9bfc9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
            <tr><td style="padding:22px 28px 6px;font-family:{Serif};font-size:16px;line-height:1.55;color:{Ink};">
            {_html}</td></tr>
            <tr><td align="center" style="padding:14px 24px 22px;border-top:1px solid {Rule};font-family:{Sans};font-size:12px;line-height:1.5;color:{Dim};">{footer}</td></tr>
            </table>
            </td></tr></table>
            </body>
            </html>

            """;
    }

    /// <summary>
    /// Text with its line breaks kept. Line by line: the encoder escapes a line break itself
    /// (as <c>&amp;#xA;</c>), so it can't be found to replace afterwards.
    /// </summary>
    private static string Lines(string text) =>
        string.Join("<br>\n", text.ReplaceLineEndings("\n").Split('\n').Select(Encode));

    /// <summary>Text quoted line by line, for the plain-text email.</summary>
    private static string Quoted(string text, string prefix) =>
        prefix + text.Replace("\n", "\n" + prefix, StringComparison.Ordinal) + "\n";

    private static string Encode(string value) => HtmlEncoder.Default.Encode(value);

    private static byte[] LoadIcon()
    {
        using var stream = typeof(EmailBuilder).Assembly.GetManifestResourceStream(
            "Wwg.Api.Email.app-icon.png"
        ) ?? throw new InvalidOperationException("The email icon isn't embedded.");
        using var bytes = new MemoryStream();
        stream.CopyTo(bytes);
        return bytes.ToArray();
    }
}
