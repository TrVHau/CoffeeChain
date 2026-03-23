package com.coffee.trace.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Map;

/**
 * Unit-3: QR code generation service.
 *
 * Generates a QR code PNG for a batch's public trace URL.
 * Uses ZXing (com.google.zxing) which is declared in pom.xml.
 */
@Service
public class QrCodeService {

    @Value("${trace.public-base-url:http://localhost:3000/trace/}")
    private String publicBaseUrl;

    private static final int DEFAULT_SIZE = 300; // pixels

    /**
     * Generate a QR code PNG for the given batch's public trace URL.
     *
     * @param publicCode batch publicCode (appended to publicBaseUrl)
     * @return PNG image bytes
     */
    public byte[] generateQrPng(String publicCode) {
        String url = publicBaseUrl + publicCode;
        return encodeUrl(url, DEFAULT_SIZE);
    }

    /**
     * Generate a QR code PNG for an arbitrary URL string.
     *
     * @param url  URL to encode
     * @param size pixel size (width = height)
     * @return PNG image bytes
     */
    public byte[] encodeUrl(String url, int size) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            Map<EncodeHintType, Object> hints = Map.of(
                    EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
                    EncodeHintType.MARGIN, 2
            );
            BitMatrix matrix = writer.encode(url, BarcodeFormat.QR_CODE, size, size, hints);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("QR code generation failed for URL: " + url, e);
        }
    }
}
