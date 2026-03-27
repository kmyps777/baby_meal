import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, doc, setDoc, deleteDoc,
  collection, onSnapshot, getDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Firebase ───────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDCctDeWhfVRWQ7Ju4keBxA-KGho_BqVCk",
  authDomain:        "baby-meal-4cecc.firebaseapp.com",
  projectId:         "baby-meal-4cecc",
  storageBucket:     "baby-meal-4cecc.firebasestorage.app",
  messagingSenderId: "747705591680",
  appId:             "1:747705591680:web:9bd314a3ab8e82d4c34365",
};
const fbApp    = initializeApp(firebaseConfig);
const db       = getFirestore(fbApp);
const auth     = getAuth(fbApp);
const provider = new GoogleAuthProvider();

// ── 사용자별 Firestore 경로 ────────────────────────────────────────────────
let currentUser  = null;
let unsubRecipes = null;

const settingsRef = () => doc(db, 'users', currentUser.uid, 'settings', 'porridge_settings');
const recipesCol  = () => collection(db, 'users', currentUser.uid, 'recipes');
const recipeDoc   = (id) => doc(db, 'users', currentUser.uid, 'recipes', id);

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
let fbReady        = false;

// ── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const num = id => +$(id).value || 0;

// ── Sync status ────────────────────────────────────────────────────────────
function syncStatus(state, msg) {
  $('sync-dot').className     = 'sync-dot ' + state;
  $('sync-label').textContent = msg;
}

// ── Auth state ─────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    showApp(true);
    renderUserInfo(user);
    syncStatus('loading', '불러오는 중...');
    grains = JSON.parse(JSON.stringify(DEFAULT_GRAINS));
    await loadSettings();
    subscribeRecipes();
  } else {
    currentUser = null;
    fbReady     = false;
    if (unsubRecipes) { unsubRecipes(); unsubRecipes = null; }
    showApp(false);
  }
});

function showApp(yes) {
  $('app-main').style.display    = yes ? '' : 'none';
  $('login-screen').style.display = yes ? 'none' : 'flex';
}

function renderUserInfo(user) {
  $('user-info').innerHTML = `
    <img src="${user.photoURL}" class="user-avatar" alt="" />
    <span class="user-name">${user.displayName.split(' ')[0]}</span>
    <button class="logout-btn" onclick="signOut(auth)">로그아웃</button>
  `;
}

// 로그인 버튼
$('login-btn').addEventListener('click', () =>
  signInWithPopup(auth, provider).catch(e => alert('로그인 실패: ' + e.message))
);

// window에 signOut 노출 (인라인 onclick용)
window.auth = auth;
window.signOut = signOut;

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
  el.value = Math.min(max, Math.max(min, (+el.value || 0) + delta));
};

// ── Load settings ──────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(settingsRef());
    if (snap.exists()) {
      const d = snap.data();
      if (d.grains) grains = d.grains;
      if (d.n)      $('n-mult').value        = d.n;
      if (d.meals)  $('meals-per-day').value = d.meals;
      if (d.days)   $('days').value          = d.days;
    }
    syncStatus('ok', '동기화됨 ✓');
    fbReady = true;
  } catch (e) {
    syncStatus('err', '연결 실패');
    console.error(e);
  }
  renderGrains();
  calc();
}

// ── Save settings (debounced) ──────────────────────────────────────────────
function scheduleSettingsSave() {
  clearTimeout(saveSettingsTm);
  saveSettingsTm = setTimeout(async () => {
    if (!fbReady || !currentUser) return;
    try {
      await setDoc(settingsRef(), {
        grains,
        n:     num('n-mult'),
        meals: num('meals-per-day'),
        days:  num('days'),
        updatedAt: new Date().toISOString(),
      });
      syncStatus('ok', '저장됨 ✓');
    } catch (e) {
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

window.updateGrain = (i, key, val) => { grains[i][key] = val; calc(); scheduleSettingsSave(); };

window.stepGrain = (i, delta) => {
  grains[i].g = Math.max(0, (grains[i].g || 0) + delta);
  const inp = $('grain-input-' + i);
  if (inp) inp.value = grains[i].g;
  calc(); scheduleSettingsSave();
};

window.removeGrain = (i) => { grains.splice(i, 1); renderGrains(); calc(); scheduleSettingsSave(); };

$('add-grain-btn').addEventListener('click', () => {
  grains.push({ name: '새 잡곡', g: 1 });
  renderGrains(); calc(); scheduleSettingsSave();
});

['n-mult','meals-per-day','days'].forEach(id => $(id).addEventListener('input', calc));

// ── Calculation ────────────────────────────────────────────────────────────
function calc() {
  const n          = num('n-mult')        || 10;
  const meals      = num('meals-per-day') || 1;
  const days       = num('days')          || 1;
  const totalMeals = meals * days;

  $('total-meals-display').textContent = totalMeals;

  const grainTotal1 = grains.reduce((s, g) => s + (g.g || 0), 0);
  const water1      = grainTotal1 * n;
  const porridge1   = grainTotal1 + water1;

  const ingList = $('ingredient-list');
  ingList.innerHTML = '';
  grains.forEach((g) => {
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = `
      <div class="ing-info">
        <div class="ing-name">${esc(g.name)}</div>
        <div class="ing-detail">1회 ${g.g}g × ${totalMeals}끼</div>
      </div>
      <div class="ing-amount">${((g.g||0)*totalMeals).toFixed(0)}g</div>
    `;
    ingList.appendChild(row);
  });

  const waterRow = document.createElement('div');
  waterRow.className = 'ingredient-row water-row';
  waterRow.innerHTML = `
    <div class="ing-info">
      <div class="ing-name">💧 물</div>
      <div class="ing-detail">1회 ${water1.toFixed(0)}g × ${totalMeals}끼 (${n}배죽)</div>
    </div>
    <div class="ing-amount">${(water1*totalMeals).toFixed(0)}g</div>
  `;
  ingList.appendChild(waterRow);

  $('r-grain-total').textContent = (grainTotal1*totalMeals).toFixed(0) + 'g';
  $('r-water-total').textContent = (water1*totalMeals).toFixed(0) + 'g';
  $('r-grand-total').textContent = (porridge1*totalMeals).toFixed(0) + 'g';
  $('porridge-hint').textContent =
    `🍲 1회 베이스죽 재료량 약 ${porridge1.toFixed(0)}g · 밥솥 조리 후 실제 완성량은 약간 줄어들어요`;

  scheduleSettingsSave();
}

// ── Save recipe ────────────────────────────────────────────────────────────
$('save-btn').addEventListener('click', async () => {
  if (!currentUser) return;
  const name = $('recipe-name').value.trim();
  if (!name) {
    $('recipe-name').style.borderColor = '#FF8C69';
    setTimeout(() => $('recipe-name').style.borderColor = '', 1500);
    return;
  }
  const btn = $('save-btn');
  btn.disabled = true; btn.textContent = '저장 중... 🌀';

  const n=num('n-mult')||10, meals=num('meals-per-day')||1, days=num('days')||1;
  const totalMeals=meals*days;
  const grainTotal=grains.reduce((s,g)=>s+(g.g||0),0);
  const water1=grainTotal*n;
  const id = 'r_' + Date.now();

  try {
    await setDoc(recipeDoc(id), {
      id, name, n, meals, days,
      memo:          $('recipe-memo').value.trim(),
      grains:        JSON.parse(JSON.stringify(grains)),
      porridge1:     (grainTotal+water1).toFixed(0),
      grainTotalAll: (grainTotal*totalMeals).toFixed(0),
      waterAll:      (water1*totalMeals).toFixed(0),
      createdAt:     new Date().toLocaleDateString('ko-KR'),
      createdTs:     Date.now(),
    });
    $('recipe-name').value = '';
    $('recipe-memo').value = '';
    syncStatus('ok', '레시피 저장 완료 🌟');
    window.switchTab('recipes');
  } catch(e) { syncStatus('err','저장 실패'); alert('저장 실패: '+e.message); }

  btn.disabled=false; btn.textContent='🌟 레시피 저장하기';
});

// ── Delete recipe ──────────────────────────────────────────────────────────
window.deleteRecipe = async (id) => {
  if (!currentUser || !confirm('이 레시피를 삭제할까요?')) return;
  try { await deleteDoc(recipeDoc(id)); syncStatus('ok','레시피 삭제됨'); }
  catch(e) { syncStatus('err','삭제 실패'); }
};

// ── Load recipe into form ──────────────────────────────────────────────────
window.loadRecipe = (r) => {
  grains = JSON.parse(JSON.stringify(r.grains));
  $('n-mult').value = r.n;
  $('meals-per-day').value = r.meals;
  $('days').value = r.days;
  renderGrains(); calc();
  syncStatus('ok', `"${r.name}" 불러옴 ✓`);
  window.switchTab('calc');
  window.scrollTo({ top:0, behavior:'smooth' });
};

// ── Real-time recipes ──────────────────────────────────────────────────────
function subscribeRecipes() {
  if (unsubRecipes) unsubRecipes();
  unsubRecipes = onSnapshot(recipesCol(), (snap) => {
    renderRecipes(snap.docs.map(d => d.data()));
  }, () => {
    $('recipes-list').innerHTML =
      '<div class="empty-state"><div class="empty-icon">⚠️</div><div>읽기 실패. 보안 규칙을 확인해주세요.</div></div>';
  });
}

// ── Render recipe list ─────────────────────────────────────────────────────
function renderRecipes(list) {
  const badge = $('recipe-badge');
  badge.style.display = list.length ? 'inline-flex' : 'none';
  if (list.length) badge.textContent = list.length;

  const el = $('recipes-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🥣</div><div>저장된 레시피가 없어요<br>계산 탭에서 저장해보세요!</div></div>`;
    return;
  }
  el.innerHTML = '';
  [...list].sort((a,b)=>(b.createdTs||0)-(a.createdTs||0)).forEach(r => {
    const div = document.createElement('div');
    div.className = 'recipe-card';
    const grainStr = r.grains.map(g=>`${esc(g.name)} ${g.g}g`).join(' · ');
    const memoHtml = r.memo ? `<div class="rc-memo">✏️ ${esc(r.memo)}</div>` : '';
    div.innerHTML = `
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
        <span class="rc-pill">🌾 잡곡 ${r.grainTotalAll}g</span>
        <span class="rc-pill">💧 물 ${r.waterAll}g</span>
        <span class="rc-pill">🍲 1회 약 ${r.porridge1}g</span>
      </div>
      ${memoHtml}
      <div class="rc-date">📅 ${r.createdAt}</div>
      <div class="rc-load-hint">탭하면 이 레시피로 불러오기 →</div>
    `;
    div.addEventListener('click', () => window.loadRecipe(r));
    el.appendChild(div);
  });
}

// ── Edit modal ─────────────────────────────────────────────────────────────
let editRecipe = null;
let editGrains = [];

window.openEditModal = async (id) => {
  if (!currentUser) return;
  const snap = await getDoc(recipeDoc(id));
  if (!snap.exists()) return;
  editRecipe = snap.data();
  editGrains = JSON.parse(JSON.stringify(editRecipe.grains));
  $('edit-name').value  = editRecipe.name;
  $('edit-memo').value  = editRecipe.memo || '';
  $('edit-n').value     = editRecipe.n;
  $('edit-meals').value = editRecipe.meals;
  $('edit-days').value  = editRecipe.days;
  renderEditGrains();
  $('edit-modal').classList.add('open');
};

window.closeEditModal = () => {
  $('edit-modal').classList.remove('open');
  editRecipe = null; editGrains = [];
};

function renderEditGrains() {
  const list = $('edit-grain-list');
  list.innerHTML = '';
  editGrains.forEach((g, i) => {
    const div = document.createElement('div');
    div.className = 'grain-item';
    div.innerHTML = `
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

window.stepEditGrain = (i, delta) => {
  editGrains[i].g = Math.max(0, (editGrains[i].g||0) + delta);
  const inp = $('edit-grain-input-'+i);
  if (inp) inp.value = editGrains[i].g;
};

window.removeEditGrain = (i) => { editGrains.splice(i,1); renderEditGrains(); };
window.addEditGrain    = ()    => { editGrains.push({name:'새 잡곡',g:1}); renderEditGrains(); };

window.saveEditRecipe = async () => {
  if (!currentUser || !editRecipe) return;
  const name = $('edit-name').value.trim();
  if (!name) {
    $('edit-name').style.borderColor = '#FF8C69';
    setTimeout(() => $('edit-name').style.borderColor = '', 1500);
    return;
  }
  const btn = $('edit-save-btn');
  btn.disabled=true; btn.textContent='저장 중... 🌀';

  const n=+$('edit-n').value||10, meals=+$('edit-meals').value||1, days=+$('edit-days').value||1;
  const totalMeals=meals*days;
  const grainTotal=editGrains.reduce((s,g)=>s+(g.g||0),0);
  const water1=grainTotal*n;

  try {
    await setDoc(recipeDoc(editRecipe.id), {
      ...editRecipe, name,
      memo:          $('edit-memo').value.trim(),
      n, meals, days,
      grains:        JSON.parse(JSON.stringify(editGrains)),
      porridge1:     (grainTotal+water1).toFixed(0),
      grainTotalAll: (grainTotal*totalMeals).toFixed(0),
      waterAll:      (water1*totalMeals).toFixed(0),
      updatedAt:     new Date().toLocaleDateString('ko-KR'),
    });
    syncStatus('ok','레시피 수정 완료 ✓');
    closeEditModal();
  } catch(e) { syncStatus('err','수정 실패'); alert('수정 실패: '+e.message); }

  btn.disabled=false; btn.textContent='✅ 수정 저장하기';
};

$('edit-modal').addEventListener('click', (e) => {
  if (e.target === $('edit-modal')) closeEditModal();
});

// ── Utility ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Boot ───────────────────────────────────────────────────────────────────
loadSettings();
