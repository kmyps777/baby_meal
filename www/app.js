import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://zhqegcdhaqsblvzbpexe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocWVnY2RoYXFzYmx2emJwZXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Mjk3MjgsImV4cCI6MjA5MTEwNTcyOH0.UnR5s4QeMMcOlF-qiBSCGBTWzgUile_R7EQOogFJqDk';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Device ID ──────────────────────────────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    localStorage.setItem('device_id', id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

// ── 이메일 상태 ────────────────────────────────────────────────────────────
let linkedEmail = localStorage.getItem('linked_email') || null;

// ── State ──────────────────────────────────────────────────────────────────
const DEFAULT_GRAINS = [
  { name: '쌀',   g: 20 },
  { name: '찹쌀', g: 5  },
  { name: '현미', g: 3  },
  { name: '보리', g: 3  },
  { name: '귀리', g: 3  },
  { name: '수수', g: 2  },
];
let grains         = JSON.parse(JSON.stringify(DEFAULT_GRAINS));
let saveSettingsTm = null;

// ── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const num = id => +$(id).value || 0;

// ── Sync status ────────────────────────────────────────────────────────────
function syncStatus(state, msg) {
  $('sync-dot').className     = 'sync-dot ' + state;
  $('sync-label').textContent = msg;
}

// ── Tab switching ──────────────────────────────────────────────────────────
window.switchTab = (tab) => {
  document.querySelectorAll('.tab').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(el =>
    el.classList.toggle('active', el.id === 'tab-' + tab));
};

// ── Stepper ────────────────────────────────────────────────────────────────
window.stepValue = (id, delta) => {
  const el = $(id);
  el.value = Math.min(+(el.max||999), Math.max(+(el.min||1), num(id) + delta));
  calc();
};

window.stepEdit = (id, delta, min, max) => {
  const el = $(id);
  el.value = Math.min(max, Math.max(min, (+el.value||0) + delta));
};

// ── 이메일 백업 UI ─────────────────────────────────────────────────────────
function renderEmailBackupUI() {
  const el = $('email-backup-area');
  if (linkedEmail) {
    el.innerHTML = `
      <div class="email-linked-box">
        <div class="email-linked-label">📧 연결된 이메일</div>
        <div class="email-linked-value">${esc(linkedEmail)}</div>
        <div class="email-btn-row">
          <button class="email-btn-sync" onclick="syncFromEmail()">📥 이 기기로 불러오기</button>
          <button class="email-btn-unlink" onclick="unlinkEmail()">연결 해제</button>
        </div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="email-input-box">
        <p class="email-desc">이메일을 입력하면 기기가 바뀌어도 데이터를 유지할 수 있어요.</p>
        <input type="email" id="backup-email-input" placeholder="이메일 주소 입력" class="save-input" style="margin-bottom:8px" />
        <button class="save-btn" onclick="linkEmail()" style="background:linear-gradient(135deg,#74B9E0,#185FA5)">
          📧 이메일로 백업하기
        </button>
      </div>
    `;
  }
}

// ── 이메일 연결 ────────────────────────────────────────────────────────────
window.linkEmail = async () => {
  const email = $('backup-email-input')?.value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    alert('올바른 이메일을 입력해주세요.');
    return;
  }

  syncStatus('loading', '백업 중...');
  try {
    // 기존 이메일 데이터가 있는지 확인
    const { data: existing } = await sb
      .from('settings')
      .select('device_id')
      .eq('email', email)
      .single();

    if (existing && existing.device_id !== DEVICE_ID) {
      const confirm = window.confirm(
        `이미 다른 기기에서 이 이메일로 백업된 데이터가 있어요.\n\n현재 기기 데이터로 덮어쓸까요?\n(취소하면 기존 데이터를 불러와요)`
      );
      if (!confirm) {
        // 기존 데이터 불러오기
        linkedEmail = email;
        localStorage.setItem('linked_email', email);
        await syncFromEmail();
        return;
      }
    }

    // 현재 데이터를 이메일과 연결해서 저장
    await sb.from('settings').upsert({
      device_id:  DEVICE_ID,
      email,
      grains,
      n:     num('n-mult'),
      meals: num('meals-per-day'),
      days:  num('days'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'device_id' });

    // 레시피도 이메일 연결
    const { data: myRecipes } = await sb
      .from('recipes')
      .select('id')
      .eq('device_id', DEVICE_ID);

    if (myRecipes?.length) {
      await sb.from('recipes')
        .update({ email })
        .eq('device_id', DEVICE_ID);
    }

    linkedEmail = email;
    localStorage.setItem('linked_email', email);
    syncStatus('ok', '이메일 백업 완료 ✓');
    renderEmailBackupUI();
    alert(`✅ 백업 완료!\n${email} 로 데이터가 연결됐어요.`);
  } catch(e) {
    syncStatus('err', '백업 실패');
    alert('백업 실패: ' + e.message);
  }
};

// ── 이메일로 데이터 불러오기 ───────────────────────────────────────────────
window.syncFromEmail = async () => {
  if (!linkedEmail) return;
  syncStatus('loading', '불러오는 중...');
  try {
    // 설정 불러오기
    const { data: s } = await sb
      .from('settings')
      .select('*')
      .eq('email', linkedEmail)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (s) {
      if (s.grains) grains = s.grains;
      if (s.n)      $('n-mult').value        = s.n;
      if (s.meals)  $('meals-per-day').value = s.meals;
      if (s.days)   $('days').value          = s.days;
      renderGrains(); calc();

      // 이 기기 ID로 업데이트
      await sb.from('settings').upsert({
        ...s,
        device_id: DEVICE_ID,
        email: linkedEmail,
      }, { onConflict: 'device_id' });
    }

    // 레시피 불러오기
    const { data: recipes } = await sb
      .from('recipes')
      .select('*')
      .eq('email', linkedEmail)
      .order('created_ts', { ascending: false });

    if (recipes?.length) {
      for (const r of recipes) {
        await sb.from('recipes').upsert({
          ...r,
          device_id: DEVICE_ID,
          email: linkedEmail,
        }, { onConflict: 'id' });
      }
    }

    syncStatus('ok', '불러오기 완료 ✓');
    loadRecipesList();
    alert(`✅ 불러오기 완료!\n설정 + 레시피 ${recipes?.length || 0}개`);
  } catch(e) {
    syncStatus('err', '불러오기 실패');
    alert('불러오기 실패: ' + e.message);
  }
};

// ── 이메일 연결 해제 ───────────────────────────────────────────────────────
window.unlinkEmail = () => {
  if (!confirm('이메일 연결을 해제할까요?\n(데이터는 삭제되지 않아요)')) return;
  linkedEmail = null;
  localStorage.removeItem('linked_email');
  renderEmailBackupUI();
  syncStatus('ok', '연결 해제됨');
};

// ── Load settings ──────────────────────────────────────────────────────────
async function loadSettings() {
  syncStatus('loading', '불러오는 중...');
  try {
    const { data } = await sb
      .from('settings')
      .select('*')
      .eq('device_id', DEVICE_ID)
      .single();
    if (data) {
      if (data.grains) grains = data.grains;
      if (data.n)      $('n-mult').value        = data.n;
      if (data.meals)  $('meals-per-day').value = data.meals;
      if (data.days)   $('days').value          = data.days;
      if (data.email && !linkedEmail) {
        linkedEmail = data.email;
        localStorage.setItem('linked_email', data.email);
      }
    }
    syncStatus('ok', '불러옴 ✓');
  } catch(e) {
    syncStatus('ok', '새 기기');
  }
  renderGrains();
  calc();
  renderEmailBackupUI();
}

// ── Save settings (debounced) ──────────────────────────────────────────────
function scheduleSettingsSave() {
  clearTimeout(saveSettingsTm);
  saveSettingsTm = setTimeout(async () => {
    try {
      await sb.from('settings').upsert({
        device_id:  DEVICE_ID,
        email:      linkedEmail,
        grains,
        n:     num('n-mult'),
        meals: num('meals-per-day'),
        days:  num('days'),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'device_id' });
      syncStatus('ok', '저장됨 ✓');
    } catch(e) {
      syncStatus('err', '저장 실패');
    }
  }, 800);
}

// ── Render grain list ──────────────────────────────────────────────────────
function renderGrains() {
  const list = $('grain-list');
  list.innerHTML = '';
  grains.forEach((g, i) => {
    const div = document.createElement('div');
    div.className = 'grain-item';
    div.innerHTML = `
      <input type="text" value="${esc(g.name)}" placeholder="잡곡 이름"
             oninput="updateGrain(${i},'name',this.value)" />
      <div class="grain-g-wrap">
        <button class="grain-stepper" onclick="stepGrain(${i},-1)">−</button>
        <input type="number" value="${g.g}" min="0" step="1" id="grain-input-${i}"
               oninput="updateGrain(${i},'g',+this.value)" />
        <span class="grain-g-label">g</span>
        <button class="grain-stepper" onclick="stepGrain(${i},1)">+</button>
      </div>
      <button class="del-btn" onclick="removeGrain(${i})">🗑️</button>
    `;
    list.appendChild(div);
  });
}

window.updateGrain = (i, key, val) => { grains[i][key]=val; calc(); scheduleSettingsSave(); };

window.stepGrain = (i, delta) => {
  grains[i].g = Math.max(0,(grains[i].g||0)+delta);
  const inp = $('grain-input-'+i);
  if (inp) inp.value = grains[i].g;
  calc(); scheduleSettingsSave();
};

window.removeGrain = (i) => { grains.splice(i,1); renderGrains(); calc(); scheduleSettingsSave(); };

$('add-grain-btn').addEventListener('click', () => {
  grains.push({name:'새 잡곡',g:1});
  renderGrains(); calc(); scheduleSettingsSave();
});

['n-mult','meals-per-day','days'].forEach(id => $(id).addEventListener('input', calc));

// ── Calculation ────────────────────────────────────────────────────────────
function calc() {
  const n=num('n-mult')||10, meals=num('meals-per-day')||1, days=num('days')||1;
  const totalMeals=meals*days;
  $('total-meals-display').textContent=totalMeals;

  const grainTotal1=grains.reduce((s,g)=>s+(g.g||0),0);
  const water1=grainTotal1*n;
  const porridge1=grainTotal1+water1;

  const ingList=$('ingredient-list');
  ingList.innerHTML='';
  grains.forEach(g => {
    const row=document.createElement('div');
    row.className='ingredient-row';
    row.innerHTML=`
      <div class="ing-info">
        <div class="ing-name">${esc(g.name)}</div>
        <div class="ing-detail">1회 ${g.g}g × ${totalMeals}끼</div>
      </div>
      <div class="ing-amount">${((g.g||0)*totalMeals).toFixed(0)}g</div>
    `;
    ingList.appendChild(row);
  });

  const waterRow=document.createElement('div');
  waterRow.className='ingredient-row water-row';
  waterRow.innerHTML=`
    <div class="ing-info">
      <div class="ing-name">💧 물</div>
      <div class="ing-detail">1회 ${water1.toFixed(0)}g × ${totalMeals}끼 (${n}배죽)</div>
    </div>
    <div class="ing-amount">${(water1*totalMeals).toFixed(0)}g</div>
  `;
  ingList.appendChild(waterRow);

  $('r-grain-total').textContent=(grainTotal1*totalMeals).toFixed(0)+'g';
  $('r-water-total').textContent=(water1*totalMeals).toFixed(0)+'g';
  $('r-grand-total').textContent=(porridge1*totalMeals).toFixed(0)+'g';
  $('porridge-hint').textContent=`🍲 1회 베이스죽 재료량 약 ${porridge1.toFixed(0)}g · 밥솥 조리 후 실제 완성량은 약간 줄어들어요`;

  scheduleSettingsSave();
}

// ── Save recipe ────────────────────────────────────────────────────────────
$('save-btn').addEventListener('click', async () => {
  const name=$('recipe-name').value.trim();
  if (!name) {
    $('recipe-name').style.borderColor='#FF8C69';
    setTimeout(()=>$('recipe-name').style.borderColor='',1500);
    return;
  }
  const btn=$('save-btn');
  btn.disabled=true; btn.textContent='저장 중... 🌀';

  const n=num('n-mult')||10, meals=num('meals-per-day')||1, days=num('days')||1;
  const totalMeals=meals*days;
  const grainTotal=grains.reduce((s,g)=>s+(g.g||0),0);
  const water1=grainTotal*n;
  const id='r_'+Date.now();

  try {
    await sb.from('recipes').insert({
      id, device_id:DEVICE_ID, email:linkedEmail, name,
      memo:           $('recipe-memo').value.trim(),
      n, meals, days,
      grains:         JSON.parse(JSON.stringify(grains)),
      porridge1:      (grainTotal+water1).toFixed(0),
      grain_total_all:(grainTotal*totalMeals).toFixed(0),
      water_all:      (water1*totalMeals).toFixed(0),
      created_at:     new Date().toLocaleDateString('ko-KR'),
      created_ts:     Date.now(),
    });
    $('recipe-name').value='';
    $('recipe-memo').value='';
    syncStatus('ok','레시피 저장 완료 🌟');
    window.switchTab('recipes');
    loadRecipesList();
  } catch(e) {
    syncStatus('err','저장 실패');
    alert('저장 실패: '+e.message);
  }
  btn.disabled=false; btn.textContent='🌟 레시피 저장하기';
});

// ── Delete recipe ──────────────────────────────────────────────────────────
window.deleteRecipe = async (id) => {
  if (!confirm('이 레시피를 삭제할까요?')) return;
  try {
    await sb.from('recipes').delete().eq('id',id).eq('device_id',DEVICE_ID);
    syncStatus('ok','레시피 삭제됨');
    loadRecipesList();
  } catch(e) { syncStatus('err','삭제 실패'); }
};

// ── Load recipe into form ──────────────────────────────────────────────────
window.loadRecipe = (r) => {
  grains=JSON.parse(JSON.stringify(r.grains));
  $('n-mult').value=r.n;
  $('meals-per-day').value=r.meals;
  $('days').value=r.days;
  renderGrains(); calc();
  syncStatus('ok',`"${r.name}" 불러옴 ✓`);
  window.switchTab('calc');
  window.scrollTo({top:0,behavior:'smooth'});
};

// ── Load recipes list ──────────────────────────────────────────────────────
async function loadRecipesList() {
  const { data:list } = await sb
    .from('recipes')
    .select('*')
    .eq('device_id', DEVICE_ID)
    .order('created_ts', { ascending:false });
  renderRecipes(list||[]);
}

// ── Render recipe list ─────────────────────────────────────────────────────
function renderRecipes(list) {
  const badge=$('recipe-badge');
  badge.style.display=list.length?'inline-flex':'none';
  if (list.length) badge.textContent=list.length;

  const el=$('recipes-list');
  if (!list.length) {
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">🥣</div><div>저장된 레시피가 없어요<br>계산 탭에서 저장해보세요!</div></div>`;
    return;
  }
  el.innerHTML='';
  list.forEach(r => {
    const div=document.createElement('div');
    div.className='recipe-card';
    const grainStr=r.grains.map(g=>`${esc(g.name)} ${g.g}g`).join(' · ');
    const memoHtml=r.memo?`<div class="rc-memo">✏️ ${esc(r.memo)}</div>`:'';
    div.innerHTML=`
      <div class="rc-header">
        <span class="rc-name">🍚 ${esc(r.name)}</span>
        <div class="rc-top-right">
          <span class="rc-badge">${r.n}배죽</span>
          <button class="rc-edit" onclick="event.stopPropagation(); openEditModal('${r.id}')">✏️</button>
          <button class="rc-del"  onclick="event.stopPropagation(); deleteRecipe('${r.id}')">🗑️</button>
        </div>
      </div>
      <div class="rc-grains">🌾 ${grainStr}</div>
      <div class="rc-calc">
        <span class="rc-pill">🍽️ ${r.meals}끼 × ${r.days}일</span>
        <span class="rc-pill">🌾 잡곡 ${r.grain_total_all}g</span>
        <span class="rc-pill">💧 물 ${r.water_all}g</span>
        <span class="rc-pill">🍲 1회 약 ${r.porridge1}g</span>
      </div>
      ${memoHtml}
      <div class="rc-date">📅 ${r.created_at}</div>
      <div class="rc-load-hint">탭하면 이 레시피로 불러오기 →</div>
    `;
    div.addEventListener('click',()=>window.loadRecipe(r));
    el.appendChild(div);
  });
}

// ── Edit modal ─────────────────────────────────────────────────────────────
let editRecipe=null, editGrains=[];

window.openEditModal = async (id) => {
  const {data}=await sb.from('recipes').select('*').eq('id',id).single();
  if (!data) return;
  editRecipe=data;
  editGrains=JSON.parse(JSON.stringify(data.grains));
  $('edit-name').value=data.name;
  $('edit-memo').value=data.memo||'';
  $('edit-n').value=data.n;
  $('edit-meals').value=data.meals;
  $('edit-days').value=data.days;
  renderEditGrains();
  $('edit-modal').classList.add('open');
};

window.closeEditModal = () => {
  $('edit-modal').classList.remove('open');
  editRecipe=null; editGrains=[];
};

function renderEditGrains() {
  const list=$('edit-grain-list');
  list.innerHTML='';
  editGrains.forEach((g,i) => {
    const div=document.createElement('div');
    div.className='grain-item';
    div.innerHTML=`
      <input type="text" value="${esc(g.name)}" placeholder="잡곡 이름"
             oninput="editGrains[${i}].name=this.value" />
      <div class="grain-g-wrap">
        <button class="grain-stepper" onclick="stepEditGrain(${i},-1)">−</button>
        <input type="number" value="${g.g}" min="0" step="1" id="edit-grain-input-${i}"
               oninput="editGrains[${i}].g=+this.value" />
        <span class="grain-g-label">g</span>
        <button class="grain-stepper" onclick="stepEditGrain(${i},1)">+</button>
      </div>
      <button class="del-btn" onclick="removeEditGrain(${i})">🗑️</button>
    `;
    list.appendChild(div);
  });
}

window.stepEditGrain=(i,delta)=>{
  editGrains[i].g=Math.max(0,(editGrains[i].g||0)+delta);
  const inp=$('edit-grain-input-'+i);
  if(inp) inp.value=editGrains[i].g;
};
window.removeEditGrain=(i)=>{editGrains.splice(i,1);renderEditGrains();};
window.addEditGrain=()=>{editGrains.push({name:'새 잡곡',g:1});renderEditGrains();};

window.saveEditRecipe = async () => {
  if (!editRecipe) return;
  const name=$('edit-name').value.trim();
  if (!name) {
    $('edit-name').style.borderColor='#FF8C69';
    setTimeout(()=>$('edit-name').style.borderColor='',1500);
    return;
  }
  const btn=$('edit-save-btn');
  btn.disabled=true; btn.textContent='저장 중... 🌀';

  const n=+$('edit-n').value||10, meals=+$('edit-meals').value||1, days=+$('edit-days').value||1;
  const totalMeals=meals*days;
  const grainTotal=editGrains.reduce((s,g)=>s+(g.g||0),0);
  const water1=grainTotal*n;

  try {
    await sb.from('recipes').update({
      name, memo:$('edit-memo').value.trim(),
      n, meals, days,
      grains:         JSON.parse(JSON.stringify(editGrains)),
      porridge1:      (grainTotal+water1).toFixed(0),
      grain_total_all:(grainTotal*totalMeals).toFixed(0),
      water_all:      (water1*totalMeals).toFixed(0),
      updated_at:     new Date().toLocaleDateString('ko-KR'),
    }).eq('id',editRecipe.id);
    syncStatus('ok','레시피 수정 완료 ✓');
    closeEditModal();
    loadRecipesList();
  } catch(e) {
    syncStatus('err','수정 실패');
    alert('수정 실패: '+e.message);
  }
  btn.disabled=false; btn.textContent='✅ 수정 저장하기';
};

$('edit-modal').addEventListener('click',(e)=>{
  if(e.target===$('edit-modal')) closeEditModal();
});

// ── Utility ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Boot ───────────────────────────────────────────────────────────────────
loadSettings();
loadRecipesList();
