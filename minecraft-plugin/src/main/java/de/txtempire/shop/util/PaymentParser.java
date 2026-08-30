package de.txtempire.shop.util;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PaymentParser {

    private PaymentParser() {}

    public record ParsedPayment(String payer, double amount) {}

    public static ParsedPayment parseChatMessage(String message, String recipientIgn) {
        if (message == null || recipientIgn == null) {
            return null;
        }
        String clean = stripColors(message).trim();
        String escaped = Pattern.quote(recipientIgn);

        Pattern[] patterns = new Pattern[] {
                Pattern.compile("^(\\w+)\\s+paid\\s+you\\s+\\$?(\\d+(?:\\.\\d{1,2})?)$", Pattern.CASE_INSENSITIVE),
                Pattern.compile("^(\\w+)\\s+paid\\s+" + escaped + "\\s+\\$?(\\d+(?:\\.\\d{1,2})?)$", Pattern.CASE_INSENSITIVE),
                Pattern.compile("^(\\w+)\\s*->\\s*" + escaped + ":\\s*\\$?(\\d+(?:\\.\\d{1,2})?)$", Pattern.CASE_INSENSITIVE),
                Pattern.compile("^\\[Payment\\]\\s+(\\w+)\\s+\\$?(\\d+(?:\\.\\d{1,2})?)\\s+(?:an\\s+)?" + escaped + "$", Pattern.CASE_INSENSITIVE),
                Pattern.compile("^(\\w+)\\s+pay\\s+" + escaped + "\\s+\\$?(\\d+(?:\\.\\d{1,2})?)$", Pattern.CASE_INSENSITIVE),
        };

        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(clean);
            if (matcher.matches()) {
                Double amount = parseAmount(matcher.group(2));
                if (amount != null) {
                    return new ParsedPayment(matcher.group(1), amount);
                }
            }
        }
        return null;
    }

    public static Double parseAmount(String token) {
        if (token == null) {
            return null;
        }
        String value = token.trim().toLowerCase(Locale.ROOT).replace(",", ".");
        if (value.isEmpty()) {
            return null;
        }

        try {
            if (value.endsWith("k")) {
                return Double.parseDouble(value.substring(0, value.length() - 1)) * 1000.0;
            }
            if (value.endsWith("m")) {
                return Double.parseDouble(value.substring(0, value.length() - 1)) * 1_000_000.0;
            }
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String stripColors(String text) {
        return text.replaceAll("\u00a7.", "").trim();
    }
}
