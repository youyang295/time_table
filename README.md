# 我的课表

一个只给自己用的课表 PWA。手机上「添加到主屏幕」后，点开就是全屏课表，不用装安装包，断网也能看。

## 目录结构

```
timetable-app/
├─ index.html      页面骨架
├─ style.css       样式
├─ app.js          逻辑（一般不用动）
├─ data.js         ← 要改课表就改这个
├─ manifest.json   让手机把它当成 App 的配置
├─ sw.js           离线缓存
└─ icons/          桌面图标
```

## 本地预览

在项目目录里起一个本地服务器（不能直接双击 `index.html`，否则 Service Worker 不生效）：

```powershell
cd D:\杂活\timetable-app
& "C:\Users\16230\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" -m http.server 8765
```

然后浏览器打开 <http://127.0.0.1:8765>。

## 改课表

打开 `data.js`，只有三处要关心：

1. **`PERIODS`** —— 你们学校每节课的起止时间，按实际改。
2. **`SEMESTER_START`** —— 学期第一周的周一，用来算「第几周」。
3. **`COURSES`** —— 课程列表。每门课一行：

```js
{ day: 2, start: 3, end: 4, name: '高等数学A1上', code: 'XK01001', teacher: '黄冬明', room: '2-207', weeks: '4-5,7-10,12-18' },
```

- `day`：1=周一 … 7=周日
- `start` / `end`：第几节课；单节课两者写一样
- `weeks`：周次**字符串**，照抄教务系统的写法即可，例如 `'7-10'`、`'4,7-10,12-18'`；不写就是每周都上
- `code`：课程代码，只作参考，界面上不显示

> 这份数据是从教务系统截图逐条录的（2026-2027-1 学期，海甸校区），周次按学期通用，程序会按当前周自动过滤。抄错了直接改 `data.js` 就行。

改完保存，手机上刷新页面即可。

## 部署到手机

PWA 的「全屏」需要 HTTPS（`http://` 的局域网地址只能得到普通书签，不会全屏）。最省事的免费方案是 GitHub Pages：

1. 注册 <https://github.com>（免费）。
2. 右上角 **+ → New repository**，名字随意（例如 `timetable`），选 **Public**，创建。
3. **Add file → Upload files**，把本目录里的 `index.html`、`style.css`、`app.js`、`data.js`、`manifest.json`、`sw.js` 和整个 `icons` 文件夹拖进去（**文件要放在仓库根目录，不要套一层文件夹**），提交。
4. 进仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 `main` + `/ (root)`，Save。
5. 等 1 分钟左右，访问 `https://你的用户名.github.io/timetable/`。

备选：把整个文件夹拖到 <https://app.netlify.com/drop>，立刻得到一个 HTTPS 网址，也需要免费账号。

### 加到手机主屏幕

1. 手机 Chrome 打开上面的网址。
2. 右上角 **⋮ → 添加到主屏幕**（有的版本显示「安装应用」）。
3. 桌面上就会出现图标，点开是全屏，没有地址栏。

## 常见问题

**改了课表，手机还显示旧的？**
Service Worker 缓存了旧文件。把 `sw.js` 第一行的版本号加 1（`kebiao-v2` → `kebiao-v3`），再上传一次，手机刷新就会更新。

**点开还有地址栏，不是全屏？**
说明不是 HTTPS，或者 `manifest.json` 没上传成功。检查第 4 步的网址是不是 `https://`。

**想加上「课前提醒」「今日课表小组件」？**
这些是 Web 能力之外的东西，需要做成真正的 APK（用 Capacitor 把现在的代码套一层壳，代码几乎不用改）。

## 以后想升级成真正的 APK

现在这套代码 100% 可以复用，到时只需要：

```powershell
pnpm add @capacitor/core @capacitor/cli @capacitor/android
npx cap init
npx cap add android
npx cap open android
```

在 Android Studio 里点 Run，就会装到手机上。
