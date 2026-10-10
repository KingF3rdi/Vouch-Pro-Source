package de.oakffa.anticheat.util;

import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses durations like {@code 7d}, {@code 12h}, {@code 30m}, {@code 1w}, {@code permanent}.
 */
public final class DurationParser {

    private static final Pattern TOKEN = Pattern.compile("(\\d+)([smhdw])", Pattern.CASE_INSENSITIVE);

    private DurationParser() {
    }

    /**
     * @return duration in milliseconds, or {@code -1} for permanent; {@code null} if invalid
     */
    public static Long parseToMillis(String input) {
        if (input == null || input.isBlank()) {
            return null;
        }
        String raw = input.trim().toLowerCase(Locale.ROOT);
        if (raw.equals("perm") || raw.equals("permanent") || raw.equals("perma")
                || raw.equals("-1") || raw.equals("forever")) {
            return -1L;
        }

        Matcher matcher = TOKEN.matcher(raw);
        long total = 0L;
        int consumed = 0;
        while (matcher.find()) {
            if (matcher.start() != consumed) {
                return null;
            }
            long amount = Long.parseLong(matcher.group(1));
            char unit = matcher.group(2).toLowerCase(Locale.ROOT).charAt(0);
            total += switch (unit) {
                case 's' -> TimeUnit.SECONDS.toMillis(amount);
                case 'm' -> TimeUnit.MINUTES.toMillis(amount);
                case 'h' -> TimeUnit.HOURS.toMillis(amount);
                case 'd' -> TimeUnit.DAYS.toMillis(amount);
                case 'w' -> TimeUnit.DAYS.toMillis(amount * 7);
                default -> 0L;
            };
            consumed = matcher.end();
        }
        if (consumed == 0 || consumed != raw.length() || total <= 0L) {
            // bare number = days
            try {
                long days = Long.parseLong(raw);
                if (days <= 0) {
                    return null;
                }
                return TimeUnit.DAYS.toMillis(days);
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return total;
    }

    public static String format(long durationMs) {
        if (durationMs < 0) {
            return "permanent";
        }
        long seconds = durationMs / 1000;
        if (seconds % 86400 == 0) {
            return (seconds / 86400) + "d";
        }
        if (seconds % 3600 == 0) {
            return (seconds / 3600) + "h";
        }
        if (seconds % 60 == 0) {
            return (seconds / 60) + "m";
        }
        return seconds + "s";
    }
}
