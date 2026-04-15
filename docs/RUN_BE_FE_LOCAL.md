# Run BE + FE Local (Quick Guide)

Muc tieu: bat nhanh backend va frontend de test tren localhost.

## 1) Dieu kien can co

- Docker va Docker Compose da cai.
- Dang o workspace CoffeeChain.
- Da co network artifacts/crypto (neu truoc do da setup network thi bo qua).

## 2) Chay backend + frontend

Tu thu muc goc du an:

cd /media/sagito/SHARED/WINDOW/BTL/CoffeeChain/network

docker compose up -d backend frontend

Lenh nay se tu dong keo cac dependency can thiet (postgres, ipfs, peer, orderer, ...).

## 3) Kiem tra da len chua

Kiem tra trang thai container:

docker compose ps

Kiem tra endpoint:

curl -I http://localhost:8080/swagger-ui.html
curl -I http://localhost:3000

Ky vong:
- Frontend tra ve HTTP 200 tren cổng 3000.
- Backend tra ve HTTP 302/200 cho swagger va API login tra ve 200.

Test nhanh API login:

curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}'

## 4) Stop khi khong dung nua

Chi stop container (giu data):

docker compose stop backend frontend

Stop toan bo stack:

docker compose stop

## 5) Chay lai sau khi reboot may

cd /media/sagito/SHARED/WINDOW/BTL/CoffeeChain/network

docker compose up -d backend frontend

## 6) Neu gap loi thuong gap

- Port da bi chiem:
  - Kiem tra process dang nghe 3000/8080.
  - Hoac stop stack cu: docker compose down

- Backend len nhung API loi ket noi Fabric:
  - Kiem tra peer/orderer co dang Up trong docker compose ps.
  - Neu network chua setup, chay lai script setup trong network/scripts.

- Frontend len nhung khong goi duoc backend:
  - Kiem tra backend con Up.
  - Kiem tra trong docker compose frontend co NEXT_PUBLIC_API_URL=http://localhost:8080.
