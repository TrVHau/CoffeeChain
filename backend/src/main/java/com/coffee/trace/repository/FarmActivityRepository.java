package com.coffee.trace.repository;

import com.coffee.trace.entity.FarmActivityEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FarmActivityRepository extends JpaRepository<FarmActivityEntity, Long> {

    List<FarmActivityEntity> findByHarvestBatchIdOrderByActivityDateAsc(String harvestBatchId);
}
