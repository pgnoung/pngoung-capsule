# pngoung capsule

**เปลี่ยนเครื่อง เปลี่ยน AI แล้วรับช่วงงานต่อด้วยบริบทและไฟล์ที่ตรวจสอบได้**

ชุดฝึกและเครื่องมือสำหรับ Codex / Claude Code: ส่งงานจาก A → B → C → กลับ A เพื่อปิดงาน เก็บเป้าหมาย ข้อตัดสินใจ งานค้าง ข้อจำกัด และไฟล์ที่เลือกไว้ใน `.capsule` เดียว

## เริ่มในคลิกเดียว

[ดาวน์โหลด ZIP](https://github.com/pgnoung/pngoung-capsule/archive/refs/heads/main.zip) แล้วแตกไฟล์ไว้ในโฟลเดอร์ส่วนตัว:

- **Mac:** ดับเบิลคลิก `PngoungCapsule-mac.command`
- **Windows:** ดับเบิลคลิก `PngoungCapsule-windows.bat`
- **Linux:** `bash install/pngoung-capsule.sh start`

ตัวเปิดจะเตรียม Node 22 ถ้ายังไม่มี ตรวจ SHA-256 ติดตั้ง Skill ให้ Codex/Claude สร้างชุดฝึก ตรวจความพร้อม และเปิดหน้าเริ่มต้น คัดลอกข้อความในหน้านั้นให้ AI พาใช้ต่อจนจบ

หากใช้ Agent อยู่แล้ว เปิดโฟลเดอร์นี้แล้ววางข้อความจาก [00_START_HERE_PROMPT.md](00_START_HERE_PROMPT.md) ได้เลย ไม่ต้องมี API key, QMD หรือ SSH สำหรับแกนส่งต่องาน

## สิ่งที่ได้

- Skill `pngoung-capsule` สำหรับติดตั้ง รับงาน ส่งงาน และตรวจปิดงาน
- หน้าตรวจความพร้อมและอ่าน packet ก่อนรับเข้าโปรเจกต์
- CLI ที่ AI ใช้ได้ พร้อม JSON receipts
- ตรวจ checksum, รุ่นเก่า/งานแตกสาย, local edits, path และรูปแบบค่าลับ
- ชุดฝึก A → B → C → A พร้อม [แบบฝึกภาษาไทย](docs/EXERCISES_TH.md)

## ใช้งานประจำวัน

บอก AI: **“ใช้ pngoung-capsule เตรียมส่งงานนี้ต่อ”** — AI จะให้เลือกโปรเจกต์ ไฟล์ที่จะส่ง และโฟลเดอร์ปลายทาง

เครื่องถัดไป: **“ใช้ pngoung-capsule รับงานจากไฟล์นี้ แล้วทำส่วนที่ค้างต่อ”** — ครั้งแรกรับเข้าโฟลเดอร์ว่าง และตรวจ preview ก่อนเขียนไฟล์

กลับเครื่องแรก: **“รับ capsule ล่าสุดของงานนี้ ตรวจงาน แล้ว final”** — ต้องอ่านรุ่นล่าสุดแม้เป็นแชตเดิม

ใช้โฟลเดอร์ส่งต่อร่วมกันที่คุณตั้งค่า sync อยู่แล้ว หรือคัดลอกไฟล์ .capsule ด้วยตัวเอง เก็บโปรเจกต์ทำงานแต่ละเครื่องแยกจากโฟลเดอร์ส่งต่อ และมีผู้รับช่วงแก้งานทีละเครื่อง

## คำสั่งสำหรับ AI

```sh
bash install/pngoung-capsule.sh install
bash install/pngoung-capsule.sh doctor
bash install/pngoung-capsule.sh demo
bash install/pngoung-capsule.sh cli help
```

Windows ใช้ `powershell -NoProfile -ExecutionPolicy Bypass -File install\pngoung-capsule.ps1` แทน prefix `bash install/pngoung-capsule.sh` และตามด้วยคำสั่งเดียวกัน

## สถานะและข้อควรรู้

- ผลทดสอบของชุดที่ส่งมอบอยู่ [VALIDATION.md](docs/VALIDATION.md) แยก Mac/Windows/Linux และการจำลองออกจากเครื่องจริง
- v1 รองรับไฟล์ข้อความ UTF-8: สูงสุด 300 ไฟล์, ไฟล์ละ 2 MiB, รวม 20 MiB; รูป/PDF/binary ส่งแยก
- Capsule ไม่ย้าย live processes, การล็อกอิน, dependencies หรือประวัติแชตทั้งหมด
- ไฟล์ .capsule ไม่ได้เข้ารหัส ใช้ช่องทางส่งต่อที่เชื่อถือและตรวจข้อมูลก่อนส่ง ดู [Privacy](docs/PRIVACY_TH.md)
- `final` บันทึกสถานะปิดงานภายในโครงการ ไม่มีการ deploy/publish/send ภายนอก
- ไม่ติดตั้งหรือเลือกบัญชี AI ให้อัตโนมัติ การล็อกอินและสิทธิ์องค์กรเป็นขั้นตอนของผู้ใช้

## ผู้สอนและผู้พัฒนา

`npm test` ทดสอบรับ–ส่ง–ปิดงาน ความขัดแย้ง และการป้องกันข้อมูล

`npm run acceptance` ทดสอบตัวติดตั้งของ OS ปัจจุบันในโฟลเดอร์ชั่วคราว ดาวน์โหลด private Node จาก nodejs.org แล้วรับ–ส่ง–final ผ่าน CLI จริง 3 โปรไฟล์จำลอง โดยไม่แตะ Skill ของผู้ใช้ และลบพื้นที่ฝึกเมื่อจบ ต้องใช้อินเทอร์เน็ต; ผลนี้ไม่ใช่การทดสอบ AI บัญชีจริง

`.github/workflows/ci.yml` รันทดสอบบน macOS/Windows/Linux ทุกครั้งที่ push หรือเปิด pull request ดู [ผล CI ล่าสุด](https://github.com/pgnoung/pngoung-capsule/actions/workflows/ci.yml) โดยเปิดรายละเอียดของ commit ที่ใช้

แกนโปรแกรม: `src/core.mjs` · CLI: `src/cli.mjs` · ตัวติดตั้ง: `install/` · Skill: `skill/` · หน้าเริ่มต้น: `public/` ไม่มี npm runtime dependency

นักเรียนใช้คลังและบัญชีของตัวเอง ดู [วิธีถอนการติดตั้ง](docs/PRIVACY_TH.md)

## ติดตั้งจาก GitHub

**macOS / Linux — วางใน Terminal**

```sh
curl -fsSL https://raw.githubusercontent.com/pgnoung/pngoung-capsule/main/install/get.sh | bash
```

**Windows — วางใน PowerShell**

```powershell
irm https://raw.githubusercontent.com/pgnoung/pngoung-capsule/main/install/get.ps1 | iex
```

ติดตั้งไว้ในโฟลเดอร์ `pngoung-capsule` ใต้ home ของคุณ แล้วเปิดหน้าเริ่มต้น หากโฟลเดอร์นี้มีอยู่แล้ว ให้เปิด launcher ภายในโฟลเดอร์เดิม; bootstrap จะไม่เขียนทับงานเดิม

หากนโยบายเครื่องไม่อนุญาตการรันสคริปต์ ให้ใช้ ZIP และทำตามขั้นตอนที่องค์กรอนุญาต ดู [ผลตรวจและข้อจำกัด](docs/VALIDATION.md)

Advanced: [Optional environment configuration](docs/CONFIGURATION.md). The app does not load .env files.

<!-- pngoung-brand:start -->
---

<p align="center">
  <a href="https://line.me/R/ti/p/@pngoung"><img src="docs/pngoung/pngoung-logo.jpg" width="280" alt="พี่ง้วง — School of AI Agent Automation"></a>
</p>

<h3 align="center">อยากสร้างระบบ AI ที่ทำงานแทนได้จริงแบบนี้เป็น</h3>

<p align="center">
  <b>พี่ง้วง · School of AI Agent Automation</b><br>
  คลาสเรียน AI Agent · Automation · LINE OA และ <b>In-house Training</b> สำหรับทีมและองค์กร เน้นลงมือทำกับงานจริงของคุณ<br>
  สอบถามได้ที่ LINE OA <a href="https://line.me/R/ti/p/@pngoung"><b>@pngoung</b></a>
</p>

<p align="center"><sub>made with ♡ by pngoung</sub></p>
<!-- pngoung-brand:end -->
