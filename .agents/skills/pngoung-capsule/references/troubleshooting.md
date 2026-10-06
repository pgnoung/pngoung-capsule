# แก้ปัญหา

| อาการ | วิธีแก้ |
| --- | --- |
| Mac เปิด .command ไม่ได้ | ใช้ Open Anyway ใน Privacy & Security หาก macOS แสดงตัวเลือกสำหรับไฟล์ที่ตรวจแล้ว หรือให้ AI เปิดโฟลเดอร์และรัน bash install/pngoung-capsule.sh install; ไม่ปิด Gatekeeper ทั้งระบบ |
| Windows บล็อก PowerShell | ใช้ตัวเปิด .bat ที่มี process-scoped ExecutionPolicy; ถ้านโยบายองค์กรห้าม ให้ผู้ดูแลอนุญาต ห้ามแก้นโยบายเครื่องเพื่อเลี่ยง |
| ดาวน์โหลด Node ไม่ผ่าน | ตรวจอินเทอร์เน็ตและ nodejs.org แล้วรันซ้ำ; checksum ไม่ตรงต้องหยุด |
| doctor ผ่านแต่ Agent ไม่เห็น Skill | เปิด session ใหม่ หรือให้ Agent อ่าน SKILL.md ใน repo โดยตรง; ไฟล์ติดตั้งไม่เท่ากับ native discovery |
| มี Skill ชื่อเดียวกันอยู่แล้ว | รักษาของเดิมไว้ ตรวจเจ้าของก่อนย้าย/เปลี่ยนชื่อ แล้วติดตั้งใหม่ |
| ไฟล์มีค่าลับ | เอาค่าลับออกจากไฟล์ต้นทาง/summary ใช้ตัวอย่างที่ไม่มีค่าแทน ห้ามปิด scanner |
| ไม่พบ capsule ที่อีกเครื่อง | ตรวจ sync/transfer ที่ผู้ใช้เลือก การสร้างไฟล์ต้นทางไม่ยืนยันการมาถึงปลายทาง |
| conflict / divergent | รับเข้าโฟลเดอร์ใหม่ ตรวจความแตกต่าง เก็บทั้งสองสำเนา แล้วตัดสินใจรวมอย่างชัดเจน |
| recoverRequired | ให้ Agent รัน recover ตาม Skill; หากมี local edits หลัง crash ให้สำรองและจัดการด้วยมือ |
| พอร์ต 4386 ไม่ว่าง | แอปเลือกพอร์ตถัดไปและแสดง URL จริง ไม่ใช้หน้าเว็บของโปรแกรมอื่นที่พอร์ตเดิม |
| ภาษาไทยหาเรื่องเก่ายาก | รุ่นนี้รับ capsule ที่เลือกโดยตรง; QMD เป็นส่วนเสริมภายหลัง |

ขอบเขต v1: UTF-8 text เท่านั้น, 300 ไฟล์, ไฟล์ละ 2 MiB, รวม 20 MiB. ไม่รวม binary, รูป, PDF, Git history, dependencies, logins, cloud chat history หรือ approvals. เวลาที่ส่งกับชื่อผู้ส่งเป็นข้อมูลที่ผู้สร้างระบุ ไม่ใช่การรับรองตัวตน.

## Send interrupted
Run `cli recover-send --project "<folder>"`. This resumes the same ID using the pending-send journal. Keep that journal until local readback and state both succeed. Do not edit the project during recovery.
