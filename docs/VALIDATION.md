# ผลตรวจ v1.0.0 — 2026-10-06

เผยแพร่ที่ [pgnoung/pngoung-capsule](https://github.com/pgnoung/pngoung-capsule) แล้ว ตัวติดตั้งและการส่งต่องานผ่าน CI บน macOS, Windows และ Linux; การใช้งานผ่าน AI บัญชีจริง A/B/C ยังต้องตรวจรับแยก

หลักฐานรุ่นโค้ด `99a4aca44085bc4ae222506281c325e81f9111c3`: [CI ผ่านทั้งสาม OS](https://github.com/pgnoung/pngoung-capsule/actions/runs/37433558488) รวม unit tests, OS launcher และ public GitHub bootstrap ดู [CI ล่าสุด](https://github.com/pgnoung/pngoung-capsule/actions/workflows/ci.yml) สำหรับ commit ที่ติดตั้ง

| สิ่งที่ตรวจ | ผล |
| --- | --- |
| Node automated tests | macOS/Linux ผ่าน 24/24; Windows ผ่าน 23 และข้าม 1 symlink test; ไม่มี test ที่ล้มเหลว |
| OS launcher acceptance | ผ่านทั้งสาม OS: 22 installer/CLI subprocess calls ต่อ OS, 3 โปรไฟล์จำลอง, private Node 22, Unicode และ path มีช่องว่าง |
| A → B → C → A → final | ผ่าน 4 revisions ต่อ OS พร้อมตรวจ SHA-256 และยืนยันว่าไฟล์ที่ไม่ได้เลือกไม่ถูกส่ง |
| ป้องกันเขียนทับ local edits / งานแตกสาย / รุ่นเก่า | ผ่าน automated tests |
| interrupted send/receive recovery | ผ่าน fault-injection; send ใช้ ID เดิม และ receive คืน context เดิม |
| ติดตั้ง private Node | ดาวน์โหลด Node 22.23.3 ทางการพร้อมตรวจ SHA-256 แล้วติดตั้ง Skill ทั้ง Codex/Claude |
| Public GitHub bootstrap | get.sh บน macOS/Linux และ get.ps1 บน Windows ผ่าน: ดาวน์โหลด raw script/commit archive จริง, ตรวจไฟล์ที่ติดตั้ง, doctor/demo ผ่าน, ปฏิเสธโฟลเดอร์เดิมและเก็บ canary ไว้ |
| Native Windows / PowerShell 5.1 | ผ่านบน GitHub-hosted Windows runner; ยังไม่ใช่เครื่องส่วนตัวของนักเรียน |
| macOS / Linux | ผ่านบน GitHub-hosted runners; Mac ในเครื่องผู้พัฒนาทดสอบติดตั้งจาก GitHub จริงเพิ่มเติมแล้ว |
| API readiness / capsule inspection / origin guard | ผ่าน automated tests |
| Browser visual/responsive inspection | ยังไม่ยืนยัน: Chrome ในเครื่องทดสอบบล็อก localhost ด้วย ERR_BLOCKED_BY_CLIENT |
| UI text contrast | คู่สีข้อความหลักตรวจได้อย่างน้อย 6.01:1; ไม่ใช่ accessibility audit ทั้งหมด |
| Privacy scan | ผ่าน; canary ค่าลับจำลองถูก audit ปฏิเสธจริง |
| Agent native skill discovery | ตรวจไฟล์ติดตั้งแล้ว; ต้องเปิดแชตใหม่และตรวจจาก Agent จริงอีกครั้ง |
| บัญชี A/B/C และ cloud sync/SSH | ยังไม่มีผลทดสอบเดินทางระหว่างบัญชีและเครื่องจริง; ตัวโปรแกรมไม่สร้างระบบ sync หรือบัญชี cloud ให้เอง |

CI ใช้โปรไฟล์ในโฟลเดอร์ชั่วคราวบนแต่ละ OS มีการแก้ปัญหา PowerShell module path และชื่อโฟลเดอร์ Windows แบบย่อ/เต็มที่พบจากการรันจริง ผล CI ไม่ได้ยืนยันการข้ามจากเครื่อง Mac ไป Windows หรือการเข้าถึงบัญชี AI ของผู้ใช้

## ตรวจรับข้ามเครื่องก่อนใช้สอนเป็นระบบที่พิสูจน์แล้ว

1. ติดตั้งบนเครื่อง A และ B ให้ doctor ผ่าน และให้ Agent อ่าน Skill ได้
2. A ส่ง capsule ของโปรเจกต์ฝึกหนึ่งไฟล์ผ่านช่องทางที่เลือก
3. B ตรวจ ID/SHA-256 รับลงโฟลเดอร์ว่าง แก้ข้อความ แล้วส่งกลับ
4. C รับรุ่นจาก B ทำต่อ ส่งให้ A; A รับและตรวจเนื้อหา/hash จากรุ่นล่าสุด
5. A รัน final แล้วตรวจสถานะ บันทึก OS, Agent และผลจริงโดยไม่บันทึก credential

ห้ามใช้ผลโปรไฟล์จำลองแทนคำยืนยันว่าบัญชี AI การ sync หรือเครื่องจริงทั้งหมดทำงานแล้ว
