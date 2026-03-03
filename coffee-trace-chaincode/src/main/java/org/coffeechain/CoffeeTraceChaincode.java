package org.coffeechain;

import org.hyperledger.fabric.contract.ContractRouter;
import org.hyperledger.fabric.shim.ChaincodeBase;
import org.hyperledger.fabric.shim.ChaincodeStub;

public class CoffeeTraceChaincode extends ChaincodeBase {

    private final ContractRouter router = new ContractRouter(
            new String[]{ CoffeeTraceContract.class.getName() }
    );

    @Override
    public Response init(ChaincodeStub stub) {
        return router.init(stub);
    }

    @Override
    public Response invoke(ChaincodeStub stub) {
        return router.invoke(stub);
    }

    public static void main(String[] args) {
        new CoffeeTraceChaincode().start(args);
    }
}