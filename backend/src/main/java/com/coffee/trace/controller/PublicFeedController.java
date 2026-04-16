package com.coffee.trace.controller;

import com.coffee.trace.entity.BatchEntity;
import com.coffee.trace.entity.FarmActivityEntity;
import com.coffee.trace.entity.LedgerRefEntity;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.repository.FarmActivityRepository;
import com.coffee.trace.repository.LedgerRefRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api")
public class PublicFeedController {

    private final BatchRepository batchRepository;
    private final FarmActivityRepository farmActivityRepository;
    private final LedgerRefRepository ledgerRefRepository;

    public PublicFeedController(BatchRepository batchRepository,
                                FarmActivityRepository farmActivityRepository,
                                LedgerRefRepository ledgerRefRepository) {
        this.batchRepository = batchRepository;
        this.farmActivityRepository = farmActivityRepository;
        this.ledgerRefRepository = ledgerRefRepository;
    }

    @GetMapping("/public-feed")
    public ResponseEntity<PublicFeedResponse> publicFeed() {
        List<BatchEntity> batches = batchRepository.findAll().stream()
                .sorted(Comparator.comparing(BatchEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(16)
                .toList();

        List<PublicFeedItem> items = new ArrayList<>();
        for (BatchEntity batch : batches) {
            String stage = stageFromType(batch.getType());
            String stageLabel = stageLabel(stage);
            Instant updatedAt = batch.getUpdatedAt() != null ? batch.getUpdatedAt() : Instant.now();

            if (hasText(batch.getEvidenceHash()) || hasText(batch.getEvidenceUri()) || hasEvidenceActivity(batch.getBatchId())) {
                items.add(new PublicFeedItem(
                        "ev-" + batch.getBatchId(),
                        batch.getPublicCode(),
                        "EVIDENCE",
                        stage,
                        "Upload minh chứng " + stageLabel + " cho lô " + batch.getPublicCode(),
                        "Org phụ trách " + stageLabel + " cập nhật tài liệu và hash minh chứng.",
                        firstTxId(batch.getBatchId()),
                        latestBlockNumber(batch.getBatchId()),
                        updatedAt.toString()
                ));
            }

            items.add(new PublicFeedItem(
                    "tx-" + batch.getBatchId(),
                    batch.getPublicCode(),
                    "TRANSACTION",
                    stage,
                    "Giao dịch cập nhật trạng thái " + statusLabel(batch.getStatus()) + " cho " + batch.getPublicCode(),
                    "Hệ thống ghi nhận nghiệp vụ của lô theo luồng truy xuất.",
                    firstTxId(batch.getBatchId()),
                    latestBlockNumber(batch.getBatchId()),
                    updatedAt.toString()
            ));

            items.add(new PublicFeedItem(
                    "bl-" + batch.getBatchId(),
                    batch.getPublicCode(),
                    "BLOCK",
                    stage,
                    "Block xác nhận sự kiện " + stageLabel + " của " + batch.getPublicCode(),
                    "Dữ liệu đã được ghi lên Fabric ledger và không thể chỉnh sửa.",
                    firstTxId(batch.getBatchId()),
                    latestBlockNumber(batch.getBatchId()),
                    updatedAt.toString()
            ));
        }

        items.sort(Comparator.comparing(PublicFeedItem::updatedAt).reversed());

        int totalTransactions = (int) items.stream().filter(item -> "TRANSACTION".equals(item.type())).count();
        int totalEvidenceUploads = (int) items.stream().filter(item -> "EVIDENCE".equals(item.type())).count();
        long latestBlockNumber = items.stream().mapToLong(PublicFeedItem::blockNumber).max().orElse(0);

        PublicFeedResponse response = new PublicFeedResponse(
                Instant.now().toString(),
                new PublicFeedStats(items.size(), totalTransactions, totalEvidenceUploads, latestBlockNumber),
                items
        );
        return ResponseEntity.ok(response);
    }

    private boolean hasEvidenceActivity(String batchId) {
        if (!hasText(batchId)) {
            return false;
        }
        List<FarmActivityEntity> activities = farmActivityRepository.findByHarvestBatchIdOrderByActivityDateAsc(batchId);
        return activities.stream().anyMatch(activity -> hasText(activity.getEvidenceHash()) || hasText(activity.getEvidenceUri()));
    }

    private String firstTxId(String batchId) {
        List<LedgerRefEntity> refs = ledgerRefRepository.findByBatchIdOrderByCreatedAtAsc(batchId);
        return refs.isEmpty() ? "" : refs.get(0).getTxId();
    }

    private long latestBlockNumber(String batchId) {
        List<LedgerRefEntity> refs = ledgerRefRepository.findByBatchIdOrderByCreatedAtAsc(batchId);
        return refs.stream()
                .map(LedgerRefEntity::getBlockNumber)
                .filter(n -> n != null)
                .mapToLong(Long::longValue)
                .max()
                .orElse(0);
    }

    private String stageFromType(String type) {
        if (type == null) {
            return "HARVEST";
        }
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "PROCESSED" -> "PROCESSED";
            case "ROAST" -> "ROAST";
            case "PACKAGED" -> "PACKAGED";
            case "RETAIL" -> "RETAIL";
            default -> "HARVEST";
        };
    }

    private String stageLabel(String stage) {
        return switch (stage) {
            case "PROCESSED" -> "SƠ CHẾ";
            case "ROAST" -> "RANG";
            case "PACKAGED" -> "ĐÓNG GÓI";
            case "RETAIL" -> "BÁN LẺ";
            default -> "THU HOẠCH";
        };
    }

    private String statusLabel(String status) {
        if (status == null) {
            return "Đã cập nhật";
        }
        return switch (status.toUpperCase(Locale.ROOT)) {
            case "CREATED" -> "Đã tạo";
            case "IN_PROCESS" -> "Đang xử lý";
            case "COMPLETED" -> "Hoàn thành";
            case "TRANSFER_PENDING" -> "Đang chuyển giao";
            case "TRANSFERRED" -> "Đã chuyển giao";
            case "IN_STOCK" -> "Trong kho";
            case "SOLD" -> "Đã bán";
            default -> status;
        };
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public record PublicFeedStats(long totalItems,
                                  long totalTransactions,
                                  long totalEvidenceUploads,
                                  long latestBlockNumber) {}

    public record PublicFeedItem(String id,
                                 String publicCode,
                                 String type,
                                 String traceStage,
                                 String title,
                                 String subtitle,
                                 String txId,
                                 long blockNumber,
                                 String updatedAt) {}

    public record PublicFeedResponse(String generatedAt,
                                     PublicFeedStats stats,
                                     List<PublicFeedItem> items) {}
}