package com.coffee.trace.chaincode.util;

import com.google.gson.Gson;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class JSON {
    private static final Gson gson = new Gson();

    public static byte[] serialize(Object obj) {
        return gson.toJson(obj).getBytes(StandardCharsets.UTF_8);
    }

    public static <T> T deserialize(byte[] data, Class<T> clazz) {
        String json = new String(data, StandardCharsets.UTF_8);
        return gson.fromJson(json, clazz);
    }

    public static byte[] serializeMap(Map<String, Object> map) {
        return serialize(map).getBytes(StandardCharsets.UTF_8);
    }

    public static String toJson(Object obj) {
        return gson.toJson(obj);
    }
}