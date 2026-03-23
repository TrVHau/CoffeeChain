package com.coffee.trace.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEntity {

    @Id
    @Column(name = "user_id")
    private String userId;              // farmer_alice | processor_bob | ...

    @Column(nullable = false)
    private String password;            // BCrypt hash

    @Column(nullable = false)
    private String role;                // FARMER | PROCESSOR | ROASTER | PACKAGER | RETAILER

    @Column(nullable = false)
    private String org;                 // Org1 | Org2

    @Column(name = "fabric_user_id")
    private String fabricUserId;        // maps to Fabric wallet identity (usually same as userId)
}
