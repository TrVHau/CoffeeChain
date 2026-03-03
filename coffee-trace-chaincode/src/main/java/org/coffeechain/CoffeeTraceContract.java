package org.coffeechain;

import org.hyperledger.fabric.contract.Context;
import org.hyperledger.fabric.contract.ContractInterface;
import org.hyperledger.fabric.contract.annotation.Contract;
import org.hyperledger.fabric.contract.annotation.Transaction;

@Contract(name = "CoffeeTraceContract")
public class CoffeeTraceContract implements ContractInterface {

    @Transaction(intent = Transaction.TYPE.SUBMIT)
    public void ping(Context ctx) {
        // ghi một dấu vết nhỏ để test invoke
        ctx.getStub().putStringState("PING", "PONG");
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String readPing(Context ctx) {
        String v = ctx.getStub().getStringState("PING");
        return (v == null || v.isEmpty()) ? "EMPTY" : v;
    }
}