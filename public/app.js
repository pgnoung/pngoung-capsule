const byId = id => document.getElementById(id);
async function refresh() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('เปิดข้อมูลสถานะไม่ได้');
    const data = await response.json();
    byId('checks').replaceChildren();
    const checks = [...data.checks, { name: 'ชุดฝึก A → B → C → A', ok: data.demo?.ok, fix: 'ให้ Agent รันคำสั่ง demo' }];
    for (const item of checks) {
      const row = document.createElement('div'); row.className = 'check';
      const label = document.createElement('span'); label.textContent = item.name;
      const state = document.createElement('span'); state.className = item.ok ? 'pass' : 'warn'; state.textContent = item.ok ? 'ผ่าน' : 'ต้องตั้งค่า';
      row.append(label, state); byId('checks').append(row);
    }
    byId('prompt').value = `ใช้ Skill pngoung-capsule ช่วยตั้งค่าและพาฉันฝึกส่งงานต่อจนจบ โปรแกรมติดตั้งอยู่ที่ ${JSON.stringify(data.appRoot)} อ่าน SKILL.md ของชุดนี้ก่อนทำงาน ตรวจ doctor แล้วรัน demo ตรวจไฟล์จริงที่กลับมาถึง A และสถานะ final จากนั้นถามฉันทีละข้อเรื่องโปรเจกต์จริงและโฟลเดอร์ส่งต่อ ใช้เฉพาะข้อมูลที่ฉันเลือก หยุดเมื่อจำเป็นต้องให้ฉันล็อกอินหรือยืนยันสิทธิ์ ส่งมอบหลักฐานและข้อจำกัดตามที่ตรวจจริง`;
  } catch (e) { byId('checks').textContent = e.message; }
}
byId('refresh').addEventListener('click', refresh);
byId('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(byId('prompt').value); byId('copy-state').textContent = 'คัดลอกแล้ว — วางใน Codex หรือ Claude Code ได้เลย'; }
  catch { byId('prompt').select(); byId('copy-state').textContent = 'เลือกข้อความแล้ว กดคัดลอกบนคีย์บอร์ด'; }
});
byId('file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 40 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 40 MiB');
    const response = await fetch('/api/inspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await file.text() });
    const c = await response.json(); if (!response.ok) throw new Error(c.error);
    byId('inspection').textContent = `ตรวจ checksum ผ่าน\n${c.name} · รุ่น ${c.revision} · ${c.status}\nผู้ส่งระบุ: ${c.sender}\n\nเป้าหมาย\n${c.task.goal}\n\nทำถึงไหน\n${c.task.doing}\n\nงานค้าง\n${c.task.pending || 'ไม่มี'}\n\nไฟล์ ${c.files.length} รายการ\n${c.files.map(f => f.path).join('\n')}\n\nID: ${c.id}\n\nให้ Agent inspect และ receive แบบ preview ก่อน apply`;
  } catch (e) { byId('inspection').textContent = `ยังรับไม่ได้: ${e.message}`; }
});
refresh();
