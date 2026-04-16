package com.coffee.trace.util;

import java.util.regex.Pattern;

public final class WeightValidator {

    private static final Pattern WEIGHT_PATTERN = Pattern.compile("^\\d+(?:[\\.,]\\d+)?$");

    private WeightValidator() {
    }

    public static String normalizeRequired(String rawValue, String fieldLabel) {
        if (rawValue == null || rawValue.isBlank()) {
            throw new IllegalArgumentException(fieldLabel + " không được để trống.");
        }

        String normalized = rawValue.trim().replace(',', '.');
        if (!WEIGHT_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException(fieldLabel + " chỉ chấp nhận số nguyên hoặc số thập phân.");
        }
        return normalized;
    }

    public static String normalizeOptional(String rawValue, String fieldLabel) {
        if (rawValue == null || rawValue.isBlank()) {
            return "";
        }
        return normalizeRequired(rawValue, fieldLabel);
    }
}
