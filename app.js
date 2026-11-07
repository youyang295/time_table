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

/* ---------------- 考试 ---------------- */

/** data.js 里没写 EXAMS 也不会报错 */
function allExams() {
  return typeof EXAMS === 'undefined' ? [] : EXAMS;
}

function examsOn(day, week) {
  return allExams()
    .filter((x) => x.day === day && inWeek(x, week))
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/** 这场考试压在哪几节上，用来在本周网格里摆位置 */
function examSpan(x) {
  const s = toMinutes(x.start);
  const e = toMinutes(x.end);
  let first = null;
  let last = null;
  PERIODS.forEach((p) => {
    if (toMinutes(p.end) > s && toMinutes(p.start) < e) {
      if (first == null) first = p.no;
      last = p.no;
    }
  });
  return first == null ? null : { start: first, end: last };
}

/** 往后 21 天里最近的一场考试 */
function nextExam(now = new Date()) {
  const base = startOfDay(now).getTime();
  for (let i = 0; i <= 21; i++) {
    const d = new Date(base + i * 86400000);
    const list = examsOn(isoDay(d), currentWeek(d));
    if (list.length) return { days: i, date: d, exam: list[0] };
  }
  return null;
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

function examCard(it, nowMin) {
  const s = it.s;
  const e = it.e;
  let key = 'future';
  let label = '待考';
  if (nowMin >= e) {
    key = 'past';
    label = '已考完';
  } else if (nowMin >= s) {
    key = 'now';
    label = `还剩 ${e - nowMin} 分钟`;
  } else {
    const d = s - nowMin;
    label = d >= 120 ? `${Math.floor(d / 60)} 小时后` : `${d} 分钟后`;
  }

  return `
    <article class="course exam ${key}">
      <div class="course-time">
        <span class="ct-main">${it.start}</span>
        <span class="ct-sep">–</span>
        <span class="ct-main">${it.end}</span>
        <span class="ct-periods">考试</span>
      </div>
      <div class="course-body">
        <h3><i class="tag-exam">考试</i>${esc(it.name)}</h3>
        <p class="meta">${esc(it.room || '考场待定')}</p>
      </div>
      <span class="course-flag">${label}</span>
    </article>`;
}

function heroBlock(current, next, nowMin) {
  if (current) {
    const { item, s, e } = current;
    const pct = Math.min(100, Math.max(0, ((nowMin - s) / (e - s)) * 100));
    const isExam = item.kind === 'exam';
    return `
      <section class="hero ${isExam ? 'exam-now' : 'now'}">
        <p class="hero-kicker">${isExam ? '正在考试' : '正在上课'}</p>
        <h2>${esc(item.name)}</h2>
        <p class="hero-meta">${esc(item.room || '')} · ${item.start}–${item.end}</p>
        <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <p class="hero-foot">还剩 ${e - nowMin} 分钟${isExam ? '，稳住' : ''}</p>
      </section>`;
  }
  if (next) {
    const { item, s } = next;
    const isExam = item.kind === 'exam';
    return `
      <section class="hero ${isExam ? 'exam-next' : 'next'}">
        <p class="hero-kicker">${isExam ? '接下来 · 考试' : '接下来'}</p>
        <h2>${esc(item.name)}</h2>
        <p class="hero-meta">${esc(item.room || '')} · ${item.start} ${isExam ? '开考' : '开始'}</p>
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

/** 今天页底部那句小话：按明天的情况挑一句，同一天固定，不会闪 */
function todayNote(now) {
  const tomorrow = new Date(startOfDay(now).getTime() + 86400000);
  const tw = currentWeek(tomorrow);
  const tCourses = coursesOn(isoDay(tomorrow), tw).length;
  const tExams = examsOn(isoDay(tomorrow), tw).length;

  if (tExams) return `明天有 ${tExams} 场考试，今天早点睡。`;
  if (tCourses >= 4) return `明天 ${tCourses} 节课，是满的一天。`;
  if (tCourses > 0) return `明天 ${tCourses} 节课，节奏还行。`;
  return '明天没课，可以安排点自己的事。';
}

function renderToday(now = new Date()) {
  const view = document.getElementById('view-today');
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const week = currentWeek(now);
  const day = isoDay(now);

  /* 课和考试排在同一条时间线上 */
  const items = [
    ...coursesOn(day, week).map((c) => {
      const t = courseTimes(c);
      return {
        kind: 'course', data: c, name: c.name, room: c.room,
        start: t.start, end: t.end, s: toMinutes(t.start), e: toMinutes(t.end),
      };
    }),
    ...examsOn(day, week).map((x) => ({
      kind: 'exam', data: x, name: x.name, room: x.room,
      start: x.start, end: x.end, s: toMinutes(x.start), e: toMinutes(x.end),
    })),
  ].sort((a, b) => a.s - b.s);

  if (!items.length) {
    const weekend = day >= 6;
    const nxt = nextExam(now);
    const hint = nxt && nxt.days > 0
      ? `<p class="empty-hint">最近一场：${esc(nxt.exam.name)} · ${nxt.days === 1 ? '明天' : '还有 ' + nxt.days + ' 天'}</p>`
      : '';
    view.innerHTML = `
      <div class="empty">
        <div class="empty-emoji">${weekend ? '🌤️' : '🍃'}</div>
        <h2>${weekend ? '周末没有课' : '今天没有课'}</h2>
        <p>${weekend ? '睡到自然醒吧。' : '空着的一天，也挺好。'}</p>
        ${hint}
      </div>`;
    return;
  }

  let current = null;
  let next = null;
  for (const item of items) {
    if (nowMin >= item.s && nowMin < item.e) {
      current = { item, s: item.s, e: item.e };
      break;
    }
    if (nowMin < item.s) {
      next = { item, s: item.s, e: item.e };
      break;
    }
  }

  const cards = items
    .map((it) => (it.kind === 'exam' ? examCard(it, nowMin) : courseCard(it.data, nowMin)))
    .join('');

  view.innerHTML =
    heroBlock(current, next, nowMin) +
    `<div class="list">${cards}</div>` +
    `<p class="day-note">${esc(todayNote(now))}</p>`;
}

/* ---------------- 渲染：本周 ---------------- */

/** 某一天已经被课和考试占掉的节次 */
function dayOccupied(d, week) {
  const set = new Set();
  coursesOn(d, week).forEach((c) => {
    for (let p = c.start; p <= c.end; p++) set.add(p);
  });
  examsOn(d, week).forEach((x) => {
    const sp = examSpan(x);
    if (sp) for (let p = sp.start; p <= sp.end; p++) set.add(p);
  });
  return set;
}

function renderWeek(now = new Date()) {
  const view = document.getElementById('view-week');
  const week = currentWeek(now);
  const today = isoDay(now);
  // 默认只显示周一到周五；课表里一旦有周末的课或考试，自动补上周六周日
  const days = [1, 2, 3, 4, 5];
  if (COURSES.some((c) => c.day >= 6) || allExams().some((x) => x.day >= 6)) days.push(6, 7);

  const courseCount = days.reduce((n, d) => n + coursesOn(d, week).length, 0);
  const examCount = days.reduce((n, d) => n + examsOn(d, week).length, 0);

  let html = `<p class="week-summary">第 ${week == null ? '—' : week} 周 · ${courseCount} 节课${
    examCount ? ` · ${examCount} 场考试` : ''
  }</p>`;
  html += `<div class="week-scroll"><div class="week-grid" style="--days:${days.length}">`;

  html += '<div class="wg-corner"></div>';
  days.forEach((d) => {
    const hasExam = examsOn(d, week).length > 0;
    html += `<div class="wg-head ${d === today ? 'is-today' : ''}">${DAY_NAMES[d].slice(1)}${
      hasExam ? '<i class="exam-dot" title="这天有考试"></i>' : ''
    }</div>`;
  });

  // 先铺满背景格子（虚线网格），再叠空闲标记、课程块、考试块
  PERIODS.forEach((p, i) => {
    html += `<div class="wg-time" style="grid-column:1;grid-row:${i + 2}">${p.no}</div>`;
    days.forEach((d, j) => {
      html += `<div class="wg-cell ${d === today ? 'is-today' : ''}" style="grid-column:${j + 2};grid-row:${i + 2}"></div>`;
    });
  });

  // 大块空白里放一个很淡的「空闲」，只放每天最长的那一段，让留白看起来是故意的
  days.forEach((d, j) => {
    const occ = dayOccupied(d, week);
    const runs = [];
    let runStart = null;
    PERIODS.forEach((p, i) => {
      const busy = occ.has(p.no);
      if (!busy && runStart == null) runStart = p.no;
      if (busy && runStart != null) {
        runs.push([runStart, p.no - 1]);
        runStart = null;
      }
      if (i === PERIODS.length - 1 && runStart != null) runs.push([runStart, p.no]);
    });
    let best = null;
    runs.forEach((r) => {
      if (!best || r[1] - r[0] > best[1] - best[0]) best = r;
    });
    if (best && best[1] - best[0] + 1 >= 3) {
      html += `<div class="wg-idle" style="grid-column:${j + 2};grid-row:${best[0] + 1}/${best[1] + 2}">空闲</div>`;
    }
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
    examsOn(d, week).forEach((x) => {
      const sp = examSpan(x);
      if (!sp) return;
      html += `
        <div class="wg-exam" style="grid-column:${j + 2};grid-row:${sp.start + 1}/${sp.end + 2}">
          <b>考试 · ${esc(x.name)}</b>
          <span>${x.start}–${x.end}</span>
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
