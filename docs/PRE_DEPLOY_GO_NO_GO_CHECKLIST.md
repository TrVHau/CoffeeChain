# CoffeeChain Pre-Deploy Go/No-Go Checklist

Muc tieu: dam bao he thong san sang deploy va chay on dinh trong moi truong thuc te.

Quy uoc:
- GO: Dat yeu cau, cho phep qua buoc tiep theo.
- NO-GO: Chua dat, phai fix truoc khi deploy.

---

## 0) Thong tin phien ban

- Release version/tag: ____________________
- Commit SHA: ____________________
- Ngay gio danh gia: ____________________
- Nguoi xac nhan: ____________________

Quyet dinh muc 0:
- [ ] GO
- [ ] NO-GO

---

## 1) Build va test co ban

- [ ] Backend test pass:
  - Lenh: `cd backend && mvn -q test`
- [ ] Chaincode test pass:
  - Lenh: `cd chaincode && bash gradlew test --no-daemon`
- [ ] Frontend build pass (local hoac docker build):
  - Lenh: `cd frontend && npm run build` hoac `cd network && docker compose build frontend`
- [ ] Khong co loi compile/runtime ro rang trong log startup.

Quyet dinh muc 1:
- [ ] GO
- [ ] NO-GO

---

## 2) Khoi dong full stack tu trang thai fresh

- [ ] Chay setup full stack thanh cong:
  - Lenh: `bash run.sh setup`
- [ ] Trang thai dich vu ok:
  - Lenh: `bash run.sh status`
  - Ky vong: Backend, PostgreSQL, IPFS, chaincode deu OK.
- [ ] Frontend container start thanh cong tren compose.

Quyet dinh muc 2:
- [ ] GO
- [ ] NO-GO

---

## 3) E2E nghiep vu xuyen suot (bat buoc)

Luong bat buoc:
1. Farmer tao harvest + cap nhat COMPLETED
2. Processor tao processed + cap nhat COMPLETED
3. Roaster tao roast + cap nhat COMPLETED
4. Request transfer (Org1 -> Org2), packager accept transfer
5. Packager tao packaged
6. Retailer cap nhat IN_STOCK -> SOLD
7. Public trace tra ve 200

- [ ] Tat ca buoc tren tra HTTP 200
- [ ] Khong co loi ABORTED/endorsement trong backend log
- [ ] Khong con loi FK `ledger_refs_batch_id_fkey` trong backend log

Quyet dinh muc 3:
- [ ] GO
- [ ] NO-GO

---

## 4) Traceability va du lieu

- [ ] `/api/trace/{publicCode}` tra 200 voi du lieu hop le
- [ ] parentChain co du lieu dung (khong bi dut chain)
- [ ] ledgerRefs co du lieu (khong rong)
- [ ] QR/trace URL truy cap duoc

Quyet dinh muc 4:
- [ ] GO
- [ ] NO-GO

---

## 5) Bao mat va cau hinh

- [ ] Khong deploy voi JWT secret mac dinh
- [ ] Bien moi truong production duoc set day du (DB, Fabric, IPFS, JWT)
- [ ] Permission crypto runtime dung (backend doc duoc identity):
  - `run.sh` da auto fix, van can spot-check neu doi host.
- [ ] Khong hardcode thong tin nhay cam trong code va docs.

Quyet dinh muc 5:
- [ ] GO
- [ ] NO-GO

---

## 6) Van hanh, giam sat, rollback

- [ ] Da co lenh/startup script ro rang cho production
- [ ] Da co cach xem log nhanh:
  - `cd network && docker compose logs --tail 200 backend`
- [ ] Da co rollback plan (image tag truoc, cach revert nhanh)
- [ ] Da test restart backend khong mat tinh nhat quan he thong

Quyet dinh muc 6:
- [ ] GO
- [ ] NO-GO

---

## 7) Xac nhan cuoi cung truoc deploy

Chi deploy neu tat ca muc 1 -> 6 deu GO.

- [ ] FINAL GO
- [ ] FINAL NO-GO

Nguoi phe duyet cuoi:
- Ten: ____________________
- Vai tro: ____________________
- Thoi gian: ____________________

---

## Appendix A - Lenh smoke test de nghi

Co the dung script smoke test da xac minh trong qua trinh hardening:
- File tam da dung: `/tmp/coffeechain_smoke.sh`

Neu can chinh thuc hoa vao repo, tao script tai:
- `scripts/smoke-e2e.sh`

Noi dung can bao gom day du cac buoc nghiep vu o muc 3 va fail-fast neu bat ky buoc nao khong tra 200.
