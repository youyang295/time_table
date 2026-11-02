/* =========================================================
   课表 App 的逻辑
   一般不需要改这里；要改课表请编辑 data.js
   ========================================================= */

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/* ---------------- 小工具 ---------------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 把 Date 的 getDay 转成 1=周一 … 7=周日 */
function isoDay(date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

/** 当前是第几周；没有设置学期起始日则返回 null */
function currentWeek(date = new Date()) {
  if (!SEMESTER_START) return null;
  const start = new Date(SEMESTER_START + 'T00:00:00');
  const diffDays = Math.round((startOfDay(date) - start) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

function periodByNo(no) {
  return PERIODS.find((p) => p.no === no);
}

/** 某节课的上下课时间，例如 { start: '08:00', end: '09:40' } */
function courseTimes(c) {
  const a = periodByNo(c.start);
  const b = periodByNo(c.end);
  return { start: a ? a.start : '--:--', end: b ? b.end : '--:--' };
}

/** 把 '4,7-10,12-18' 这种周次字符串展开成 Set；没写周次返回 null */
function weekSet(spec) {
  if (spec == null || spec === '') return null;
  const set = new Set();
  String(spec)
    .replace(/周/g, '')
    .split(/[,，、]/)
    .forEach((part) => {
      const t = part.trim();
      if (!t) return;
      const m = t.match(/^(\d+)\s*[-~]\s*(\d+)$/);
      if (m) {
        for (let i = Number(m[1]); i <= Number(m[2]); i++) set.add(i);
      } else if (/^\d+$/.test(t)) {
        set.add(Number(t));
      }
    });
  return set;
}

function inWeek(c, week) {
  if (!c.weeks || week == null) return true;
  const set = weekSet(c.weeks);
  return set ? set.has(week) : true;
}

function coursesOn(day, week) {
  return COURSES
    .filter((c) => c.day === day && inWeek(c, week))
    .sort((x, y) => x.start - y.start);
}

/** 每门课一个固定颜色：按课程代码排序，把色相均匀铺满一圈，
    再交替深浅两档，让相邻色相也一眼分得开。
    同一门课的多次课（比如高数周一二三）拿到的是同一个颜色。 */
const COURSE_HUE = (() => {
  const keys = [...new Set(COURSES.map((c) => c.code || c.name))].sort();
  const step = 360 / Math.max(keys.length, 1);
  return new Map(keys.map((k, i) => [k, { h: Math.round(i * step), l: i % 2 }]));
})();

/** 内联样式片段：把色相和深浅交给 CSS */
function courseHue(c) {
  const v = COURSE_HUE.get(c.code || c.name) || { h: 220, l: 0 };
  return `--h:${v.h};--l:${v.l ? '88%' : '93%'};--ld:${v.l ? '15%' : '20%'}`;
}

/* ---------------- 渲染：顶部 ---------------- */

function renderHeader(now = new Date()) {
  const label = document.getElementById('date-label');
  label.textContent =
    `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${DAY_NAMES[isoDay(now)]}`;

  const badge = document.getElementById('week-badge');
  const week = currentWeek(now);
  if (week == null) {
    badge.textContent = '';
    badge.hidden = true;
  } else {
    badge.hidden = false;
    badge.textContent = week < 1 ? '未开学' : `第 ${week} 周`;
  }
}

/* ---------------- 渲染：今天 ---------------- */

function courseCard(c, nowMin) {
  const { start, end } = courseTimes(c);
  const s = toMinutes(start);
  const e = toMinutes(end);

  let key = 'future';
  let label = '还没开始';
  if (nowMin >= e) {
    key = 'past';
    label = '已结束';
  } else if (nowMin >= s) {
    key = 'now';
    label = `还剩 ${e - nowMin} 分钟`;
  }

  const periods = c.start === c.end ? `第 ${c.start} 节` : `第 ${c.start}–${c.end} 节`;

  return `
    <article class="course ${key}" style="${courseHue(c)}">
      <div class="course-time">
        <span class="ct-main">${start}</span>
        <span class="ct-sep">–</span>
        <span class="ct-main">${end}</span>
        <span class="ct-periods">${periods}</span>
      </div>
      <div class="course-body">
        <h3>${esc(c.name)}</h3>
        <p class="meta">${esc(c.room || '')}${c.teacher ? ' · ' + esc(c.teacher) : ''}</p>
      </div>
      <span class="course-flag">${label}</span>
    </article>`;
}

function heroBlock(current, next, nowMin) {
  if (current) {
    const { c, s, e } = current;
    const pct = Math.min(100, Math.max(0, ((nowMin - s) / (e - s)) * 100));
    const t = courseTimes(c);
    return `
      <section class="hero now">
        <p class="hero-kicker">正在上课</p>
        <h2>${esc(c.name)}</h2>
        <p class="hero-meta">${esc(c.room || '')} · ${t.start}–${t.end}</p>
        <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <p class="hero-foot">还剩 ${e - nowMin} 分钟</p>
      </section>`;
  }
  if (next) {
    const { c, s } = next;
    const t = courseTimes(c);
    return `
      <section class="hero next">
        <p class="hero-kicker">接下来</p>
        <h2>${esc(c.name)}</h2>
        <p class="hero-meta">${esc(c.room || '')} · ${t.start} 开始</p>
        <p class="hero-foot">还有 ${s - nowMin} 分钟</p>
      </section>`;
  }
  return `
    <section class="hero done">
      <p class="hero-kicker">今天的课</p>
      <h2>都上完了</h2>
      <p class="hero-foot">收拾一下，回去休息吧</p>
    </section>`;
}

function renderToday(now = new Date()) {
  const view = document.getElementById('view-today');
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const week = currentWeek(now);
  const list = coursesOn(isoDay(now), week);

  if (!list.length) {
    const weekend = isoDay(now) >= 6;
    view.innerHTML = `
      <div class="empty">
        <div class="empty-emoji">${weekend ? '🌤️' : '🍃'}</div>
        <h2>${weekend ? '周末没有课' : '今天没有课'}</h2>
        <p>看看「本周」有没有要提前准备的。</p>
      </div>`;
    return;
  }

  let current = null;
  let next = null;
  for (const c of list) {
    const { start, end } = courseTimes(c);
    const s = toMinutes(start);
    const e = toMinutes(end);
    if (nowMin >= s && nowMin < e) {
      current = { c, s, e };
      break;
    }
    if (nowMin < s) {
      next = { c, s, e };
      break;
    }
  }

  view.innerHTML =
    heroBlock(current, next, nowMin) +
    `<div class="list">${list.map((c) => courseCard(c, nowMin)).join('')}</div>`;
}

/* ---------------- 渲染：本周 ---------------- */

function renderWeek(now = new Date()) {
  const view = document.getElementById('view-week');
  const week = currentWeek(now);
  const today = isoDay(now);
  // 默认只显示周一到周五；课表里一旦有周末的课，自动补上周六周日
  const days = [1, 2, 3, 4, 5];
  if (COURSES.some((c) => c.day >= 6)) days.push(6, 7);

  let html = `<div class="week-scroll"><div class="week-grid" style="--days:${days.length}">`;

  html += '<div class="wg-corner"></div>';
  days.forEach((d) => {
    html += `<div class="wg-head ${d === today ? 'is-today' : ''}">${DAY_NAMES[d].slice(1)}</div>`;
  });

  // 先铺满背景格子（虚线网格），再叠课程块
  PERIODS.forEach((p, i) => {
    html += `<div class="wg-time" style="grid-column:1;grid-row:${i + 2}">${p.no}</div>`;
    days.forEach((d, j) => {
      html += `<div class="wg-cell ${d === today ? 'is-today' : ''}" style="grid-column:${j + 2};grid-row:${i + 2}"></div>`;
    });
  });

  days.forEach((d, j) => {
    coursesOn(d, week).forEach((c) => {
      const t = courseTimes(c);
      html += `
        <div class="wg-course" style="grid-column:${j + 2};grid-row:${c.start + 1}/${c.end + 2};${courseHue(c)}">
          <b>${esc(c.name)}</b>
          <span>${esc(c.room || '')}</span>
          <em>${t.start}</em>
        </div>`;
    });
  });

  html += '</div></div>';
  view.innerHTML = html;
}

/* ---------------- 交互 ---------------- */

function activeViewName() {
  const t = document.querySelector('.tab.active');
  return t ? t.dataset.view : 'today';
}

function renderActive(now = new Date()) {
  renderHeader(now);
  if (activeViewName() === 'week') renderWeek(now);
  else renderToday(now);
}

function showView(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'week') renderWeek();
  else renderToday();
  window.scrollTo(0, 0);
}

function boot() {
  renderHeader();
  renderToday();
  renderWeek();

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.view;
      showView(name);
      if (name === 'week') history.replaceState(null, '', '#week');
      else history.replaceState(null, '', location.pathname + location.search);
    });
  });

  // 网址后面加 #week 直接打开本周视图
  if (location.hash === '#week') showView('week');

  // 每分钟刷新一次：跨节、跨天都能自动更新
  setInterval(() => {
    const y = window.scrollY;
    renderActive();
    window.scrollTo(0, y);
  }, 60000);

  // 从后台切回前台时立刻刷新
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderActive();
  });

  // 注册 Service Worker（离线可用需要它；本地 file:// 打开时会静默失败，不影响使用）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
