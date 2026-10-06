# ผลตรวจ v1.0.0 — 2026-10-06

สถานะ: ชุดใช้งานในเครื่องที่ผ่าน QA บน macOS; ยังไม่เผยแพร่ GitHub และยังไม่ผ่าน acceptance บน Windows หรือข้ามเครื่องจริง

| สิ่งที่ตรวจ | ผล |
| --- | --- |
| Node automated tests | ผ่าน 24/24 บน macOS และ Node 22 portable |
| OS launcher acceptance | ผ่านบน macOS: 22 installer/CLI subprocess calls, 3 โปรไฟล์จำลอง, private Node 22, Unicode และ path มีช่องว่าง; ยังไม่ใช่ AI บัญชีจริง |
| A → B → C → A → final | ผ่าน 4 revisions ในโฟลเดอร์จำลอง พร้อมตรวจ SHA-256 |
| ป้องกันเขียนทับ local edits / งานแตกสาย / รุ่นเก่า | ผ่าน |
| interrupted send/receive recovery | ผ่าน fault-injection; send ใช้ ID เดิม และ receive คืน context เดิม |
| ติดตั้งจากสำเนาใหม่ที่ไม่มี Node ใน PATH | ผ่าน; ดาวน์โหลด Node ทางการพร้อมตรวจ SHA-256 แล้วติดตั้ง Skill ทั้งสองแบบ |
| bootstrap get.sh | ผ่านจาก archive ภายในเครื่อง; เก็บโฟลเดอร์เดิมโดยปฏิเสธการเขียนทับ |
| Windows PowerShell files | parse ผ่านด้วย PowerShell 7.6.6; main installer และ CLI รันผ่านบน macOS |
| Native Windows / PowerShell 5.1 | ยังไม่ได้ทดสอบบน Windows จริง |
| Native Linux | ยังไม่ได้ทดสอบ |
| API readiness / capsule inspection / origin guard | ผ่าน automated tests |
| Browser visual/responsive inspection | ยังไม่ผ่าน: Chrome ในเครื่องทดสอบบล็อก localhost ด้วย ERR_BLOCKED_BY_CLIENT |
| UI text contrast | คู่สีข้อความหลักตรวจได้อย่างน้อย 6.01:1; ไม่ใช่ accessibility audit ทั้งหมด |
| Privacy scan | ผ่าน; ใส่ canary จำลองแล้ว audit ต้องปฏิเสธและตรวจพบจริง |
| Agent native skill discovery | ตรวจไฟล์ติดตั้งแล้ว; ต้องเปิดแชตใหม่และตรวจจาก Agent จริงอีกครั้ง |
| บัญชี A/B/C และ cloud sync/SSH | ยังไม่มีผลทดสอบการเดินทางบนเครื่องจริง |
| GitHub/CI | เตรียม workflow macOS/Windows/Linux ทั้ง unit tests และ OS launcher acceptance; ยังไม่ได้รันบน GitHub |

## ตรวจรับข้ามเครื่องก่อนใช้สอนเป็นระบบที่พิสูจน์แล้ว

1. ติดตั้งบนเครื่อง A และ B ให้ doctor ผ่าน และให้ Agent อ่าน Skill ได้
2. A ส่ง capsule ของโปรเจกต์ฝึกหนึ่งไฟล์ผ่านช่องทางที่เลือก
3. B ตรวจ ID/SHA-256 รับลงโฟลเดอร์ว่าง แก้ข้อความ แล้วส่งกลับ
4. C รับรุ่นจาก B ทำต่อ ส่งให้ A; A รับและตรวจเนื้อหา/hash จากรุ่นล่าสุด
5. A รัน final แล้วตรวจสถานะ บันทึก OS, Agent และผลจริงโดยไม่บันทึก credential

ห้ามใช้ผลจำลองนี้แทนคำยืนยันว่าบัญชี แอป หรือ OS อื่นทำงานแล้ว
